"""180 Verify biometrics service (FastAPI).

Run:  python -m app            (reads HOST / PORT from env, default 127.0.0.1:8090)
"""
from __future__ import annotations

import hmac
import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .config import settings
from .engine import Engine, EngineUnavailable
from .imageio import ImageError, decode_image

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [biometrics] %(message)s")
log = logging.getLogger("biometrics")

engine = Engine(settings)

# Hard cap on the whole request body (several base64 frames).
MAX_BODY_BYTES = (settings.max_image_bytes * 4 // 3 + 1024) * max(
    settings.max_liveness_frames, settings.max_references + 1
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if not settings.api_key:
        if settings.is_dev:
            log.warning("BIOMETRICS_SERVICE_KEY is not set - accepting unauthenticated requests (dev mode only)")
        else:
            log.error("BIOMETRICS_SERVICE_KEY is not set and env=%s - all /v1 requests will be rejected", settings.env)
    engine.load()
    log.info("models: %s", engine.models_status())
    yield


app = FastAPI(title="180 Biometrics Service", version="1.0.0", lifespan=lifespan,
              docs_url="/docs" if settings.is_dev else None, redoc_url=None, openapi_url="/openapi.json" if settings.is_dev else None)


@app.middleware("http")
async def body_limit(request: Request, call_next):
    cl = request.headers.get("content-length")
    if cl and cl.isdigit() and int(cl) > MAX_BODY_BYTES:
        return JSONResponse(status_code=413, content={"error": "PAYLOAD_TOO_LARGE", "message": "Request body too large"})
    return await call_next(request)


def require_key(x_biometrics_key: str | None = Header(default=None)) -> None:
    expected = settings.api_key
    if not expected:
        if settings.is_dev:
            return
        raise HTTPException(status_code=401, detail={"error": "UNAUTHORIZED", "message": "Service key not configured"})
    if not x_biometrics_key or not hmac.compare_digest(x_biometrics_key.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail={"error": "UNAUTHORIZED", "message": "Invalid X-Biometrics-Key"})


@app.exception_handler(ImageError)
async def image_error_handler(_req: Request, exc: ImageError):
    return JSONResponse(status_code=exc.status, content={"error": exc.code, "message": str(exc)})


@app.exception_handler(EngineUnavailable)
async def engine_unavailable_handler(_req: Request, exc: EngineUnavailable):
    return JSONResponse(status_code=503, content={"error": "MODELS_NOT_LOADED", "message": str(exc)})


@app.exception_handler(Exception)
async def unhandled(_req: Request, exc: Exception):
    # Never echo request content; log only the exception type/message.
    log.error("unhandled error: %s: %s", type(exc).__name__, exc)
    return JSONResponse(status_code=500, content={"error": "INTERNAL_ERROR", "message": "Biometrics engine error"})


def _img(data: str):
    return decode_image(data, settings.max_image_bytes, settings.max_image_dim)


# ---------------------------------------------------------------- schemas
class ImageRequest(BaseModel):
    image: str = Field(min_length=1)


class LivenessFrame(BaseModel):
    step: Literal["NEUTRAL", "BLINK", "TURN_LEFT", "TURN_RIGHT", "SMILE"]
    image: str = Field(min_length=1)


class LivenessRequest(BaseModel):
    frames: list[LivenessFrame] = Field(min_length=1)


class Reference(BaseModel):
    docType: str = Field(min_length=1, max_length=64)
    image: str = Field(min_length=1)


class MatchRequest(BaseModel):
    probe: str = Field(min_length=1)
    references: list[Reference] = Field(min_length=1)


# ---------------------------------------------------------------- routes
@app.get("/health")
def health():
    return {
        "status": "ok" if engine.ready else "degraded",
        "models": engine.models_status(),
        "thresholds": engine.thresholds(),
    }


@app.post("/v1/detect", dependencies=[Depends(require_key)])
def detect(req: ImageRequest):
    img = _img(req.image)
    faces = engine.describe(img)
    return {
        "imageWidth": int(img.shape[1]),
        "imageHeight": int(img.shape[0]),
        "faces": [
            {
                "bbox": engine.bbox_dict(d.face),
                "score": round(d.face.score, 4),
                "landmarks": [[round(float(x), 1), round(float(y), 1)] for x, y in d.face.kps],
                "yaw": round(d.yaw, 1),
                "pitch": round(d.pitch, 1),
            }
            for d in faces
        ],
    }


@app.post("/v1/extract-face", dependencies=[Depends(require_key)])
def extract_face(req: ImageRequest):
    return engine.extract_face(_img(req.image))


@app.post("/v1/liveness", dependencies=[Depends(require_key)])
def liveness(req: LivenessRequest):
    if len(req.frames) > settings.max_liveness_frames:
        raise ImageError("TOO_MANY_FRAMES", f"At most {settings.max_liveness_frames} frames allowed")
    frames = [(f.step, _img(f.image), f.image.encode("ascii", "ignore")) for f in req.frames]
    return engine.liveness(frames)


@app.post("/v1/match", dependencies=[Depends(require_key)])
def match(req: MatchRequest):
    if len(req.references) > settings.max_references:
        raise ImageError("TOO_MANY_REFERENCES", f"At most {settings.max_references} references allowed")
    probe = _img(req.probe)
    refs = [(r.docType, _img(r.image)) for r in req.references]
    return engine.match(probe, refs)
