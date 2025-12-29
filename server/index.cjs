// server/index.cjs (CommonJS - Render safe)
const fs = require("fs");
const path = require("path");

// Load local env only if it exists (Render uses dashboard env vars)
const envPath = path.join(process.cwd(), "server", ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  require("dotenv").config(); // harmless if no file; supports local root .env too
}

console.log("GEMINI_API_KEY loaded?", !!process.env.GEMINI_API_KEY);

const express = require("express");
const cors = require("cors");
const { GoogleGenAI, Type } = require("@google/genai");

const app = express();

const PORT = Number(process.env.PORT || 5051);

// For production: set CORS_ORIGIN to your Vercel domain (https://xxx.vercel.app)
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3080";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn("[photogenix-backend] Missing GEMINI_API_KEY (set it in Render env vars)");
}

// Bigger payloads for base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: false,
  })
);

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Simple in-memory rate limiter (per IP)
const BUCKET = new Map();
const WINDOW_MS = 60_000;
const MAX_REQ_PER_WINDOW = 45;

function rateLimit(req, res, next) {
  const ip =
    (req.headers["x-forwarded-for"] || "")
      .toString()
      .split(",")[0]
      .trim() ||
    req.ip ||
    "unknown";

  const now = Date.now();
  const record = BUCKET.get(ip) || { start: now, count: 0 };

  if (now - record.start > WINDOW_MS) {
    record.start = now;
    record.count = 0;
  }

  record.count += 1;
  BUCKET.set(ip, record);

  if (record.count > MAX_REQ_PER_WINDOW) {
    return res.status(429).json({ ok: false, error: "RATE_LIMITED" });
  }
  next();
}

app.use("/api/ai", rateLimit);

// ---- Gemini helpers ----
const MODEL_NAME = "gemini-2.5-flash-image";

const ASPECT_RATIO_MAP = {
  "1:1": "1:1",
  "4:5": "3:4",
  "5:7": "3:4",
  "16:9": "16:9",
  "9:16": "9:16",
  "2:3": "3:4",
  "3:4": "3:4",
  "4:3": "4:3",
};

function getAI() {
  if (!GEMINI_API_KEY) throw new Error("MISSING_GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

async function callGeminiImage(parts, aspectRatio) {
  const ai = getAI();

  const config = {};
  if (aspectRatio && ASPECT_RATIO_MAP[aspectRatio]) {
    config.imageConfig = { aspectRatio: ASPECT_RATIO_MAP[aspectRatio] };
  }

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: { parts },
    config,
  });

  const resultPart =
    response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData) || null;

  if (resultPart?.inlineData?.data) return resultPart.inlineData.data;

  throw new Error("AI_NO_IMAGE_RETURNED");
}

function requireBodyFields(body, fields) {
  for (const f of fields) {
    if (body?.[f] === undefined || body?.[f] === null || body?.[f] === "") {
      throw new Error(`MISSING_FIELD_${f}`);
    }
  }
}

function ok(res, data) {
  return res.json({ ok: true, data });
}

function fail(res, status, error, details) {
  return res.status(status).json({ ok: false, error, details });
}

// ---- routes ----

