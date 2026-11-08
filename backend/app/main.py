import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.schemas import ExportPayload

BLENDER_BIN = os.environ.get("BLENDER_BIN", "blender")
EXPORT_TIMEOUT_SEC = int(os.environ.get("EXPORT_TIMEOUT_SEC", "120"))
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

BACKEND_ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = BACKEND_ROOT / "blender" / "build_blend.py"

app = FastAPI(title="Tetracubes export API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if CORS_ORIGINS == ["*"] else CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "blender": BLENDER_BIN}


@app.post("/v1/export/blend")
def export_blend(payload: ExportPayload):
    if not BUILD_SCRIPT.is_file():
        raise HTTPException(status_code=500, detail="build_blend.py missing on server")

    with tempfile.TemporaryDirectory(prefix="tetracubes-") as tmp:
        tmp_path = Path(tmp)
        job_json = tmp_path / "job.json"
        out_blend = tmp_path / "out.blend"
        job_json.write_text(payload.model_dump_json(by_alias=True), encoding="utf-8")

        cmd = [
            BLENDER_BIN,
            "--background",
            "--python",
            str(BUILD_SCRIPT),
            "--",
            str(job_json),
            str(out_blend),
        ]

        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=EXPORT_TIMEOUT_SEC,
                check=False,
            )
        except FileNotFoundError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Blender not found ({BLENDER_BIN}). Install Blender or set BLENDER_BIN.",
            ) from e
        except subprocess.TimeoutExpired as e:
            raise HTTPException(status_code=504, detail="Blender export timed out") from e

        if proc.returncode != 0 or not out_blend.is_file():
            stderr = (proc.stderr or proc.stdout or "")[-4000:]
            raise HTTPException(
                status_code=500,
                detail=f"Blender failed (code {proc.returncode}): {stderr}",
            )

        if payload.file_name:
            base = payload.file_name
            if base.lower().endswith(".blend"):
                base = base[:-6]
            slug = base
        elif payload.pieces:
            slug = payload.pieces[0].name or payload.pieces[0].id
        else:
            slug = "tetracubes"
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in slug)[:80] or "tetracubes"
        data = out_blend.read_bytes()

    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{safe}.blend"'},
    )
