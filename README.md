# Cubes

Tetris pieces in 3D — preview in the browser, export STL/GLB, optional Blender `.blend` via a Python API.

## Architecture

| Part | Stack | Hosting |
|------|-------|---------|
| Frontend | TanStack Start + React + Three.js | GitHub Pages (static build on `main`) |
| Export API | FastAPI + Blender headless | Local only: Docker or Blender on your machine |

The browser sends **JSON** (`ExportPayload` in `src/types/exportPayload.ts`). Python builds quad voxel meshes and returns a **`.blend`** file.

GitHub Pages ships the static app only. There is no production Docker image for the frontend. The **Export Blender** button appears only when `VITE_EXPORT_API_URL` is set at build time (e.g. `.env.local` for dev, or a GitHub Actions variable if you host a public API).

## Local development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
npm i
cp .env.example .env.local
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

**Export Blender** locally — API via Docker (not used for Pages):

```sh
npm run docker:api
```

API: http://localhost:8000 — keep it running alongside `npm run dev`.

Without Docker: [`backend/README.md`](backend/README.md).

## GitHub Pages

Pushes to `main` run `.github/workflows/deploy.yml`: `GITHUB_PAGES=true`, assets under `dist/client`, published with [peaceiris/actions-gh-pages](https://github.com/peaceiris/actions-gh-pages).

Repository **Settings → Pages**: source = deploy branch from that action (typically `gh-pages`).
