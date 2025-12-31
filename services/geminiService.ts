/**
 * Client-side Gemini service (SAFE)
 * --------------------------------
 * This file runs in the browser.
 * Do NOT put API keys here.
 *
 * All AI operations are proxied through the backend:
 *   POST {VITE_API_BASE}/ai/*
 *   POST {VITE_API_BASE}/raw/*  (multipart for RAW bulk reliability)
 */

const PREFLIGHT_MAX_DIM = 1200;
const PREFLIGHT_QUALITY = 0.75;

export interface ImageAnalysis {
  lightingScore: number;
  sharpnessScore: number;
  composition: string;
  colors: string[];
  tags: string[];
  critique: string;
}

type ApiRes<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: any };

const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

function cleanBase64(dataUrlOrB64: string) {
  // strips "data:image/...;base64," if present
  const idx = dataUrlOrB64.indexOf("base64,");
  return idx >= 0 ? dataUrlOrB64.slice(idx + "base64,".length) : dataUrlOrB64;
}

async function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timeout = setTimeout(() => reject(new Error("FILE_READ_TIMEOUT")), 15000);
    reader.onloadend = () => {
      clearTimeout(timeout);
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Downscales/normalizes images for JSON endpoints (avoid payload blowups).
 * For RAW we do NOT base64 in the browser; we use multipart upload.
 */
export const optimizeImage = async (
  input: string | Blob,
  isUltra: boolean = false
): Promise<string> => {
  // If already a small inline image, keep it
  if (typeof input === "string" && input.startsWith("data:image/") && input.length < 500000) {
    return input;
  }

  let blob: Blob;
  if (typeof input === "string") {
    const response = await fetch(input);
    blob = await response.blob();
  } else {
    blob = input;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("NO_CANVAS_CTX");

        const maxDim = isUltra ? 1800 : PREFLIGHT_MAX_DIM;
        let { width, height } = img;

        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.floor(width * scale));
          height = Math.max(1, Math.floor(height * scale));
        }

        canvas.width = width;
        canvas.height = height;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", PREFLIGHT_QUALITY));
      } catch (e) {
        URL.revokeObjectURL(url);
        toBase64(blob).then(resolve).catch(reject);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      toBase64(blob).then(resolve).catch(reject);
    };

    img.src = url;
  });
};

async function postJson<T>(
  path: string,
  body: any,
  timeoutMs: number = 120000
): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let json: ApiRes<T> | null = null;

    try {
      json = text ? (JSON.parse(text) as ApiRes<T>) : null;
    } catch {
      // non-json response
    }

    if (!res.ok) {
      const msg =
        json && "error" in json ? json.error : `HTTP_${res.status}`;
      throw new Error(msg);
    }

    if (!json) throw new Error("BAD_RESPONSE");
    if (!("ok" in json) || json.ok !== true) {
      throw new Error((json as any)?.error || "REQUEST_FAILED");
    }

    return (json as any).data as T;
  } finally {
    clearTimeout(t);
  }
}

async function postForm<T>(
  path: string,
  formData: FormData,
  timeoutMs: number = 240000
): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    const text = await res.text();
    let json: ApiRes<T> | null = null;

    try {
      json = text ? (JSON.parse(text) as ApiRes<T>) : null;
    } catch {
      // non-json response
    }

    if (!res.ok) {
      const msg =
        json && "error" in json ? json.error : `HTTP_${res.status}`;
      throw new Error(msg);
    }

    if (!json) throw new Error("BAD_RESPONSE");
    if (!("ok" in json) || json.ok !== true) {
      throw new Error((json as any)?.error || "REQUEST_FAILED");
    }

    return (json as any).data as T;
  } finally {
    clearTimeout(t);
  }
}

/** ---------------- RAW (multipart) ---------------- */

export type RawPreviewResult = {
  previewUrl: string;      // data:image/jpeg;base64,...
  previewBase64: string;   // raw base64, no prefix
  mimeType: string;        // image/jpeg
};

export async function rawPreview(file: File): Promise<RawPreviewResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);

  const data = await postForm<{ jpegBase64: string; mimeType: string }>(
    "/raw/preview",
    fd,
    180000
  );

  const b64 = data.jpegBase64;
  const mime = data.mimeType || "image/jpeg";
  return {
    previewUrl: `data:${mime};base64,${b64}`,
    previewBase64: b64,
    mimeType: mime,
  };
}

