"""Business logic: detection, document face crop, liveness and 1:N document match.

Nothing in this module logs image data or embeddings.
"""
from __future__ import annotations

import hashlib
import itertools
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from .config import Settings
from .imageio import encode_jpeg_data_url
from .models import SCRFD, AntiSpoofEnsemble, ArcFace, Face, MiniFASNet, estimate_pose

log = logging.getLogger("biometrics")

DETECTOR_FILE = "det_10g.onnx"
RECOGNIZER_FILE = "w600k_r50.onnx"
# (file, crop scale) -- same pairing as upstream Silent-Face-Anti-Spoofing
ANTISPOOF_FILES = (("MiniFASNetV2.onnx", 2.7), ("MiniFASNetV1SE.onnx", 4.0))

LIVENESS_STEPS = ("NEUTRAL", "BLINK", "TURN_LEFT", "TURN_RIGHT", "SMILE")


class EngineUnavailable(RuntimeError):
    pass


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.clip(np.dot(a, b), -1.0, 1.0))


def similarity_to_confidence(sim: float, review: float, match: float) -> int:
    """Map ArcFace cosine similarity to a 0-100 "confidence" for humans.

    This is a monotone, piecewise-linear presentation scale -- NOT a calibrated
    probability. Anchors:
        sim <= 0.10            ->   0   (typical impostor scores sit around 0.0 +- 0.1)
        sim == review (0.30)   ->  50   (boundary of the manual-review band)
        sim == match  (0.40)   ->  80   (boundary of automatic approval)
        sim >= 0.70            ->  99   (very strong same-person evidence)
    Between anchors the value is linearly interpolated. The verdict is always
    decided on the raw similarity vs thresholds, never on this number.
    """
    lo = 0.10
    hi = max(0.70, match + 0.05)
    xs = [lo, review, match, hi]
    ys = [0.0, 50.0, 80.0, 99.0]
    if not (lo < review < match < hi):
        # Degenerate env configuration: fall back to a plain linear map.
        return int(round(np.clip((sim - lo) / (hi - lo), 0, 1) * 99))
    return int(round(float(np.interp(sim, xs, ys))))


@dataclass
class Detected:
    face: Face
    yaw: float
    pitch: float


