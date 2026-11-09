"""Safe decoding / encoding of client-supplied images."""
from __future__ import annotations

import base64
import binascii
import os
import re

# Decompression-bomb guard: must be set before cv2 is imported anywhere.
os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", str(64 * 1024 * 1024))

import cv2  # noqa: E402
import numpy as np  # noqa: E402

_DATA_URL_RE = re.compile(r"^data:image/[a-zA-Z0-9.+-]+;base64,", re.IGNORECASE)


class ImageError(ValueError):
    """Raised for client-side image problems (maps to HTTP 400/413)."""

    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.status = status


def strip_data_url(data: str) -> str:
    data = data.strip()
    m = _DATA_URL_RE.match(data)
    if m:
        return data[m.end():]
    if data.startswith("data:"):
        raise ImageError("INVALID_IMAGE", "Unsupported data URL (expected data:image/...;base64,)")
    return data


def decode_image(data: str, max_bytes: int, max_dim: int) -> np.ndarray:
    """Decode a base64 / data-URL image into a BGR uint8 array.

    * rejects payloads larger than ``max_bytes`` (checked before decoding)
    * applies EXIF orientation (cv2.IMREAD_COLOR does this by default)
    * downsizes so that max(width, height) <= ``max_dim``
    """
    if not isinstance(data, str) or not data:
        raise ImageError("INVALID_IMAGE", "Image is empty")
    b64 = strip_data_url(data)
    # base64 expands by 4/3; reject early without allocating the decoded buffer.
    if len(b64) * 3 // 4 > max_bytes + 4:
        raise ImageError("IMAGE_TOO_LARGE", f"Image exceeds {max_bytes} bytes", status=413)
    try:
        raw = base64.b64decode(re.sub(r"\s+", "", b64), validate=True)
    except (binascii.Error, ValueError):
        raise ImageError("INVALID_IMAGE", "Image is not valid base64") from None
    if len(raw) > max_bytes:
        raise ImageError("IMAGE_TOO_LARGE", f"Image exceeds {max_bytes} bytes", status=413)
    buf = np.frombuffer(raw, dtype=np.uint8)
    try:
        img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    except cv2.error:
        img = None
    if img is None or img.ndim != 3 or img.shape[0] < 16 or img.shape[1] < 16:
        raise ImageError("INVALID_IMAGE", "Image could not be decoded (JPEG/PNG/WebP expected)")
    return limit_size(img, max_dim)


def limit_size(img: np.ndarray, max_dim: int) -> np.ndarray:
    h, w = img.shape[:2]
    m = max(h, w)
    if m <= max_dim:
        return img
    s = max_dim / m
    return cv2.resize(img, (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_AREA)


def encode_jpeg_data_url(img: np.ndarray, quality: int = 92) -> str:
    ok, enc = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise RuntimeError("JPEG encoding failed")
    return "data:image/jpeg;base64," + base64.b64encode(enc.tobytes()).decode("ascii")
