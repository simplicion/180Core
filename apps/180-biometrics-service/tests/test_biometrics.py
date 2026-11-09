"""Tests for the 180 biometrics service.

* Pure unit tests (pose sign convention, alignment, confidence mapping, image
  guards) always run.
* Model tests need ./models (run scripts/download_models.py) and are skipped
  otherwise.
* Real-face tests use openly licensed sample photos from the MIT-licensed
  ageitgey/face_recognition repository, downloaded once into tests/.cache
  (gitignored). Set BIOMETRICS_TEST_IMAGES to a directory containing the same
  file names to run offline. Skipped if unavailable.
"""
from __future__ import annotations

import base64
import math
import os
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

os.environ.setdefault("BIOMETRICS_ENV", "test")
os.environ["BIOMETRICS_SERVICE_KEY"] = "test-key"

import cv2  # noqa: E402

from app.engine import similarity_to_confidence  # noqa: E402
from app.imageio import ImageError, decode_image, strip_data_url  # noqa: E402
from app.models import ARCFACE_DST, align_face, estimate_pose, umeyama_similarity  # noqa: E402

MODELS_PRESENT = all(
    (ROOT / "models" / f).exists() for f in ("det_10g.onnx", "w600k_r50.onnx")
)
needs_models = pytest.mark.skipif(not MODELS_PRESENT, reason="models not downloaded")

KEY = {"X-Biometrics-Key": "test-key"}

# --------------------------------------------------------------------------- #
# Synthetic geometry
# --------------------------------------------------------------------------- #


def synthetic_landmarks(yaw_deg: float, pitch_deg: float = 0.0, roll_deg: float = 0.0) -> np.ndarray:
    """Project a rough 3D 5-point face model rotated by yaw (about the vertical axis).

    Camera looks along +z; image x to the right, y down. Subject faces the
    camera (nose has negative z = closer). A positive yaw here rotates the head
    so the nose moves toward image +x (the subject's own left on a raw,
    unmirrored front-camera frame).
    """
    iod = 62.0
    pts = np.array(
        [
            [-iod / 2, 0.0, 0.0],  # eye on image-left
            [iod / 2, 0.0, 0.0],  # eye on image-right
            [0.0, 35.0, -22.0],  # nose tip (in front of eye plane)
            [-25.0, 71.0, -5.0],  # mouth image-left
            [25.0, 71.0, -5.0],  # mouth image-right
        ]
    )
    y = math.radians(yaw_deg)
    # rotation about the vertical (image y) axis; with nose z<0, x' = x cos - z sin
    ry = np.array([[math.cos(y), 0, -math.sin(y)], [0, 1, 0], [math.sin(y), 0, math.cos(y)]])
    p = math.radians(pitch_deg)
    rx = np.array([[1, 0, 0], [0, math.cos(p), math.sin(p)], [0, -math.sin(p), math.cos(p)]])
    r = math.radians(roll_deg)
    rz = np.array([[math.cos(r), -math.sin(r), 0], [math.sin(r), math.cos(r), 0], [0, 0, 1]])
    out = (rz @ rx @ ry @ pts.T).T
    return out[:, :2] * 2.0 + np.array([320.0, 240.0])


def test_synthetic_model_nose_moves_right_for_positive_yaw():
    lm = synthetic_landmarks(25)
    mid = (lm[0, 0] + lm[1, 0]) / 2
    assert lm[2, 0] > mid  # nose to image right


@pytest.mark.parametrize("yaw", [-40, -25, -15, -5, 0, 5, 15, 25, 40])
def test_yaw_sign_and_magnitude(yaw):
    est, _pitch, _roll = estimate_pose(synthetic_landmarks(yaw))
    if yaw == 0:
        assert abs(est) < 1.0
    else:
        assert math.copysign(1, est) == math.copysign(1, yaw), (yaw, est)
        assert abs(est - yaw) < 12, (yaw, est)


