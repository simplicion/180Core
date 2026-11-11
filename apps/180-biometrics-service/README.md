# 180 Biometrics Service

This is the face engine behind **180 Verify**. It is a small Python FastAPI service that runs ONNX models on onnxruntime (CPU):

| Stage | Model | Source |
|---|---|---|
| Detection + 5 landmarks | SCRFD-10GF `det_10g.onnx` | InsightFace `buffalo_l` |
| Recognition (512-D) | ArcFace R50 / WebFace600K `w600k_r50.onnx` | InsightFace `buffalo_l` |
| Passive anti-spoof | MiniFASNetV2 + MiniFASNetV1SE (fused) | minivision-ai Silent-Face-Anti-Spoofing, ONNX export by yakhyo |

It does not depend on the `insightface` pip package, which needs MSVC to build on Windows. The service implements these steps itself, following the reference code:

- SCRFD anchor decoding and NMS.
- Umeyama similarity alignment to the 112×112 ArcFace template.
- MiniFASNet cropping.

The Node backend calls it through `apps/180-core-backend/src/services/biometrics.service.ts`.

> **Licensing:** InsightFace's pretrained `buffalo_l` weights are licensed for **non-commercial research only**. Before production use, get a commercial license from InsightFace or swap in commercially licensed detector and recognizer weights. The MiniFASNet weights are Apache-2.0.

## Setup

You need Python 3.10–3.13 (tested with 3.13.7 on Windows 11).

```bash
# from the repo root
pnpm --filter 180-biometrics-service setup     # creates .venv, pip installs, downloads models
# or by hand:
cd apps/180-biometrics-service
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # Windows  (.venv/bin/python on POSIX)
.venv/Scripts/python scripts/download_models.py
```

`download_models.py` downloads about 280 MB in total:

- `buffalo_l.zip` from the official InsightFace GitHub release (v0.7). Only `det_10g.onnx` and `w600k_r50.onnx` are extracted into `models/`.
- The two MiniFASNet ONNX files.

Every file is checked against a pinned SHA-256. Both `models/` and `.venv/` are gitignored.

## Run

```bash
pnpm --filter 180-biometrics-service dev     # BIOMETRICS_ENV=development, 127.0.0.1:8090
pnpm --filter 180-biometrics-service start   # no forced dev mode (needs BIOMETRICS_SERVICE_KEY)
pnpm --filter 180-biometrics-service test    # pytest
# or directly
.venv/Scripts/python -m app
```

The root `pnpm dev` (`scripts/dev-runner.js`) does **not** start this service. Run it in its own terminal.

If the venv or models are missing, the `dev` launcher prints a warning and exits 0. That way `turbo run dev` keeps running the other apps.

## Environment

| Var | Default | Meaning |
|---|---|---|
| `BIOMETRICS_SERVICE_KEY` | *(unset)* | Shared secret; every `/v1/*` request must send it in `X-Biometrics-Key`. If unset, requests are allowed only when `BIOMETRICS_ENV` is development, dev, local or test (a warning is logged); otherwise they are rejected with 401. |
| `BIOMETRICS_ENV` (falls back to `NODE_ENV`) | `production` | Dev mode relaxes the key requirement and enables `/docs`. |
| `HOST` / `PORT` | `127.0.0.1` / `8090` | Bind address. The pnpm launcher uses `BIOMETRICS_PORT` so it doesn't pick up another app's `PORT`. |
| `FACE_MATCH_THRESHOLD` | `0.40` | Minimum ArcFace cosine for a reference to count as a match. |
| `FACE_REVIEW_THRESHOLD` | `0.30` | A score below this rejects; a score between this and the match threshold goes to manual review. |
| `CROSS_DOC_THRESHOLD` | `0.35` | Minimum document-to-document cosine for the documents to be "consistent". |
| `LIVENESS_SAME_ID_THRESHOLD` | `0.50` | Minimum cosine between each liveness frame and the first frame. |
| `LIVENESS_TURN_MIN_YAW` / `LIVENESS_FRONTAL_MAX_YAW` | `15` / `12` | Head-turn rules, in degrees. |
| `LIVENESS_MIN_FRAME_DIFF` | `12` | Replay metric threshold (see below). |
| `ANTISPOOF_THRESHOLD` | `0.50` | Minimum fused MiniFASNet P(real) for each frame. |
| `ANTISPOOF_ENABLED` | `true` | Set `false` to switch off anti-spoof. `/health` then reports `antiSpoof:false`. |
| `DET_THRESHOLD` / `DOC_DET_THRESHOLD` | `0.5` / `0.45` | SCRFD score thresholds (selfie / document). |
| `MAX_IMAGE_BYTES` / `MAX_IMAGE_DIM` | 8 MiB / 1280 | Decode guard. Images are downscaled so their longest side is at most 1280 px. EXIF orientation is applied. |
| `MAX_LIVENESS_FRAMES` / `MAX_REFERENCES` | 10 / 6 | Request limits. |
| `ORT_INTRA_OP_THREADS` | 0 (auto) | onnxruntime threads. |
| `BIOMETRICS_MODELS_DIR` | `./models` | Where the model files live. |

