# Cubes

Tetris pieces in 3D — preview in the browser, export STL/GLB, optional Blender `.blend` via a local Python API.

## Local development

```sh
npm i
cp .env.example .env.local   # VITE_EXPORT_API_URL=http://localhost:8000
npm run dev
```

**Export Blender** needs the API alongside the dev server:

```sh
npm run docker:api   # http://localhost:8000 — FastAPI + headless Blender
```

Or without Docker: `cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000` (Blender on `PATH`).

The **Export Blender** button is compiled in only when `VITE_EXPORT_API_URL` is set. GitHub Pages builds omit it unless you set that env in CI.

## GitHub Pages

Pushes to `main` run `.github/workflows/deploy.yml` → static build → `gh-pages` branch.
