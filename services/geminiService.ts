/**
 * Client-side Gemini service (SAFE)
 * --------------------------------
 * This file runs in the browser.
 * Do NOT put API keys here.
 *
 * All AI operations are proxied through the backend:
 *   POST {VITE_API_BASE}/ai/*
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

const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

const cleanBase64 = (dataUrl: string): string =>
  dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

const toBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timeout = setTimeout(() => reject(new Error("FILE_READ_TIMEOUT")), 15000);
    reader.onloadend = () => {
      clearTimeout(timeout);
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

export const optimizeImage = async (
  input: string | Blob,
  isUltra: boolean = false
): Promise<string> => {
  // If already a small inline image, keep it as-is
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
      URL.revokeObjectURL(url);

      const maxDim = isUltra ? 2048 : PREFLIGHT_MAX_DIM;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d", { alpha: false });
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", PREFLIGHT_QUALITY));
      } else {
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

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string; details?: any };
type ApiRes<T> = ApiOk<T> | ApiErr;

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
        (json && "error" in json && json.error) ||
        `HTTP_${res.status} ${res.statusText || ""}`.trim();
      throw new Error(msg);
    }

    if (!json) throw new Error("EMPTY_RESPONSE");
    if (!("ok" in json) || json.ok !== true) {
      throw new Error((json as ApiErr)?.error || "API_ERROR");
    }

    return (json as ApiOk<T>).data;
  } finally {
    clearTimeout(t);
  }
}

// ===== AI wrappers (browser -> backend) =====

export const applyWatermark = async (
  imageBase64: string,
  watermarkText: string
): Promise<string> => {
  const optimized = await optimizeImage(imageBase64, true);
  const data = await postJson<{ imageBase64: string }>("/ai/apply-watermark", {
    imageBase64: cleanBase64(optimized),
    watermarkText,
  });
  return `data:image/png;base64,${data.imageBase64}`;
};

export const developRaw = async (sourceUrl: string, extension: string): Promise<string> => {
  const optimized = await optimizeImage(sourceUrl);
  const data = await postJson<{ imageBase64: string }>("/ai/develop-raw", {
    imageBase64: cleanBase64(optimized),
    extension,
  });
  return `data:image/png;base64,${data.imageBase64}`;
};

export const superProcess = async (imageBase64: string): Promise<string> => {
  const optimized = await optimizeImage(imageBase64, true);
  const data = await postJson<{ imageBase64: string }>("/ai/super-process", {
    imageBase64: cleanBase64(optimized),
  });
  return `data:image/png;base64,${data.imageBase64}`;
};

export const healSpot = async (
  imageBase64: string,
  x: number,
  y: number,
  radius: number = 15
): Promise<string> => {
  const optimized = await optimizeImage(imageBase64, true);
  const data = await postJson<{ imageBase64: string }>("/ai/heal-spot", {
    imageBase64: cleanBase64(optimized),
    x,
    y,
    radius,
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

export const combineImages = async (imagesBase64: string[], instruction: string): Promise<string> => {
  const processed = await Promise.all(
    imagesBase64.map(async (img) => cleanBase64(await optimizeImage(img)))
  );

  const data = await postJson<{ imageBase64: string }>("/ai/combine-images", {
    imagesBase64: processed,
    instruction,
  });

  return `data:image/png;base64,${data.imageBase64}`;
};

export const transformVideoMock = async (url: string): Promise<string> =>
  new Promise((r) => setTimeout(() => r(url), 1000));

export const analyzeImage = async (imageBase64: string): Promise<ImageAnalysis | null> => {
  try {
    const optimized = await optimizeImage(imageBase64);
    const data = await postJson<{ analysis: ImageAnalysis }>("/ai/analyze-image", {
      imageBase64: cleanBase64(optimized),
    });
    return data.analysis;
  } catch {
    return null;
  }
};