The service never logs image data, base64 payloads or embeddings, and the access log is off.

## API

Images are sent as raw base64 or as a `data:image/...;base64,` URL (JPEG, PNG or WebP).

Errors come back as `{error, message}` with these statuses:

- 400 / 413 for bad input
- 401 for an auth failure
- 503 when the models aren't loaded
- 500 for an engine error

### `GET /health` (no auth)

```json
{
  "status": "ok",
  "models": { "detector": true, "recognizer": true, "antiSpoof": true },
  "thresholds": { "match": 0.4, "review": 0.3, "crossDocument": 0.35 }
}
```

The real `thresholds` object also includes the liveness, anti-spoof and detection thresholds.

### `POST /v1/detect` `{image}`

Returns `{imageWidth, imageHeight, faces:[{bbox:{x,y,width,height}, score, landmarks:[[x,y]×5], yaw, pitch}]}`, with the largest face first. Coordinates are in the decoded image, after it has been downscaled to at most 1280 px.

**Yaw convention.** Frames are raw, *unmirrored* camera images.

- `yaw > 0` means the nose has moved toward the **image's right** relative to the eye midpoint. On a front camera, that is the user turning their head to **their own left**.
- A mirrored "selfie preview" frame flips the sign, so send the raw frame.

Yaw is estimated from the 5 landmarks. The service first takes out roll, then computes `atan(dx / (0.35 · IOD))`, where `dx` is the nose offset and IOD is the distance between the eyes. Pitch (`>0` = chin up) is a rough estimate and isn't used in any decision.

### `POST /v1/extract-face` `{image}`

Returns `{hasFace, faceCount, confidence, boundingBox?, faceBase64?}`. `faceBase64` is a JPEG data URL of a padded head-and-shoulders crop of the **largest** face, upscaled to at least 224 px tall.

If the first detection pass finds no face, the service tries again in two ways:

- **Upscaled pass:** a 2× upscale with a 1280 network input, for the small photos on ID cards.
- **Padded pass:** a grey border is added, for tight crops where the face fills the frame.

### `POST /v1/liveness` `{frames:[{step, image}]}`

`step` is one of `NEUTRAL | BLINK | TURN_LEFT | TURN_RIGHT | SMILE`. The response is `{passed, score, antiSpoofApplied, reasons[], perFrame:[{step, faceFound, faceCount, yaw, spoofScore|null, sameIdentityAsFirst}]}`.

The check passes only if every rule below holds:

- There are at least 3 frames.
- Each frame contains exactly one face. Detections narrower than 20% of the main face are ignored.
- Each frame's ArcFace cosine to frame 0 is at least `LIVENESS_SAME_ID_THRESHOLD`.
- `TURN_LEFT` frames have yaw ≥ +15°.
- `TURN_RIGHT` frames have yaw ≤ −15°.
- `NEUTRAL` and `BLINK` frames have |yaw| ≤ 12°.
- No two frames are byte-identical.
- No two frames are near-identical. The metric is the 99th percentile of |a − b| over the aligned 112×112 grey crops, after a Gaussian blur (σ 1.5) and mean-centering.
- If anti-spoof is loaded, every frame's fused P(real) is at least `ANTISPOOF_THRESHOLD`.