@pytest.mark.parametrize("roll", [-25, -10, 10, 25])
def test_yaw_is_roll_invariant(roll):
    a, _, _ = estimate_pose(synthetic_landmarks(20, roll_deg=0))
    b, _, r = estimate_pose(synthetic_landmarks(20, roll_deg=roll))
    assert abs(a - b) < 1.0
    assert abs(r - roll) < 1.0


def test_horizontal_flip_negates_yaw():
    lm = synthetic_landmarks(22)
    flipped = lm.copy()
    flipped[:, 0] = 640 - flipped[:, 0]
    # after mirroring, image-left/right landmark roles swap
    flipped = flipped[[1, 0, 2, 4, 3]]
    a, _, _ = estimate_pose(lm)
    b, _, _ = estimate_pose(flipped)
    assert a > 15 and b < -15
    assert abs(a + b) < 0.5


def test_template_is_frontal():
    yaw, pitch, roll = estimate_pose(ARCFACE_DST)
    assert abs(yaw) < 1 and abs(pitch) < 1 and abs(roll) < 1


def test_umeyama_recovers_similarity():
    ang, s, t = math.radians(17), 1.7, np.array([12.0, -5.0])
    rot = np.array([[math.cos(ang), -math.sin(ang)], [math.sin(ang), math.cos(ang)]])
    src = ARCFACE_DST.astype(np.float64)
    dst = (s * (rot @ src.T)).T + t
    m = umeyama_similarity(src, dst)
    assert np.allclose(m[:, :2], s * rot, atol=1e-6)
    assert np.allclose(m[:, 2], t, atol=1e-6)


def test_align_face_maps_landmarks_to_template():
    img = np.zeros((480, 640, 3), np.uint8)
    lm = synthetic_landmarks(0)
    for x, y in lm:
        cv2.circle(img, (int(x), int(y)), 3, (255, 255, 255), -1)
    out = align_face(img, lm)
    assert out.shape == (112, 112, 3)
    for x, y in ARCFACE_DST:
        assert out[int(round(y)), int(round(x))].max() > 100


def test_confidence_mapping_monotone_and_anchored():
    vals = [similarity_to_confidence(s / 100, 0.30, 0.40) for s in range(-20, 101)]
    assert vals == sorted(vals)
    assert similarity_to_confidence(0.0, 0.30, 0.40) == 0
    assert similarity_to_confidence(0.30, 0.30, 0.40) == 50
    assert similarity_to_confidence(0.40, 0.30, 0.40) == 80
    assert similarity_to_confidence(0.95, 0.30, 0.40) == 99


# --------------------------------------------------------------------------- #
# Image guards
# --------------------------------------------------------------------------- #


def _jpeg_b64(img: np.ndarray, quality: int = 92) -> str:
    ok, enc = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    assert ok
    return base64.b64encode(enc.tobytes()).decode()


def test_strip_data_url():
    assert strip_data_url("data:image/jpeg;base64,AAAA") == "AAAA"
    assert strip_data_url("data:image/png;base64,QQ==") == "QQ=="
    assert strip_data_url("AAAA") == "AAAA"
    with pytest.raises(ImageError):
        strip_data_url("data:text/html;base64,AAAA")


def test_decode_resizes_and_rejects_garbage():
    big = np.full((2000, 3000, 3), 128, np.uint8)
    out = decode_image("data:image/jpeg;base64," + _jpeg_b64(big), 8 << 20, 1280)
    assert max(out.shape[:2]) == 1280
    with pytest.raises(ImageError):
        decode_image(base64.b64encode(b"not an image at all" * 10).decode(), 8 << 20, 1280)
    with pytest.raises(ImageError) as ei:
        decode_image("A" * (12 << 20), 8 << 20, 1280)
    assert ei.value.status == 413


# --------------------------------------------------------------------------- #
# Real images
# --------------------------------------------------------------------------- #

