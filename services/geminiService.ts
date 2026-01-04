/**
 * Client-side Gemini service (SAFE)
 * -------------------------------------------------------
 * IMPORTANT SECURITY NOTE:
 * - Never put API keys in the browser.
 * - All AI operations are proxied through the backend at /api/*
 *
 * This file supports:
 * - /api/ai/transform-image
 * - /api/ai/combine-images
 * - /api/ai/apply-watermark
 * - /api/ai/super-process
 * - /api/ai/heal-spot
 * - /api/ai/analyze-image
 * - RAW (multipart): /api/raw/develop
 */

type ApiOk<T> = { ok: true; data: T };
type ApiFail = { ok: false; error: string; details?: any };
type ApiRes<T> = ApiOk<T> | ApiFail;


/**
 * Build a correct backend URL.
 * - If VITE_API_BASE_URL is set (Vercel prod), we call https://...onrender.com/api/...
 * - If empty (local dev with Vite proxy), we call /api/...
 *
 * Back-compat:
 * - callers might pass "/ai/..." or "/raw/..." -> we auto-prefix "/api"
 */
// ✅ API base (Vercel -> Render). If empty, we fall back to relative /api (works with Vite proxy locally)
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "";

// Builds absolute URL if API_BASE is set, otherwise keeps relative (local dev proxy)
function apiUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

async function postJson<T>(path: string, body: any): Promise<T> {
  const r = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) {
    throw new Error(j?.error || `HTTP_${r.status}`);
  }
  return j.data as T;
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const r = await fetch(apiUrl(path), { method: "POST", body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) {
    throw new Error(j?.error || `HTTP_${r.status}`);
  }
  return j.data as T;
}


/**
 * Fetch any URL (blob:, data:, http:) and convert to base64 (no prefix)
 */
async function urlToBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return blobToBase64(blob);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("FILE_READER_FAILED"));
    reader.onload = () => {
      const result = String(reader.result || "");
      // result is like "data:image/jpeg;base64,AAAA"
      const b64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(b64);
    };
    reader.readAsDataURL(blob);
  });
}

function base64ToDataUrl(b64: string, mime = "image/png") {
  return `data:${mime};base64,${b64}`;
}

/**
 * ------------------------------
 * RAW (multipart) endpoints
 * ------------------------------
 */

export type DevelopRawResult = {
  imageUrl: string;        // new name
  previewUrl?: string;
  // ✅ backward compatible names expected by your App.tsx
  developedUrl: string;    // old name
};

export async function developRawFromFile(
  file: File,
  opts?: { prompt?: string; aspectRatio?: string }
): Promise<DevelopRawResult> {
  const form = new FormData();
  form.append("file", file);
  if (opts?.prompt) form.append("prompt", opts.prompt);
  if (opts?.aspectRatio) form.append("aspectRatio", opts.aspectRatio);

  const data = await postForm<{ imageBase64: string; previewJpegBase64?: string }>(
    "/api/raw/develop",
    form
  );

  const imageUrl = `data:image/jpeg;base64,${data.imageBase64}`;
  const previewUrl = data.previewJpegBase64
    ? `data:image/jpeg;base64,${data.previewJpegBase64}`
    : undefined;

  // ✅ return BOTH shapes so App.tsx won’t break
  return { imageUrl, previewUrl, developedUrl: imageUrl };
}

// ✅ export alias so your existing imports don’t break
export const developRawFile = developRawFromFile;


/**
 * Back-compat: keep old signature (sourceUrl + extension) so existing code still works.
 * We fetch the URL -> convert to File -> call multipart endpoint.
 */
export const developRaw = async (
  sourceUrl: string,
  extension: string
): Promise<string> => {
  const blob = await fetch(sourceUrl).then((r) => r.blob());
  const file = new File([blob], `upload.${extension || "raw"}`);
  const out = await developRawFromFile(file);
  return out.imageUrl;
};

/**
 * ------------------------------
 * Existing AI endpoints
 * ------------------------------
 */

export async function transformImage(
  sourceUrl: string,
  instruction: string,
  aspectRatio?: string
): Promise<string> {
  const imageBase64 = await urlToBase64(sourceUrl);

  const data = await postJson<{ imageBase64: string }>("/ai/transform-image", {
    imageBase64,
    instruction,
    aspectRatio,
  });

  return base64ToDataUrl(data.imageBase64, "image/png");
}

export async function combineImages(
  sourceUrls: string[],
  instruction: string
): Promise<string> {
  const imagesBase64 = await Promise.all(sourceUrls.map(urlToBase64));

  const data = await postJson<{ imageBase64: string }>("/ai/combine-images", {
    imagesBase64,
    instruction,
  });

  return base64ToDataUrl(data.imageBase64, "image/png");
}

export async function applyWatermark(
  sourceUrl: string,
  watermarkText: string
): Promise<string> {
  const imageBase64 = await urlToBase64(sourceUrl);

  const data = await postJson<{ imageBase64: string }>("/ai/apply-watermark", {
    imageBase64,
    watermarkText,
  });

  return base64ToDataUrl(data.imageBase64, "image/png");
}

export async function superProcess(sourceUrl: string): Promise<string> {
  const imageBase64 = await urlToBase64(sourceUrl);

  const data = await postJson<{ imageBase64: string }>("/ai/super-process", {
    imageBase64,
  });

  return base64ToDataUrl(data.imageBase64, "image/png");
}

export async function healSpot(
  sourceUrl: string,
  x: number,
  y: number,
  radius: number
): Promise<string> {
  const imageBase64 = await urlToBase64(sourceUrl);

  const data = await postJson<{ imageBase64: string }>("/ai/heal-spot", {
    imageBase64,
    x,
    y,
    radius,
  });

  return base64ToDataUrl(data.imageBase64, "image/png");
}

export async function analyzeImage(sourceUrl: string): Promise<any> {
  const imageBase64 = await urlToBase64(sourceUrl);

  const data = await postJson<{ analysis: any }>("/ai/analyze-image", {
    imageBase64,
  });

  return data.analysis;
}

/**
 * Keep this if other files import it (even if it's mock)
 */
export async function transformVideoMock(_videoUrl: string): Promise<string> {
  // You can replace with real server video pipeline later
  return _videoUrl;
}