export type RawDevelopOptions = {
  prompt?: string;
  aspectRatio?: string;
};

export type RawDevelopResult = {
  developedUrl: string;        // data:image/png;base64,...
  developedBase64: string;     // raw base64 returned from model
  previewUrl: string;          // data:image/jpeg;base64,...
  previewBase64: string;
};

export async function developRawFile(
  file: File,
  options: RawDevelopOptions = {}
): Promise<RawDevelopResult> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  if (options.prompt) fd.append("prompt", options.prompt);
  if (options.aspectRatio) fd.append("aspectRatio", options.aspectRatio);

  const data = await postForm<{
    imageBase64: string;
    previewJpegBase64: string;
  }>("/raw/develop", fd, 300000);

  const outB64 = data.imageBase64;
  const prevB64 = data.previewJpegBase64;

  return {
    developedUrl: `data:image/png;base64,${outB64}`,
    developedBase64: outB64,
    previewUrl: `data:image/jpeg;base64,${prevB64}`,
    previewBase64: prevB64,
  };
}

/**
 * Backwards-compatible helper (if any old call sites still pass a URL).
 * This will fetch the URL -> Blob and then use multipart.
 */
export async function developRaw(sourceUrl: string, _extension?: string): Promise<string> {
  const resp = await fetch(sourceUrl);
  const blob = await resp.blob();
  const file = new File([blob], `upload.${_extension || "dng"}`, { type: blob.type || "application/octet-stream" });
  const r = await developRawFile(file);
  return r.developedUrl;
}

/** ---------------- Existing JSON endpoints ---------------- */

export const superProcess = async (imageBase64: string): Promise<string> => {
  const optimized = await optimizeImage(imageBase64, true);
  const data = await postJson<{ imageBase64: string }>("/ai/super-process", {
    imageBase64: cleanBase64(optimized),
  });
  return `data:image/png;base64,${data.imageBase64}`;
};

export const transformImage = async (
  imageBase64: string,
  instruction: string,
  aspectRatio?: string
): Promise<string> => {
  const optimized = await optimizeImage(imageBase64);
  const data = await postJson<{ imageBase64: string }>("/ai/transform-image", {
    imageBase64: cleanBase64(optimized),
    instruction,
    aspectRatio,
  });
  return `data:image/png;base64,${data.imageBase64}`;
};

export const combineImages = async (
  images: string[],
  instruction: string
): Promise<string> => {
  const optimized = await Promise.all(images.map((i) => optimizeImage(i)));
  const data = await postJson<{ imageBase64: string }>("/ai/combine-images", {
    imagesBase64: optimized.map(cleanBase64),
    instruction,
  });
  return `data:image/png;base64,${data.imageBase64}`;
};

export const applyWatermark = async (
  imageBase64: string,
  watermarkText: string
): Promise<string> => {
  const optimized = await optimizeImage(imageBase64);
  const data = await postJson<{ imageBase64: string }>("/ai/apply-watermark", {
    imageBase64: cleanBase64(optimized),
    watermarkText,
  });
  return `data:image/png;base64,${data.imageBase64}`;
};

export const healSpot = async (
  imageBase64: string,
  x: number,
  y: number,
  radius: number = 15
): Promise<string> => {
  const optimized = await optimizeImage(imageBase64);
  const data = await postJson<{ imageBase64: string }>("/ai/heal-spot", {
    imageBase64: cleanBase64(optimized),
    x,
    y,
    radius,
  });
  return `data:image/png;base64,${data.imageBase64}`;
};

export const analyzeImage = async (imageBase64: string): Promise<ImageAnalysis> => {
  const optimized = await optimizeImage(imageBase64);
  const data = await postJson<{ analysis: ImageAnalysis }>("/ai/analyze-image", {
    imageBase64: cleanBase64(optimized),
  });
  return data.analysis;
};

// Video mock (keep for now)
export const transformVideoMock = async (sourceUrl: string): Promise<string> => {
  // Placeholder: do nothing
  return sourceUrl;
};
