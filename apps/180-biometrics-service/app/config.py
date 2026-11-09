"""Runtime configuration (all from environment variables)."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

log = logging.getLogger("biometrics")

SERVICE_ROOT = Path(__file__).resolve().parent.parent


def _f(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        log.warning("Invalid float for %s=%r, using default %s", name, raw, default)
        return default


def _i(name: str, default: int) -> int:
    return int(_f(name, float(default)))


@dataclass(frozen=True)
class Settings:
    # --- server ---
    host: str = field(default_factory=lambda: os.environ.get("HOST", "127.0.0.1"))
    port: int = field(default_factory=lambda: _i("PORT", 8090))
    env: str = field(
        default_factory=lambda: (
            os.environ.get("BIOMETRICS_ENV") or os.environ.get("NODE_ENV") or "production"
        ).lower()
    )
    api_key: str = field(default_factory=lambda: os.environ.get("BIOMETRICS_SERVICE_KEY", ""))
    models_dir: Path = field(
        default_factory=lambda: Path(os.environ.get("BIOMETRICS_MODELS_DIR", SERVICE_ROOT / "models"))
    )
    ort_threads: int = field(default_factory=lambda: _i("ORT_INTRA_OP_THREADS", 0))

    # --- input guards ---
    max_image_bytes: int = field(default_factory=lambda: _i("MAX_IMAGE_BYTES", 8 * 1024 * 1024))
    max_image_dim: int = field(default_factory=lambda: _i("MAX_IMAGE_DIM", 1280))
    max_liveness_frames: int = field(default_factory=lambda: _i("MAX_LIVENESS_FRAMES", 10))
    max_references: int = field(default_factory=lambda: _i("MAX_REFERENCES", 6))

    # --- detection ---
    det_threshold: float = field(default_factory=lambda: _f("DET_THRESHOLD", 0.5))
    doc_det_threshold: float = field(default_factory=lambda: _f("DOC_DET_THRESHOLD", 0.45))

    # --- recognition thresholds (ArcFace w600k_r50 cosine similarity) ---
    # See README "Threshold calibration" for the reasoning behind these defaults.
    match_threshold: float = field(default_factory=lambda: _f("FACE_MATCH_THRESHOLD", 0.40))
    review_threshold: float = field(default_factory=lambda: _f("FACE_REVIEW_THRESHOLD", 0.30))
    cross_doc_threshold: float = field(default_factory=lambda: _f("CROSS_DOC_THRESHOLD", 0.35))

    # --- liveness ---
    liveness_same_id_threshold: float = field(
        default_factory=lambda: _f("LIVENESS_SAME_ID_THRESHOLD", 0.50)
    )
    liveness_turn_min_yaw: float = field(default_factory=lambda: _f("LIVENESS_TURN_MIN_YAW", 15.0))
    liveness_frontal_max_yaw: float = field(
        default_factory=lambda: _f("LIVENESS_FRONTAL_MAX_YAW", 12.0)
    )
    # Mean absolute difference (0-255 scale) between two aligned 112x112 crops below
    # which the frames are considered a replay of the same still image.
    liveness_min_frame_diff: float = field(
        default_factory=lambda: _f("LIVENESS_MIN_FRAME_DIFF", 2.0)
    )
    antispoof_threshold: float = field(default_factory=lambda: _f("ANTISPOOF_THRESHOLD", 0.50))
    antispoof_enabled: bool = field(
        default_factory=lambda: os.environ.get("ANTISPOOF_ENABLED", "true").lower()
        not in ("0", "false", "no", "off")
    )

    @property
    def is_dev(self) -> bool:
        return self.env in ("development", "dev", "local", "test")


settings = Settings()
