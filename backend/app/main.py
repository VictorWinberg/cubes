import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slugify import slugify

from app.schemas import ExportPayload
from app.settings import Settings

settings = Settings()

BACKEND_ROOT = Path(__file__).resolve().parents[1]
BUILD_SCRIPT = BACKEND_ROOT / "blender" / "build_blend.py"

app = FastAPI(title="Tetracubes export API", version="0.1.0")

origins = settings.cors_origin_list()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if origins == ["*"] else origins,
    allow_credentials=False,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "blender": settings.blender_bin}


def _attachment_name(payload: ExportPayload) -> str:
    if payload.file_name:
        base = payload.file_name.removesuffix(".blend").removesuffix(".BLEND")
    elif payload.pieces:
        base = payload.pieces[0].name or payload.pieces[0].id
    else:
        base = "tetracubes"
    safe = slugify(base, lowercase=True, separator="_") or "tetracubes"
    return f"{safe[:80]}.blend"


@app.post("/v1/export/blend")
def export_blend(payload: ExportPayload):
    if not BUILD_SCRIPT.is_file():
        raise HTTPException(status_code=500, detail="build_blend.py missing on server")

    download_name = _attachment_name(payload)

    with tempfile.TemporaryDirectory(prefix="tetracubes-") as tmp:
        tmp_path = Path(tmp)
        job_json = tmp_path / "job.json"
        out_blend = tmp_path / "out.blend"
        job_json.write_text(payload.model_dump_json(by_alias=True), encoding="utf-8")

        cmd = [
            settings.blender_bin,
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
                timeout=settings.export_timeout_sec,
                check=False,
            )
        except FileNotFoundError as e:
            raise HTTPException(
                status_code=503,
                detail=f"Blender not found ({settings.blender_bin}). Install Blender or set BLENDER_BIN.",
            ) from e
        except subprocess.TimeoutExpired as e:
            raise HTTPException(status_code=504, detail="Blender export timed out") from e

        if proc.returncode != 0 or not out_blend.is_file():
            stderr = (proc.stderr or proc.stdout or "")[-4000:]
            raise HTTPException(
                status_code=500,
                detail=f"Blender failed (code {proc.returncode}): {stderr}",
            )

        data = out_blend.read_bytes()

    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
    )