IMG_BASE = "https://raw.githubusercontent.com/ageitgey/face_recognition/master/examples/"
IMAGES = {
    "obama.jpg": "obama.jpg",
    "obama2.jpg": "obama2.jpg",
    "obama1.jpg": "knn_examples/test/obama1.jpg",
    "biden.jpg": "biden.jpg",
    "biden2.jpg": "knn_examples/train/biden/biden2.jpg",
    "kit1.jpeg": "knn_examples/train/kit_harington/john1.jpeg",
    "kit2.jpeg": "knn_examples/train/kit_harington/john2.jpeg",
    "rose1.jpg": "knn_examples/train/rose_leslie/img1.jpg",
}


@pytest.fixture(scope="session")
def images() -> dict[str, np.ndarray]:
    d = Path(os.environ.get("BIOMETRICS_TEST_IMAGES", ROOT / "tests" / ".cache"))
    d.mkdir(parents=True, exist_ok=True)
    out = {}
    for name, rel in IMAGES.items():
        p = d / name
        if not p.exists():
            try:
                req = urllib.request.Request(IMG_BASE + rel, headers={"User-Agent": "biometrics-tests"})
                with urllib.request.urlopen(req, timeout=30) as r:
                    p.write_bytes(r.read())
            except Exception as exc:  # noqa: BLE001
                pytest.skip(f"test images unavailable: {exc}")
        img = cv2.imread(str(p))
        assert img is not None, name
        out[name] = img
    return out


@pytest.fixture(scope="session")
def client():
    if not MODELS_PRESENT:
        pytest.skip("models not downloaded")
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


def b64(img: np.ndarray) -> str:
    return "data:image/jpeg;base64," + _jpeg_b64(img)


@needs_models
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    j = r.json()
    assert j["models"]["detector"] and j["models"]["recognizer"]
    assert j["thresholds"]["match"] > j["thresholds"]["review"]


@needs_models
def test_auth_required(client, images):
    r = client.post("/v1/detect", json={"image": b64(images["obama.jpg"])})
    assert r.status_code == 401
    r = client.post("/v1/detect", json={"image": b64(images["obama.jpg"])}, headers={"X-Biometrics-Key": "nope"})
    assert r.status_code == 401


@needs_models
def test_bad_image_is_400(client):
    r = client.post("/v1/detect", json={"image": "data:image/png;base64,AAAA"}, headers=KEY)
    assert r.status_code == 400


@needs_models
def test_detect_real_yaw_sign(client, images):
    # obama1: head turned so the nose points to IMAGE RIGHT -> yaw > 0
    # obama2: nose points to IMAGE LEFT -> yaw < 0
    r1 = client.post("/v1/detect", json={"image": b64(images["obama1.jpg"])}, headers=KEY).json()
    r2 = client.post("/v1/detect", json={"image": b64(images["obama2.jpg"])}, headers=KEY).json()
    assert len(r1["faces"]) == 1 and r1["faces"][0]["yaw"] > 15
    assert len(r2["faces"]) == 1 and r2["faces"][0]["yaw"] < -15
    flipped = cv2.flip(images["obama1.jpg"], 1)
    r3 = client.post("/v1/detect", json={"image": b64(flipped)}, headers=KEY).json()
    assert r3["faces"][0]["yaw"] < -15
    assert len(r1["faces"][0]["landmarks"]) == 5


@needs_models
@pytest.mark.parametrize(
    "probe,ref,expected",
    [
        ("obama.jpg", "obama2.jpg", "APPROVE"),
        ("obama1.jpg", "obama2.jpg", "APPROVE"),
        ("kit1.jpeg", "kit2.jpeg", "APPROVE"),
        ("biden.jpg", "biden2.jpg", "APPROVE"),
        ("obama.jpg", "biden.jpg", "REJECT"),
        ("kit1.jpeg", "rose1.jpg", "REJECT"),
        ("biden2.jpg", "obama1.jpg", "REJECT"),
    ],
)
def test_match_same_vs_different(client, images, probe, ref, expected):
    r = client.post(
        "/v1/match",
        json={"probe": b64(images[probe]), "references": [{"docType": "PAN", "image": b64(images[ref])}]},
        headers=KEY,
    )
    assert r.status_code == 200
    j = r.json()
    assert j["verdict"] == expected, j
    c = j["comparisons"][0]
    assert c["faceFound"]
    if expected == "APPROVE":
        assert c["similarityScore"] >= j["thresholds"]["match"] and j["overallMatch"]
    else:
        assert c["similarityScore"] < j["thresholds"]["review"] and not j["overallMatch"]


