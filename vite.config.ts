import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";

// GitHub Pages serves static files only. Skip Nitro (worker/SSR bundle) and let the
// TanStack Start client build + prerender emit HTML assets under dist/client.
const githubPages = process.env.GITHUB_PAGES === "true";

const baseUrl = process.env.VITE_BASE_URL ?? "/";
const routerBasepath =
  baseUrl === "/" ? "/" : baseUrl.replace(/\/+$/, "") || "/";

export default defineConfig({
  base: baseUrl,
  preview: {
    host: "127.0.0.1",
  },
  plugins: [
    tsConfigPaths(),
    tanstackStart({
      server: { entry: "server" },
      ...(githubPages
        ? {
            router: { basepath: routerBasepath },
            spa: {
              prerender: {
                outputPath: "/index",
              },
            },
          }
        : {}),
    }),
    viteReact(),
    tailwindcss(),
    ...(githubPages ? [] : [nitro()]),
  ],
});
