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
// API base (Vercel -> Render). If empty, we fall back to relative /api (works with Vite proxy locally)
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "";
const API_KEY = (import.meta as any).env?.VITE_APP_API_KEY || "";

// Builds absolute URL if API_BASE is set, otherwise keeps relative (local dev proxy)
function apiUrl(path: string) {
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (API_KEY) headers["x-api-key"] = API_KEY;
  return headers;
}

async function postJson<T>(path: string, body: any): Promise<T> {
  const r = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) {
    throw new Error(j?.error || `HTTP_${r.status}`);
  }
  return j.data as T;
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const r = await fetch(apiUrl(path), {
    method: "POST",
    headers: { ...authHeaders() },
    body: form,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.ok === false) {
    throw new Error(j?.error || `HTTP_${r.status}`);
  }
  return j.data as T;
}


/**
 * Downscale image to max 4K resolution before upload.
 * Reduces base64 size by up to 80% for large images, dramatically cutting
 * network transfer time to Gemini.
 */
const MAX_AI_DIMENSION = 3840; // 4K

async function compressForAI(blob: Blob): Promise<Blob> {
  // Only compress raster images
  if (!blob.type.startsWith('image/')) return blob;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;

      // Skip if already within bounds
      if (width <= MAX_AI_DIMENSION && height <= MAX_AI_DIMENSION) {
        resolve(blob);
        URL.revokeObjectURL(img.src);
        return;
      }

      const scale = Math.min(MAX_AI_DIMENSION / width, MAX_AI_DIMENSION / height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);

      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);

      canvas.toBlob(
        (result) => resolve(result || blob),
        'image/jpeg',
        0.92
      );
    };
    img.onerror = () => resolve(blob);
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Fetch any URL (blob:, data:, http:) and convert to base64 (no prefix).
 * Auto-resizes large images to 4K max before encoding.
 */
async function urlToBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  let blob = await resp.blob();
  blob = await compressForAI(blob);
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
  return _videoUrl;
}

/**
 * ------------------------------
 * Local Sharp processing (instant, no AI)
 * Maps tool IDs to backend /api/local/* endpoints.
 * These run via Sharp on the server — sub-second response.
 * ------------------------------
 */

const LOCAL_TOOL_ROUTES: Record<string, string> = {
  'enhance': '/api/local/enhance',
  'clean': '/api/local/denoise',
  'sharpness': '/api/local/sharpen',
  'watermark': '/api/local/watermark',
  'smart-crop': '/api/local/crop',
};

export async function localProcess(
  sourceUrl: string,
  toolId: string,
  extra?: { text?: string; strength?: number; aspectRatio?: string; width?: number; height?: number }
): Promise<string> {
  const route = LOCAL_TOOL_ROUTES[toolId];
  if (!route) {
    throw new Error(`No local route for tool: ${toolId}`);
  }

  const imageBase64 = await urlToBase64(sourceUrl);

  const body: any = { imageBase64 };
  if (extra?.text) body.text = extra.text;
  if (extra?.strength) body.strength = extra.strength;
  if (extra?.aspectRatio) body.aspectRatio = extra.aspectRatio;
  if (extra?.width) body.width = extra.width;
  if (extra?.height) body.height = extra.height;

  const data = await postJson<{ imageBase64: string }>(route, body);
  return base64ToDataUrl(data.imageBase64, "image/jpeg");
}
