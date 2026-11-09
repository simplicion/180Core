"""ONNX model wrappers: SCRFD detector, ArcFace recognizer, MiniFASNet anti-spoof.

Implemented directly on onnxruntime + numpy (no ``insightface`` pip dependency).
Pre/post-processing follows the reference implementations in
deepinsight/insightface (python-package/insightface/model_zoo/scrfd.py,
arcface_onnx.py, utils/face_align.py) and minivision-ai/Silent-Face-Anti-Spoofing.
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

log = logging.getLogger("biometrics")


def _session(path: Path, threads: int) -> ort.InferenceSession:
    opts = ort.SessionOptions()
    opts.log_severity_level = 3
    if threads > 0:
        opts.intra_op_num_threads = threads
    return ort.InferenceSession(str(path), sess_options=opts, providers=["CPUExecutionProvider"])


# --------------------------------------------------------------------------- #
# Geometry helpers
# --------------------------------------------------------------------------- #

# Canonical ArcFace 112x112 5-point template (left eye, right eye, nose,
# left mouth corner, right mouth corner) -- "left/right" as seen in the image.
ARCFACE_DST = np.array(
    [
        [38.2946, 51.6963],
        [73.5318, 51.5014],
        [56.0252, 71.7366],
        [41.5493, 92.3655],
        [70.7299, 92.2041],
    ],
    dtype=np.float32,
)


def umeyama_similarity(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    """Least-squares similarity transform (rotation + uniform scale + translation)
    mapping ``src`` -> ``dst`` (Umeyama 1991). Returns a 2x3 matrix.
    Equivalent to skimage.transform.SimilarityTransform.estimate used by insightface.
    """
    src = src.astype(np.float64)
    dst = dst.astype(np.float64)
    n = src.shape[0]
    mu_s, mu_d = src.mean(0), dst.mean(0)
    sc, dc = src - mu_s, dst - mu_d
    cov = dc.T @ sc / n
    u, s, vt = np.linalg.svd(cov)
    d = np.ones(2)
    if np.linalg.det(cov) < 0:
        d[-1] = -1
    r = u @ np.diag(d) @ vt
    var_s = (sc ** 2).sum() / n
    scale = (s * d).sum() / var_s if var_s > 0 else 1.0
    t = mu_d - scale * r @ mu_s
    m = np.zeros((2, 3), dtype=np.float64)
    m[:, :2] = scale * r
    m[:, 2] = t
    return m


def align_face(img: np.ndarray, landmarks: np.ndarray, size: int = 112) -> np.ndarray:
    dst = ARCFACE_DST * (size / 112.0)
    m = umeyama_similarity(np.asarray(landmarks, dtype=np.float32), dst)
    return cv2.warpAffine(img, m, (size, size), borderValue=0.0)


# Approximate depth of the nose tip in front of the eye plane, as a fraction of
# the inter-ocular distance (eye centre to eye centre). Anthropometric averages:
# IOD ~ 62 mm, nose tip ~ 18-22 mm in front of the eye centres' plane
# (measured from the eyeball centre plane it is more; for detector eye points
# 0.30-0.40 fits observed data). Used for yaw = atan(dx / (K * IOD)).
NOSE_DEPTH_RATIO = 0.35
# For pitch: vertical distance eye-line -> mouth-line is ~1.15 IOD in the template;
# the nose tip sits at ~0.50 of that span when the face is frontal.
FRONTAL_NOSE_VERTICAL_RATIO = 0.497


def estimate_pose(landmarks: np.ndarray) -> tuple[float, float, float]:
    """Estimate (yaw, pitch, roll) in degrees from 5 landmarks.

    Landmark order: [eye_img_left, eye_img_right, nose, mouth_img_left, mouth_img_right].

    SIGN CONVENTION (frames are raw, un-mirrored camera images):
      * yaw  > 0  -> nose displaced toward the IMAGE's RIGHT relative to the eye
                     midpoint, i.e. the subject turned their head to THEIR OWN LEFT
                     (front camera).  yaw < 0 -> subject turned to their own right.
      * pitch > 0 -> nose closer to the eye line than frontal (chin up / looking up).
      * roll      -> angle of the eye line, positive = clockwise in image coords.

    Method: rotate the points so the eye line is horizontal (removes roll), then
    the nose's horizontal offset from the eye midpoint, normalised by the
    inter-ocular distance, is ~ K * tan(yaw) for a nose tip K*IOD in front of the
    eye plane (weak-perspective). Inter-ocular distance itself shrinks with
    cos(yaw), which this ratio already accounts for.
    """
    p = np.asarray(landmarks, dtype=np.float64)
    le, re_, nose, ml, mr = p
    ev = re_ - le
    roll = math.atan2(ev[1], ev[0])
    c, s = math.cos(-roll), math.sin(-roll)
    rot = np.array([[c, -s], [s, c]])
    mid_eye = (le + re_) / 2.0
    q = (p - mid_eye) @ rot.T  # eye line now on +x axis, origin at eye midpoint
    iod = max(1e-6, abs(q[1, 0] - q[0, 0]))
    dx = q[2, 0]  # + => nose toward image right
    yaw = math.degrees(math.atan2(dx, NOSE_DEPTH_RATIO * iod))

    mouth_y = (q[3, 1] + q[4, 1]) / 2.0
    span = max(1e-6, mouth_y)  # eye line is y=0, image y grows downward
    ratio = q[2, 1] / span
    # map deviation from frontal ratio to an angle; the nose->eye/mouth span
    # behaves like K' * tan(pitch) with K' ~ 0.5 of the eye-mouth span.
    pitch = math.degrees(math.atan2(FRONTAL_NOSE_VERTICAL_RATIO - ratio, 0.5))
    return yaw, pitch, math.degrees(roll)


# --------------------------------------------------------------------------- #
# SCRFD detector (det_10g.onnx)
# --------------------------------------------------------------------------- #


@dataclass
class Face:
    bbox: np.ndarray  # x1, y1, x2, y2
    score: float
    kps: np.ndarray  # (5, 2)

    @property
    def width(self) -> float:
        return float(self.bbox[2] - self.bbox[0])

    @property
    def height(self) -> float:
        return float(self.bbox[3] - self.bbox[1])

    @property
    def area(self) -> float:
        return max(0.0, self.width) * max(0.0, self.height)


def nms(dets: np.ndarray, thresh: float) -> list[int]:
    x1, y1, x2, y2, scores = dets[:, 0], dets[:, 1], dets[:, 2], dets[:, 3], dets[:, 4]
    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    order = scores.argsort()[::-1]
    keep: list[int] = []
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        w = np.maximum(0.0, xx2 - xx1 + 1)
        h = np.maximum(0.0, yy2 - yy1 + 1)
        inter = w * h
        ovr = inter / (areas[i] + areas[order[1:]] - inter)
        order = order[np.where(ovr <= thresh)[0] + 1]
    return keep


class SCRFD:
    def __init__(self, path: Path, threads: int = 0):
        self.session = _session(path, threads)
        inp = self.session.get_inputs()[0]
        self.input_name = inp.name
        shape = inp.shape
        # det_10g has a dynamic H/W; fall back to 640 when not fixed.
        self.fixed_size = (
            (int(shape[3]), int(shape[2]))
            if isinstance(shape[2], int) and isinstance(shape[3], int)
            else None
        )
        self.output_names = [o.name for o in self.session.get_outputs()]
        n_out = len(self.output_names)
        if n_out == 9:
            self.fmc, self.strides, self.use_kps = 3, [8, 16, 32], True
        elif n_out == 15:
            self.fmc, self.strides, self.use_kps = 5, [8, 16, 32, 64, 128], True
        else:
            raise RuntimeError(f"Unsupported SCRFD model with {n_out} outputs (need keypoints)")
        self.num_anchors = 2
        self._anchor_cache: dict[tuple[int, int, int], np.ndarray] = {}
        self.nms_thresh = 0.4

    def _anchors(self, h: int, w: int, stride: int) -> np.ndarray:
        key = (h, w, stride)
        a = self._anchor_cache.get(key)
        if a is None:
            a = np.stack(np.mgrid[:h, :w][::-1], axis=-1).astype(np.float32)
            a = (a * stride).reshape((-1, 2))
            a = np.stack([a] * self.num_anchors, axis=1).reshape((-1, 2))
            if len(self._anchor_cache) < 100:
                self._anchor_cache[key] = a
        return a

    def detect(self, img: np.ndarray, threshold: float = 0.5, input_size: int = 640) -> list[Face]:
        """Detect faces in a BGR image. Image is letterboxed (top-left) into a square
        ``input_size`` canvas, preserving aspect ratio (upscaling small images)."""
        size = self.fixed_size or (input_size, input_size)
        ih, iw = img.shape[:2]
        im_ratio = ih / iw
        model_ratio = size[1] / size[0]
        if im_ratio > model_ratio:
            new_h = size[1]
            new_w = int(new_h / im_ratio)
        else:
            new_w = size[0]
            new_h = int(new_w * im_ratio)
        det_scale = new_h / ih
        resized = cv2.resize(img, (new_w, new_h))
        canvas = np.zeros((size[1], size[0], 3), dtype=np.uint8)
        canvas[:new_h, :new_w] = resized

        blob = cv2.dnn.blobFromImage(
            canvas, 1.0 / 128.0, size, (127.5, 127.5, 127.5), swapRB=True
        )
        outs = self.session.run(self.output_names, {self.input_name: blob})
        in_h, in_w = blob.shape[2], blob.shape[3]

        scores_l, boxes_l, kps_l = [], [], []
        for idx, stride in enumerate(self.strides):
            scores = outs[idx].reshape(-1)
            bbox_preds = outs[idx + self.fmc].reshape(-1, 4) * stride
            kps_preds = outs[idx + self.fmc * 2].reshape(-1, 10) * stride
            fh, fw = in_h // stride, in_w // stride
            centers = self._anchors(fh, fw, stride)
            pos = np.where(scores >= threshold)[0]
            if pos.size == 0:
                continue
            c = centers[pos]
            d = bbox_preds[pos]
            boxes = np.stack(
                [c[:, 0] - d[:, 0], c[:, 1] - d[:, 1], c[:, 0] + d[:, 2], c[:, 1] + d[:, 3]],
                axis=-1,
            )
            k = kps_preds[pos].reshape(-1, 5, 2)
            k = k + c[:, None, :]
            scores_l.append(scores[pos])
            boxes_l.append(boxes)
            kps_l.append(k)

        if not scores_l:
            return []
        scores = np.concatenate(scores_l)
        boxes = np.concatenate(boxes_l) / det_scale
        kps = np.concatenate(kps_l) / det_scale
        order = scores.argsort()[::-1]
        dets = np.hstack([boxes, scores[:, None]]).astype(np.float32)[order]
        kps = kps[order]
        keep = nms(dets, self.nms_thresh)
        faces = []
        for i in keep:
            b = dets[i, :4].copy()
            b[[0, 2]] = np.clip(b[[0, 2]], 0, iw)
            b[[1, 3]] = np.clip(b[[1, 3]], 0, ih)
            if b[2] - b[0] < 4 or b[3] - b[1] < 4:
                continue
            faces.append(Face(bbox=b, score=float(dets[i, 4]), kps=kps[i].astype(np.float32)))
        return faces


# --------------------------------------------------------------------------- #
# ArcFace recognizer (w600k_r50.onnx)
# --------------------------------------------------------------------------- #


class ArcFace:
    def __init__(self, path: Path, threads: int = 0):
        self.session = _session(path, threads)
        inp = self.session.get_inputs()[0]
        self.input_name = inp.name
        self.output_name = self.session.get_outputs()[0].name
        self.size = int(inp.shape[2]) if isinstance(inp.shape[2], int) else 112

    def embed_aligned(self, aligned_bgr: np.ndarray) -> np.ndarray:
        blob = cv2.dnn.blobFromImage(
            aligned_bgr, 1.0 / 127.5, (self.size, self.size), (127.5, 127.5, 127.5), swapRB=True
        )
        feat = self.session.run([self.output_name], {self.input_name: blob})[0][0]
        n = np.linalg.norm(feat)
        return (feat / n).astype(np.float32) if n > 0 else feat.astype(np.float32)

    def embed(self, img: np.ndarray, face: Face) -> tuple[np.ndarray, np.ndarray]:
        aligned = align_face(img, face.kps, self.size)
        return self.embed_aligned(aligned), aligned


# --------------------------------------------------------------------------- #
# MiniFASNet passive anti-spoof (Silent-Face-Anti-Spoofing, ONNX export)
# --------------------------------------------------------------------------- #


class MiniFASNet:
    """MiniFASNetV2 (scale 2.7, 80x80). Output: 3 logits, index 1 = real face.
    Input: BGR, float32 0-255 (no normalisation), NCHW -- matching the upstream
    repo whose ``to_tensor`` deliberately does not divide by 255."""

    def __init__(self, path: Path, scale: float = 2.7, threads: int = 0):
        self.session = _session(path, threads)
        inp = self.session.get_inputs()[0]
        self.input_name = inp.name
        self.output_name = self.session.get_outputs()[0].name
        h = inp.shape[2] if isinstance(inp.shape[2], int) else 80
        w = inp.shape[3] if isinstance(inp.shape[3], int) else 80
        self.size = (int(w), int(h))
        self.scale = scale

    def _crop(self, img: np.ndarray, face: Face) -> np.ndarray:
        src_h, src_w = img.shape[:2]
        x, y = float(face.bbox[0]), float(face.bbox[1])
        bw, bh = max(1.0, face.width), max(1.0, face.height)
        scale = min((src_h - 1) / bh, (src_w - 1) / bw, self.scale)
        nw, nh = bw * scale, bh * scale
        cx, cy = x + bw / 2, y + bh / 2
        x1, y1 = cx - nw / 2, cy - nh / 2
        x2, y2 = cx + nw / 2, cy + nh / 2
        if x1 < 0:
            x2 -= x1
            x1 = 0
        if y1 < 0:
            y2 -= y1
            y1 = 0
        if x2 > src_w - 1:
            x1 -= x2 - src_w + 1
            x2 = src_w - 1
        if y2 > src_h - 1:
            y1 -= y2 - src_h + 1
            y2 = src_h - 1
        x1, y1, x2, y2 = int(max(0, x1)), int(max(0, y1)), int(x2), int(y2)
        crop = img[y1 : y2 + 1, x1 : x2 + 1]
        return cv2.resize(crop, self.size)

    def real_score(self, img: np.ndarray, face: Face) -> float:
        crop = self._crop(img, face).astype(np.float32)
        blob = np.transpose(crop, (2, 0, 1))[None]
        logits = self.session.run([self.output_name], {self.input_name: blob})[0][0]
        e = np.exp(logits - logits.max())
        prob = e / e.sum()
        return float(prob[1])


class AntiSpoofEnsemble:
    """Upstream Silent-Face-Anti-Spoofing fuses MiniFASNetV2 (crop scale 2.7) and
    MiniFASNetV1SE (crop scale 4.0) by averaging their softmax outputs; we do the
    same. Returns P(real) in [0, 1]."""

    def __init__(self, members: list[MiniFASNet]):
        if not members:
            raise ValueError("no anti-spoof models")
        self.members = members

    def real_score(self, img: np.ndarray, face: Face) -> float:
        return float(np.mean([m.real_score(img, face) for m in self.members]))