def make_id_card(face_img: np.ndarray, face_height: int = 120) -> np.ndarray:
    """Card-sized canvas (85.6 x 54 mm @ ~12 px/mm) with a small portrait pasted
    on the right and some fake text lines."""
    card = np.full((640, 1012, 3), (235, 225, 210), np.uint8)
    cv2.rectangle(card, (0, 0), (1012, 90), (120, 60, 20), -1)
    for i in range(6):
        cv2.putText(card, "NAME  XXXXXXXX  1234 5678", (40, 170 + i * 60), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (40, 40, 40), 2)
    h, w = face_img.shape[:2]
    # portrait: head-and-shoulders crop of the top-centre of the source image
    crop = face_img[0 : int(h * 0.55), int(w * 0.2) : int(w * 0.8)]
    ph = int(face_height * 1.9)
    pw = int(crop.shape[1] * ph / crop.shape[0])
    portrait = cv2.resize(crop, (pw, ph), interpolation=cv2.INTER_AREA)
    y0, x0 = 140, 1012 - pw - 50
    card[y0 : y0 + ph, x0 : x0 + pw] = portrait
    return card


@needs_models
def test_extract_face_from_id_card(client, images):
    card = make_id_card(images["obama.jpg"])
    r = client.post("/v1/extract-face", json={"image": b64(card)}, headers=KEY).json()
    assert r["hasFace"] and r["faceCount"] == 1
    assert r["faceBase64"].startswith("data:image/jpeg;base64,")
    assert r["boundingBox"]["x"] > 600  # portrait is on the right side of the card
    # the crop must still be the same person as a different photo
    m = client.post(
        "/v1/match",
        json={"probe": b64(images["obama2.jpg"]), "references": [{"docType": "AADHAAR", "image": r["faceBase64"]}]},
        headers=KEY,
    ).json()
    assert m["verdict"] == "APPROVE", m


@needs_models
def test_match_against_full_card_and_no_face_doc(client, images):
    card = make_id_card(images["obama.jpg"])
    blank = np.full((640, 1012, 3), 200, np.uint8)
    j = client.post(
        "/v1/match",
        json={
            "probe": b64(images["obama1.jpg"]),
            "references": [{"docType": "PAN", "image": b64(card)}, {"docType": "DL", "image": b64(blank)}],
        },
        headers=KEY,
    ).json()
    assert j["comparisons"][0]["faceFound"] and j["comparisons"][0]["isMatch"]
    assert not j["comparisons"][1]["faceFound"]
    assert j["verdict"] == "APPROVE"
    j = client.post(
        "/v1/match",
        json={"probe": b64(images["obama1.jpg"]), "references": [{"docType": "DL", "image": b64(blank)}]},
        headers=KEY,
    ).json()
    assert j["verdict"] == "REJECT" and j["mismatchReason"] == "NO_DOCUMENT_FACE"


@needs_models
def test_cross_document_inconsistency(client, images):
    j = client.post(
        "/v1/match",
        json={
            "probe": b64(images["obama.jpg"]),
            "references": [
                {"docType": "PAN", "image": b64(images["obama2.jpg"])},
                {"docType": "DL", "image": b64(images["biden.jpg"])},
            ],
        },
        headers=KEY,
    ).json()
    assert j["verdict"] == "REJECT"
    assert len(j["crossDocument"]) == 1 and not j["crossDocument"][0]["consistent"]