class Engine:
    def __init__(self, settings: Settings):
        self.s = settings
        self.detector: Optional[SCRFD] = None
        self.recognizer: Optional[ArcFace] = None
        self.antispoof: Optional[AntiSpoofEnsemble] = None
        self.load_errors: dict[str, str] = {}

    # ------------------------------------------------------------------ setup
    def load(self) -> None:
        d = Path(self.s.models_dir)
        t = self.s.ort_threads
        for attr, fname, ctor in (
            ("detector", DETECTOR_FILE, lambda p: SCRFD(p, t)),
            ("recognizer", RECOGNIZER_FILE, lambda p: ArcFace(p, t)),
        ):
            p = d / fname
            try:
                if not p.exists():
                    raise FileNotFoundError(f"{p} missing - run scripts/download_models.py")
                setattr(self, attr, ctor(p))
                log.info("loaded %s (%s)", attr, fname)
            except Exception as exc:  # noqa: BLE001
                self.load_errors[attr] = str(exc)
                log.error("failed to load %s: %s", attr, exc)
        if not self.s.antispoof_enabled:
            log.warning("anti-spoof disabled by ANTISPOOF_ENABLED")
            return
        members = []
        for fname, scale in ANTISPOOF_FILES:
            p = d / fname
            if not p.exists():
                log.warning("anti-spoof model %s not found", fname)
                continue
            try:
                members.append(MiniFASNet(p, scale=scale, threads=t))
                log.info("loaded anti-spoof %s", fname)
            except Exception as exc:  # noqa: BLE001
                self.load_errors["antiSpoof"] = str(exc)
                log.error("failed to load anti-spoof model %s: %s", fname, exc)
        if members:
            self.antispoof = AntiSpoofEnsemble(members)
        else:
            log.warning("no anti-spoof model available; passive anti-spoof DISABLED (antiSpoof=false)")

    @property
    def ready(self) -> bool:
        return self.detector is not None and self.recognizer is not None

    def _require(self) -> None:
        if not self.ready:
            raise EngineUnavailable("Face models are not loaded")

    def models_status(self) -> dict:
        return {
            "detector": self.detector is not None,
            "recognizer": self.recognizer is not None,
            "antiSpoof": self.antispoof is not None,
        }

    def thresholds(self) -> dict:
        s = self.s
        return {
            "match": s.match_threshold,
            "review": s.review_threshold,
            "crossDocument": s.cross_doc_threshold,
            "livenessSameIdentity": s.liveness_same_id_threshold,
            "livenessTurnMinYaw": s.liveness_turn_min_yaw,
            "livenessFrontalMaxYaw": s.liveness_frontal_max_yaw,
            "livenessMinFrameDiff": s.liveness_min_frame_diff,
            "antiSpoof": s.antispoof_threshold,
            "detection": s.det_threshold,
        }

    # -------------------------------------------------------------- detection
    def detect(self, img: np.ndarray, threshold: Optional[float] = None, upscale: bool = False) -> list[Face]:
        """Detect faces, largest first. With ``upscale`` a second pass at a larger
        network input (and 2x image upscale for small images) is attempted if the
        first pass finds nothing -- used for small photos on ID cards."""
        self._require()
        thr = self.s.det_threshold if threshold is None else threshold
        faces = self.detector.detect(img, thr, 640)
        if not faces and upscale:
            h, w = img.shape[:2]
            if max(h, w) < 900:
                big = cv2.resize(img, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
                faces = self.detector.detect(big, thr, 1280)
                for f in faces:
                    f.bbox = f.bbox / 2.0
                    f.kps = f.kps / 2.0
            else:
                faces = self.detector.detect(img, thr, 1280)
        if not faces and upscale:
            # Tightly cropped face photos (face fills the frame) are hard for
            # anchor-based detectors: add a 40% neutral-grey border and retry.
            h, w = img.shape[:2]
            py, px = int(h * 0.4), int(w * 0.4)
            padded = cv2.copyMakeBorder(img, py, py, px, px, cv2.BORDER_CONSTANT, value=(127, 127, 127))
            faces = self.detector.detect(padded, thr, 640)
            for f in faces:
                f.bbox = f.bbox - np.array([px, py, px, py], dtype=np.float32)
                f.bbox[[0, 2]] = np.clip(f.bbox[[0, 2]], 0, w)
                f.bbox[[1, 3]] = np.clip(f.bbox[[1, 3]], 0, h)
                f.kps = f.kps - np.array([px, py], dtype=np.float32)
        faces.sort(key=lambda f: f.area, reverse=True)
        return faces

    def describe(self, img: np.ndarray) -> list[Detected]:
        out = []
        for f in self.detect(img):
            yaw, pitch, _ = estimate_pose(f.kps)
            out.append(Detected(f, yaw, pitch))
        return out

    @staticmethod
    def bbox_dict(face: Face) -> dict:
        x1, y1, x2, y2 = (float(v) for v in face.bbox)
        return {
            "x": round(x1, 1),
            "y": round(y1, 1),
            "width": round(x2 - x1, 1),
            "height": round(y2 - y1, 1),
        }

    # ---------------------------------------------------------- document crop
    def extract_face(self, img: np.ndarray) -> dict:
        faces = self.detect(img, threshold=self.s.doc_det_threshold, upscale=True)
        if not faces:
            return {"hasFace": False, "faceCount": 0, "confidence": 0.0}
        f = faces[0]
        h, w = img.shape[:2]
        x1, y1, x2, y2 = (float(v) for v in f.bbox)
        bw, bh = x2 - x1, y2 - y1
        # Pad to a passport-style head-and-shoulders crop.
        px, pt, pb = bw * 0.35, bh * 0.45, bh * 0.30
        cx1, cy1 = int(max(0, x1 - px)), int(max(0, y1 - pt))
        cx2, cy2 = int(min(w, x2 + px)), int(min(h, y2 + pb))
        crop = img[cy1:cy2, cx1:cx2]
        # Upscale tiny document crops so downstream consumers get a usable image.
        if crop.shape[0] < 224:
            s = 224 / crop.shape[0]
            crop = cv2.resize(crop, (round(crop.shape[1] * s), 224), interpolation=cv2.INTER_CUBIC)
        return {
            "hasFace": True,
            "faceCount": len(faces),
            "confidence": round(f.score, 4),
            "boundingBox": self.bbox_dict(f),
            "faceBase64": encode_jpeg_data_url(crop),
        }

    # --------------------------------------------------------------- liveness
    def liveness(self, frames: list[tuple[str, np.ndarray, bytes]]) -> dict:
        """frames: list of (step, decoded BGR image, raw base64 string bytes)."""
        self._require()
        s = self.s
        reasons: list[str] = []
        per_frame: list[dict] = []
        anti = self.antispoof
        if len(frames) < 3:
            reasons.append("TOO_FEW_FRAMES: at least 3 frames are required")

        # Byte-identical replay check (same encoded image submitted twice).
        digests = [hashlib.sha256(raw).hexdigest() for _, _, raw in frames]
        if len(set(digests)) != len(digests):
            reasons.append("REPLAY_DETECTED: identical image submitted for multiple steps")

        first_emb: Optional[np.ndarray] = None
        aligned_crops: list[Optional[np.ndarray]] = []
        frame_ok: list[bool] = []
        spoof_scores: list[float] = []

        for idx, (step, img, _) in enumerate(frames):
            faces = self.detect(img)
            # Count faces that are plausibly "in the session" (ignore tiny
            # far-background detections below 20% of the main face width).
            if faces:
                main_w = faces[0].width
                faces = [f for f in faces if f.width >= 0.2 * main_w]
            info = {
                "step": step,
                "faceFound": bool(faces),
                "faceCount": len(faces),
                "yaw": 0.0,
                "spoofScore": None,
                "sameIdentityAsFirst": False,
            }
            ok = True
            if len(faces) != 1:
                ok = False
                reasons.append(
                    f"{step}[{idx}]: expected exactly one face, found {len(faces)}"
                )
                aligned_crops.append(None)
            else:
                f = faces[0]
                yaw, _pitch, _ = estimate_pose(f.kps)
                info["yaw"] = round(yaw, 1)
                emb, aligned = self.recognizer.embed(img, f)
                aligned_crops.append(cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY).astype(np.float32))
                if first_emb is None and idx == 0:
                    first_emb = emb
                if first_emb is not None:
                    sim = cosine(first_emb, emb)
                    info["sameIdentityAsFirst"] = sim >= s.liveness_same_id_threshold
                    if not info["sameIdentityAsFirst"]:
                        ok = False
                        reasons.append(f"{step}[{idx}]: face differs from first frame (identity change)")
                else:
                    ok = False
                    reasons.append(f"{step}[{idx}]: no reference identity (first frame had no single face)")

                if step == "TURN_LEFT" and yaw < s.liveness_turn_min_yaw:
                    ok = False
                    reasons.append(
                        f"TURN_LEFT[{idx}]: head not turned left enough (yaw {yaw:.1f} < {s.liveness_turn_min_yaw})"
                    )
                elif step == "TURN_RIGHT" and yaw > -s.liveness_turn_min_yaw:
                    ok = False
                    reasons.append(
                        f"TURN_RIGHT[{idx}]: head not turned right enough (yaw {yaw:.1f} > {-s.liveness_turn_min_yaw})"
                    )
                elif step in ("NEUTRAL", "BLINK") and abs(yaw) > s.liveness_frontal_max_yaw:
                    ok = False
                    reasons.append(
                        f"{step}[{idx}]: face not frontal (|yaw| {abs(yaw):.1f} > {s.liveness_frontal_max_yaw})"
                    )

                if anti is not None:
                    real = anti.real_score(img, f)
                    info["spoofScore"] = round(real, 4)
                    spoof_scores.append(real)
                    if real < s.antispoof_threshold:
                        ok = False
                        reasons.append(f"{step}[{idx}]: anti-spoof check failed (presentation attack suspected)")
            per_frame.append(info)
            frame_ok.append(ok)

        # Pixel-level replay check on aligned crops (catches the same photo
        # re-encoded / resized, which defeats the byte hash).
        replay = False
        valid = [(i, c) for i, c in enumerate(aligned_crops) if c is not None]
        for (i, a), (j, b) in itertools.combinations(valid, 2):
            diff = float(np.mean(np.abs(a - b)))
            if diff < s.liveness_min_frame_diff:
                replay = True
                reasons.append(
                    f"REPLAY_DETECTED: frames {i} and {j} are pixel-identical (static image)"
                )
        if replay:
            frame_ok = [False] * len(frame_ok)

        # score = fraction of frames passing every per-frame check, scaled by the
        # mean anti-spoof real-probability when that model is active. 0 on replay.
        n = max(1, len(frames))
        score = sum(frame_ok) / n
        if anti is not None and spoof_scores:
            score *= float(np.mean(spoof_scores))
        if replay or any(r.startswith("REPLAY_DETECTED: identical") for r in reasons):
            score = 0.0
        passed = len(frames) >= 3 and all(frame_ok) and not reasons
        # de-duplicate reasons, keep order
        seen: set[str] = set()
        reasons = [r for r in reasons if not (r in seen or seen.add(r))]
        return {
            "passed": passed,
            "score": round(score, 4),
            "antiSpoofApplied": anti is not None,
            "reasons": reasons,
            "perFrame": per_frame,
        }

    # ------------------------------------------------------------------ match
    def _best_face_embedding(self, img: np.ndarray, document: bool) -> Optional[np.ndarray]:
        faces = self.detect(
            img,
            threshold=self.s.doc_det_threshold if document else self.s.det_threshold,
            upscale=document,
        )
        if not faces:
            return None
        emb, _ = self.recognizer.embed(img, faces[0])
        return emb

    def match(self, probe: np.ndarray, references: list[tuple[str, np.ndarray]]) -> dict:
        self._require()
        s = self.s
        thr = {"match": s.match_threshold, "review": s.review_threshold}
        # Selfie: try the normal pass, then the upscale pass (cheap insurance).
        probe_emb = self._best_face_embedding(probe, document=False)
        if probe_emb is None:
            probe_emb = self._best_face_embedding(probe, document=True)

        ref_embs: list[tuple[str, Optional[np.ndarray]]] = [
            (doc_type, self._best_face_embedding(img, document=True)) for doc_type, img in references
        ]

        comparisons = []
        for doc_type, emb in ref_embs:
            if emb is None or probe_emb is None:
                comparisons.append(
                    {
                        "documentType": doc_type,
                        "similarityScore": 0.0,
                        "confidencePercentage": 0,
                        "isMatch": False,
                        "faceFound": emb is not None,
                    }
                )
                continue
            sim = cosine(probe_emb, emb)
            comparisons.append(
                {
                    "documentType": doc_type,
                    "similarityScore": round(sim, 4),
                    "confidencePercentage": similarity_to_confidence(sim, s.review_threshold, s.match_threshold),
                    "isMatch": sim >= s.match_threshold,
                    "faceFound": True,
                }
            )

        cross = []
        faced = [(t, e) for t, e in ref_embs if e is not None]
        for (ta, ea), (tb, eb) in itertools.combinations(faced, 2):
            sim = cosine(ea, eb)
            cross.append(
                {"a": ta, "b": tb, "similarity": round(sim, 4), "consistent": sim >= s.cross_doc_threshold}
            )

        result = {
            "comparisons": comparisons,
            "crossDocument": cross,
            "thresholds": thr,
        }

        if probe_emb is None:
            return {**result, "verdict": "REJECT", "overallMatch": False, "overallConfidence": 0,
                    "mismatchReason": "NO_PROBE_FACE"}
        with_face = [c for c in comparisons if c["faceFound"]]
        if not with_face:
            return {**result, "verdict": "REJECT", "overallMatch": False, "overallConfidence": 0,
                    "mismatchReason": "NO_DOCUMENT_FACE"}

        # Weakest-link confidence: the decision requires *every* document face to match.
        overall_conf = min(c["confidencePercentage"] for c in with_face)
        sims = [c["similarityScore"] for c in with_face]
        if min(sims) < s.review_threshold:
            verdict, reason = "REJECT", "FACE_MISMATCH"
        elif all(c["isMatch"] for c in with_face):
            verdict, reason = "APPROVE", None
            if any(not c["consistent"] for c in cross):
                verdict, reason = "MANUAL_REVIEW", "CROSS_DOCUMENT_INCONSISTENT"
        else:
            verdict, reason = "MANUAL_REVIEW", "LOW_SIMILARITY"

        out = {**result, "verdict": verdict, "overallMatch": verdict == "APPROVE",
               "overallConfidence": overall_conf}
        if reason:
            out["mismatchReason"] = reason
        return out