`score` is the fraction of frames that pass every per-frame check, multiplied by the mean P(real) when anti-spoof is active. It is 0 if a replay was detected.

### `POST /v1/match` `{probe, references:[{docType, image}]}`

Returns `{verdict, overallMatch, overallConfidence, comparisons:[{documentType, similarityScore, confidencePercentage, isMatch, faceFound}], crossDocument:[{a,b,similarity,consistent}], mismatchReason?, thresholds:{match, review}}`.

References can be full card images or crops; the largest face in each is used, with the same retry passes as extract-face. The verdict is decided in this order:

1. The probe has no face → `REJECT` / `NO_PROBE_FACE`.
2. No reference has a face → `REJECT` / `NO_DOCUMENT_FACE`.
3. Any reference with a face scores below `review` → `REJECT` / `FACE_MISMATCH`.
4. Every reference with a face scores at least `match` → `APPROVE`. This becomes `MANUAL_REVIEW` / `CROSS_DOCUMENT_INCONSISTENT` if any document pair scores below `CROSS_DOC_THRESHOLD`.
5. Anything else → `MANUAL_REVIEW` / `LOW_SIMILARITY`.

References with no face get `faceFound:false`. They never count toward an approval, and on their own they don't block one.

`confidencePercentage` is a piecewise-linear *display* scale, not a probability:

| Cosine similarity | Confidence |
|---|---|
| ≤ 0.10 | 0 |
| `review` | 50 |
| `match` | 80 |
| ≥ 0.70 | 99 |

`overallConfidence` is the weakest-link minimum over the references that have a face.

## Threshold calibration

- **Impostor scores.** For `w600k_r50`, impostor (different-person) cosines are centred near 0 with σ ≈ 0.07–0.1. On the sample set below, all 150+ impostor pairs fell between −0.14 and +0.12.
- **Genuine scores.** Same-person scores for good photos are usually 0.6–0.85. A small, printed or old ID-card photo against a live selfie typically drops to 0.35–0.6.
- **Match threshold.** `0.40` sits more than 4σ above the impostor mean, which gives a very low false-accept rate, while still accepting most ID-vs-selfie genuine pairs.
- **Review band.** Scores of `0.30`–`0.40` go to a human instead of being rejected outright.
- **Cross-document threshold.** `CROSS_DOC_THRESHOLD = 0.35` is slightly more lenient than the match threshold, because two printed ID photos can be years apart.
- **Liveness identity threshold.** Frames from one live session score high (in testing, 0.76–0.78 even at about 30° yaw), so `0.50` is a comfortable floor.

**Re-calibrate** on real, consented PAN/Aadhaar/DL-vs-selfie pairs before you rely on these numbers in production.

## Windows notes

- Every dependency installs from wheels; no compiler is needed. Verified with Python 3.13.7, onnxruntime 1.31.1, opencv-python-headless 4.14 and numpy 2.5.
- Stopping `pnpm dev` with Ctrl+C can leave `python.exe -m app` running in the background. If port 8090 stays busy, check Task Manager or run `Get-Process python`.
- Use `.venv\Scripts\python.exe`, not `.venv/bin/python`.

## Known limitations

- **BLINK and SMILE aren't verified.** Those steps are checked only for face presence, identity and frontal pose. The 5-point landmarks can't measure eye closure or a smile.
- **Weak replay check.** The pixel replay check only catches naive replays, such as the same still re-encoded or slightly rescaled. Heavier processing defeats it; for example, one photo downscaled 4× from a different source file was not flagged. Injected frames are the job of the anti-spoof model and of a trusted capture path.
- **Anti-spoof is unproven.** MiniFASNet was trained on the upstream authors' data. It scored every genuine sample photo ≥ 0.57 fused, but its detection of real print or screen attacks **has not been measured here**.
- **CPU only.** Expect roughly 0.1–0.4 s per image.