@needs_models
def test_probe_without_face_rejected(client, images):
    j = client.post(
        "/v1/match",
        json={"probe": b64(np.full((480, 640, 3), 90, np.uint8)), "references": [{"docType": "PAN", "image": b64(images["obama.jpg"])}]},
        headers=KEY,
    ).json()
    assert j["verdict"] == "REJECT" and j["mismatchReason"] == "NO_PROBE_FACE"


def _live(client, frames):
    r = client.post("/v1/liveness", json={"frames": [{"step": s, "image": b64(i)} for s, i in frames]}, headers=KEY)
    assert r.status_code == 200, r.text
    return r.json()


@needs_models
def test_liveness_accepts_correct_sequence(client, images):
    # Different real photos of the same person: frontal, turned to their own
    # left (nose -> image right), turned to their own right (nose -> image left).
    j = _live(
        client,
        [("NEUTRAL", images["obama.jpg"]), ("TURN_LEFT", images["obama1.jpg"]), ("TURN_RIGHT", images["obama2.jpg"])],
    )
    assert j["passed"], j
    assert all(f["sameIdentityAsFirst"] for f in j["perFrame"])
    assert j["perFrame"][1]["yaw"] >= 15 and j["perFrame"][2]["yaw"] <= -15
    if j["antiSpoofApplied"]:
        assert all(f["spoofScore"] is not None for f in j["perFrame"])


@needs_models
def test_liveness_rejects_wrong_yaw_direction(client, images):
    j = _live(
        client,
        [("NEUTRAL", images["obama.jpg"]), ("TURN_LEFT", images["obama2.jpg"]), ("TURN_RIGHT", images["obama1.jpg"])],
    )
    assert not j["passed"]
    assert any("TURN_LEFT" in r for r in j["reasons"]) and any("TURN_RIGHT" in r for r in j["reasons"])


@needs_models
def test_liveness_rejects_mirrored_frame(client, images):
    # A mirrored (selfie-preview) frame flips the yaw sign -> must fail TURN_LEFT.
    j = _live(
        client,
        [("NEUTRAL", images["obama.jpg"]), ("TURN_LEFT", cv2.flip(images["obama1.jpg"], 1)), ("TURN_RIGHT", images["obama2.jpg"])],
    )
    assert not j["passed"]


@needs_models
def test_liveness_rejects_identical_frames(client, images):
    img = images["obama.jpg"]
    j = _live(client, [("NEUTRAL", img), ("BLINK", img), ("SMILE", img)])
    assert not j["passed"] and j["score"] == 0
    assert any(r.startswith("REPLAY_DETECTED") for r in j["reasons"])


@needs_models
def test_liveness_rejects_reencoded_still(client, images):
    img = images["obama.jpg"]
    frames = []
    for q, s in ((95, 1.0), (80, 0.98), (70, 1.02)):
        ok, enc = cv2.imencode(".jpg", cv2.resize(img, None, fx=s, fy=s), [cv2.IMWRITE_JPEG_QUALITY, q])
        frames.append(cv2.imdecode(enc, cv2.IMREAD_COLOR))
    j = _live(client, [("NEUTRAL", frames[0]), ("BLINK", frames[1]), ("SMILE", frames[2])])
    assert not j["passed"]
    assert any(r.startswith("REPLAY_DETECTED") for r in j["reasons"]), j["reasons"]


@needs_models
def test_liveness_rejects_identity_swap(client, images):
    j = _live(client, [("NEUTRAL", images["obama.jpg"]), ("BLINK", images["biden.jpg"]), ("TURN_LEFT", images["obama1.jpg"])])
    assert not j["passed"]
    assert j["perFrame"][1]["sameIdentityAsFirst"] is False


@needs_models
def test_liveness_needs_three_frames(client, images):
    j = _live(client, [("NEUTRAL", images["obama.jpg"]), ("TURN_LEFT", images["obama1.jpg"])])
    assert not j["passed"]
    assert any("TOO_FEW_FRAMES" in r for r in j["reasons"])
