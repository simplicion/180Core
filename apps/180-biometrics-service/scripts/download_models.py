"""Download the ONNX models used by the 180 biometrics service into ./models.

Models:
  * det_10g.onnx    - SCRFD-10GF face detector (+5 landmarks)      } from InsightFace
  * w600k_r50.onnx  - ArcFace R50 trained on WebFace600K (512-D)   } buffalo_l.zip
  * MiniFASNetV2.onnx, MiniFASNetV1SE.onnx - Silent-Face-Anti-Spoofing (minivision-ai,
                        Apache-2.0) 80x80 models, ONNX exports published by the
                        UniFace author (github.com/yakhyo/face-anti-spoofing);
                        sha256 pinned to the values in yakhyo/uniface constants.py.

LICENSE NOTE: InsightFace's pretrained buffalo_l weights are released for
NON-COMMERCIAL RESEARCH use only. Obtain a commercial license from InsightFace
(or swap in commercially licensed weights) before production use.

Usage:
  python scripts/download_models.py            # download anything missing
  python scripts/download_models.py --force    # re-download everything
  python scripts/download_models.py --no-antispoof
"""
from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = Path(os.environ.get("BIOMETRICS_MODELS_DIR", ROOT / "models"))

BUFFALO_URL = "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip"

# SHA-256 of the extracted files. Both hashes were verified to match the files in
# the official buffalo_l.zip AND the hashes pinned independently by the UniFace
# project (yakhyo/uniface constants.py: scrfd_10g_kps / w600k_r50).
BUFFALO_FILES = {
    "det_10g.onnx": "5838f7fe053675b1c7a08b633df49e7af5495cee0493c7dcf6697200b85b5b91",
    "w600k_r50.onnx": "4c06341c33c2ca1f86781dab0e829f88ad5b64be9fba56e56bc9ebdefc619e43",
}

ANTISPOOF = {
    "MiniFASNetV2.onnx": (
        "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV2.onnx",
        "b32929adc2d9c34b9486f8c4c7bc97c1b69bc0ea9befefc380e4faae4e463907",
    ),
    "MiniFASNetV1SE.onnx": (
        "https://github.com/yakhyo/face-anti-spoofing/releases/download/weights/MiniFASNetV1SE.onnx",
        "ebab7f90c7833fbccd46d3a555410e78d969db5438e169b6524be444862b3676",
    ),
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dest: Path) -> None:
    print(f"  downloading {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "biometrics-model-downloader"})
    with urllib.request.urlopen(req, timeout=60) as resp, open(dest, "wb") as out:
        total = int(resp.headers.get("Content-Length") or 0)
        done = 0
        last = -1
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
            done += len(chunk)
            if total:
                pct = done * 100 // total
                if pct // 10 != last:
                    last = pct // 10
                    print(f"    {pct:3d}%  ({done // (1 << 20)} / {total // (1 << 20)} MB)")


def verify(path: Path, expected: str | None) -> bool:
    if not path.exists():
        return False
    if expected is None:
        return True
    actual = sha256(path)
    if actual != expected:
        print(f"  !! sha256 mismatch for {path.name}: {actual} (expected {expected})")
        return False
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--no-antispoof", action="store_true")
    ap.add_argument("--skip-sha", action="store_true", help="do not verify sha256 (not recommended)")
    args = ap.parse_args()

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    ok = True

    def expected(h: str) -> str | None:
        return None if args.skip_sha else h

    need_buffalo = args.force or not all(
        verify(MODELS_DIR / n, expected(h)) for n, h in BUFFALO_FILES.items()
    )
    if need_buffalo:
        print("[buffalo_l] fetching detector + recognizer")
        with tempfile.TemporaryDirectory() as td:
            zpath = Path(td) / "buffalo_l.zip"
            download(BUFFALO_URL, zpath)
            with zipfile.ZipFile(zpath) as zf:
                for member in zf.namelist():
                    name = Path(member).name
                    if name in BUFFALO_FILES:
                        target = MODELS_DIR / name
                        with zf.open(member) as src, open(target, "wb") as dst:
                            shutil.copyfileobj(src, dst)
                        print(f"  extracted {name}")
        for n, h in BUFFALO_FILES.items():
            if verify(MODELS_DIR / n, expected(h)):
                print(f"  OK {n}")
            else:
                ok = False
                (MODELS_DIR / n).unlink(missing_ok=True)
    else:
        print("[buffalo_l] already present and verified")

    if not args.no_antispoof:
        for name, (url, h) in ANTISPOOF.items():
            target = MODELS_DIR / name
            if not args.force and verify(target, expected(h)):
                print(f"[antispoof] {name} already present and verified")
                continue
            print(f"[antispoof] fetching {name}")
            tmp = target.with_suffix(".part")
            try:
                download(url, tmp)
                if verify(tmp, expected(h)):
                    tmp.replace(target)
                    print(f"  OK {name}")
                else:
                    tmp.unlink(missing_ok=True)
                    print("  anti-spoof model failed verification; service will run with antiSpoof=false")
            except Exception as exc:  # noqa: BLE001
                tmp.unlink(missing_ok=True)
                print(f"  could not download anti-spoof model ({exc}); service will run with antiSpoof=false")

    print(f"models dir: {MODELS_DIR}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
