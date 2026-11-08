# Cubes

Tetris pieces in 3D — preview in the browser, export STL/GLB, optional Blender `.blend` via a local Python API.

## Local development

**All-in-one (UI + export API in Docker):**

```sh
npm run docker:up   # or: docker compose up --build
```

| URL | Service |
|-----|---------|
| http://localhost:8080 | Web app |
| http://localhost:8000/health | Blender export API |

Open **8080**, use **Export Blender**; the built UI calls the API on **8000** on your host.

**Frontend-only dev** (hot reload):

```sh
npm i
cp .env.example .env.local   # VITE_EXPORT_API_URL=http://localhost:8000
npm run dev                  # usually http://localhost:5173
```

With dev server, run the API separately: `docker compose up export-api` (API on 8000 only).

Or without Docker: `cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000` (requires **Blender** on `PATH`; mesh is built inside Blender from the same voxel quads as the web preview).

The **Export Blender** button is compiled in only when `VITE_EXPORT_API_URL` is set. GitHub Pages builds omit it unless you set that env in CI.

## GitHub Pages

Pushes to `main` run `.github/workflows/deploy.yml` → static build → `gh-pages` branch.
