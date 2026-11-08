# Python export backend

The **frontend** (repo root, `npm run dev`) handles preview, STL, GLB, and POSTs JSON here.

This service runs **Blender headless** and returns a native `.blend` (quad voxel shells + boolean holes).

## Why split?

| Layer | Role |
|-------|------|
| Browser (TS) | UI, real-time mesh, STL/GLB, build `ExportPayload` JSON |
| Python API | Validate JSON, invoke `bpy`, return `.blend` |

Point the app at this service with `VITE_EXPORT_API_URL` in `.env.local` (see repo root `.env.example`).

## Run with Docker

From the repo root (while `npm run dev` runs the frontend):

```bash
docker compose up --build
```

API: http://localhost:8000

## API without Docker (requires Blender on PATH)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## API

`POST /v1/export/blend`

- **Body:** `ExportPayload` JSON (see `src/types/exportPayload.ts`)
- **Response:** `application/octet-stream` — `.blend` file
- **Errors:** JSON `{"detail": "..."}`

Health: `GET /health`

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `BLENDER_BIN` | `blender` | Blender executable |
| `EXPORT_TIMEOUT_SEC` | `120` | Kill hung jobs |
| `CORS_ORIGINS` | `*` | Comma-separated origins for browser |

## Layout

```
backend/
  app/main.py           # FastAPI
  app/schemas.py        # Pydantic (mirrors TS ExportPayload)
  blender/build_blend.py  # Runs inside Blender (--background)
  Dockerfile
  requirements.txt
```
