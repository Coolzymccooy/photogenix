const API_BASE = (import.meta.env.VITE_API_BASE || "/api").replace(/\/$/, "");

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string; details?: any };
type ApiRes<T> = ApiOk<T> | ApiErr;

async function postForm<T>(path: string, form: FormData, timeoutMs = 180000): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    const json = (await res.json()) as ApiRes<T>;
    if (!res.ok || !json || (json as any).ok === false) {
      const err = (json as any)?.error || `HTTP_${res.status}`;
      throw new Error(err);
    }
    return (json as ApiOk<T>).data;
  } finally {
    clearTimeout(t);
  }
}

export async function rawToJpegPreview(file: File) {
  const fd = new FormData();
  fd.append("file", file);

  return postForm<{ mimeType: string; imageBase64: string }>("/raw/preview", fd);
}

export async function developRawMultipart(file: File, opts?: { prompt?: string; aspectRatio?: string }) {
  const fd = new FormData();
  fd.append("file", file);
  if (opts?.prompt) fd.append("prompt", opts.prompt);
  if (opts?.aspectRatio) fd.append("aspectRatio", opts.aspectRatio);

  return postForm<{ imageBase64: string; previewJpegBase64: string }>("/raw/develop", fd);
}
