import type { ExportPayload } from "@/types/exportPayload";

const apiBase = () => (import.meta.env.VITE_EXPORT_API_URL as string | undefined)?.replace(/\/$/, "");

export const isBlendExportAvailable = () => Boolean(apiBase());

export type BlendExportError = { type: "unconfigured" | "http" | "network"; message: string };

export const requestBlendFile = async (
  payload: ExportPayload,
  signal?: AbortSignal,
): Promise<{ blob: Blob; fileName: string } | BlendExportError> => {
  const base = apiBase();
  if (!base) {
    return {
      type: "unconfigured",
      message: "Set VITE_EXPORT_API_URL to your Python export service (see README).",
    };
  }

  try {
    const res = await fetch(`${base}/v1/export/blend`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/octet-stream" },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return {
        type: "http",
        message: detail || `Export failed (${res.status})`,
      };
    }

    const fileName =
      res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "tetracubes.blend";
    const blob = await res.blob();
    return { blob, fileName };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    return { type: "network", message };
  }
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