app.post("/api/ai/transform-image", async (req, res) => {
  try {
    const { imageBase64, instruction, aspectRatio } = req.body || {};
    requireBodyFields(req.body, ["imageBase64", "instruction"]);

    const img = await callGeminiImage(
      [
        { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
        { text: instruction },
      ],
      aspectRatio
    );

    return ok(res, { imageBase64: img });
  } catch (e) {
    return fail(res, 400, e?.message || "TRANSFORM_FAILED");
  }
});

app.post("/api/ai/combine-images", async (req, res) => {
  try {
    const { imagesBase64, instruction } = req.body || {};
    requireBodyFields(req.body, ["imagesBase64", "instruction"]);

    if (!Array.isArray(imagesBase64) || imagesBase64.length < 2) {
      throw new Error("NEED_AT_LEAST_2_IMAGES");
    }

    const parts = imagesBase64.map((d) => ({
      inlineData: { data: d, mimeType: "image/jpeg" },
    }));
    parts.push({ text: instruction });

    const img = await callGeminiImage(parts);
    return ok(res, { imageBase64: img });
  } catch (e) {
    return fail(res, 400, e?.message || "COMBINE_FAILED");
  }
});

app.post("/api/ai/apply-watermark", async (req, res) => {
  try {
    const { imageBase64, watermarkText } = req.body || {};
    requireBodyFields(req.body, ["imageBase64", "watermarkText"]);

    const prompt = `Apply a professional transparent text watermark that says "${watermarkText}". Place it subtly in the bottom right corner. Blend it with image lighting. IMAGE ONLY.`;

    const img = await callGeminiImage([
      { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
      { text: prompt },
    ]);

    return ok(res, { imageBase64: img });
  } catch (e) {
    return fail(res, 400, e?.message || "WATERMARK_FAILED");
  }
});

app.post("/api/ai/develop-raw", async (req, res) => {
  try {
    const { imageBase64, extension } = req.body || {};
    requireBodyFields(req.body, ["imageBase64", "extension"]);

    const ext = String(extension).replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
    const prompt = `ACT AS RAW DEVELOPER. Format: .${ext.toUpperCase()}. Recover HDR. Neutral profile. IMAGE ONLY.`;

    const img = await callGeminiImage([
      { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
      { text: prompt },
    ]);

    return ok(res, { imageBase64: img });
  } catch (e) {
    return fail(res, 400, e?.message || "DEVELOP_RAW_FAILED");
  }
});

app.post("/api/ai/super-process", async (req, res) => {
  try {
    const { imageBase64 } = req.body || {};
    requireBodyFields(req.body, ["imageBase64"]);

    const prompt = `ACT AS PRO PHOTO ENGINE. High fidelity 16-bit reconstruction. Professional lighting pass. IMAGE ONLY.`;

    const img = await callGeminiImage([
      { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
      { text: prompt },
    ]);

    return ok(res, { imageBase64: img });
  } catch (e) {
    return fail(res, 400, e?.message || "SUPER_PROCESS_FAILED");
  }
});

app.post("/api/ai/heal-spot", async (req, res) => {
  try {
    const { imageBase64, x, y, radius } = req.body || {};
    requireBodyFields(req.body, ["imageBase64", "x", "y"]);

    const r = Number(radius ?? 15);
    const prompt = `HEAL_AREA [X:${Number(x).toFixed(2)}%, Y:${Number(y).toFixed(
      2
    )}%, RADIUS:${r}px]. Reconstruct the area. IMAGE ONLY.`;

    const img = await callGeminiImage([
      { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
      { text: prompt },
    ]);

    return ok(res, { imageBase64: img });
  } catch (e) {
    return fail(res, 400, e?.message || "HEAL_FAILED");
  }
});

app.post("/api/ai/analyze-image", async (req, res) => {
  try {
    const { imageBase64 } = req.body || {};
    requireBodyFields(req.body, ["imageBase64"]);

    const ai = getAI();
    const prompt =
      "Analyze this image as a professional photographer. Provide JSON scores and critique.";

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lightingScore: { type: Type.NUMBER },
            sharpnessScore: { type: Type.NUMBER },
            composition: { type: Type.STRING },
            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            critique: { type: Type.STRING },
          },
          required: [
            "lightingScore",
            "sharpnessScore",
            "composition",
            "colors",
            "tags",
            "critique",
          ],
        },
      },
    });

    const analysis = JSON.parse(String(response.text || "").trim() || "{}");
    return ok(res, { analysis });
  } catch (e) {
    return fail(res, 400, e?.message || "ANALYZE_FAILED");
  }
});

app.listen(PORT, () => {
  console.log(`[photogenix-backend] listening on http://localhost:${PORT}`);
  console.log(`[photogenix-backend] CORS_ORIGIN=${CORS_ORIGIN}`);
});
