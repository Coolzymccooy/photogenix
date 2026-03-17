// server/index.cjs (CommonJS - Render/Vercel friendly)
// - Keeps GEMINI_API_KEY on the server
// - Adds RAW upload support (dcraw + ImageMagick via Docker image) via ./raw.routes.cjs
// - Safe CORS (supports comma-separated origins)
// - API key authentication for all AI endpoints

const fs = require("fs");
const path = require("path");

// Load local env only if it exists (Render uses dashboard env vars)
const envPath = path.join(process.cwd(), "server", ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  require("dotenv").config();
}

console.log("GEMINI_API_KEY loaded?", !!process.env.GEMINI_API_KEY);

const express = require("express");
const cors = require("cors");
const { GoogleGenAI, Type } = require("@google/genai");

const app = express();

const PORT = Number(process.env.PORT || 5051);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const APP_API_KEY = process.env.APP_API_KEY;

// Render/Vercel origins (comma-separated supported)
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3080";
const ALLOWED_ORIGINS = CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!GEMINI_API_KEY) {
  console.warn(
    "[photogenix-backend] Missing GEMINI_API_KEY (set it in Render env vars)"
  );
}

// Base64 endpoints (JSON) — keep a limit, but RAW uses multipart in raw.routes.cjs.
const JSON_LIMIT = process.env.JSON_LIMIT || "35mb";
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_LIMIT }));

app.use(
  cors({
    origin: (origin, cb) => {
      // allow server-to-server / curl (no Origin)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: false,
  })
);

// ------------------------
// Helpers / wrappers
// ------------------------
function ok(res, data) {
  return res.json({ ok: true, data });
}
function fail(res, status, error, details) {
  return res.status(status).json({ ok: false, error, details });
}
function requireBodyFields(body, fields) {
  for (const f of fields) {
    if (body?.[f] === undefined || body?.[f] === null || body?.[f] === "") {
      throw new Error(`MISSING_FIELD_${f}`);
    }
  }
}

function getAI() {
  if (!GEMINI_API_KEY) throw new Error("MISSING_GEMINI_API_KEY");
  return new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

/**
 * Validate that base64 string is actually an image (check magic bytes).
 * Prevents arbitrary data from being sent to Gemini.
 */
function validateImageBase64(b64) {
  if (!b64 || typeof b64 !== "string" || b64.length < 8) {
    throw new Error("INVALID_IMAGE_DATA");
  }
  // Decode first 4 bytes to check magic numbers
  const head = Buffer.from(b64.slice(0, 16), "base64");
  const isJPEG = head[0] === 0xff && head[1] === 0xd8;
  const isPNG = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  const isWebP = head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46;
  const isBMP = head[0] === 0x42 && head[1] === 0x4d;
  const isGIF = head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46;
  if (!isJPEG && !isPNG && !isWebP && !isBMP && !isGIF) {
    throw new Error("INVALID_IMAGE_FORMAT");
  }
}

// ------------------------
// API key authentication middleware
// Protects AI endpoints from unauthorized access.
// If APP_API_KEY is set, clients must send x-api-key header.
// ------------------------
function requireApiKey(req, res, next) {
  if (!APP_API_KEY) return next(); // skip if not configured
  const clientKey = req.headers["x-api-key"];
  if (clientKey === APP_API_KEY) return next();
  return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
}

// ------------------------
// Health check (no auth required)
// ------------------------
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, ts: Date.now(), origins: ALLOWED_ORIGINS })
);

// ------------------------
// Simple in-memory rate limiter (per IP)
// ------------------------
const BUCKET = new Map();
const WINDOW_MS = 60_000;
const MAX_REQ_PER_WINDOW = Number(process.env.RATE_LIMIT_PER_MIN || 45);

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

// Apply limiter + auth to ALL /api routes
app.use("/api", rateLimit);
app.use("/api/ai", requireApiKey);
app.use("/api/local", requireApiKey);
app.use("/api/raw", requireApiKey);

// -------------------------------------------------------------
// Gemini image calls
// -------------------------------------------------------------
const MODEL_NAME = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

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

// Face/subject preservation directive prepended to all image generation prompts
const FACE_PRESERVATION_DIRECTIVE = `CRITICAL CONSTRAINT: You MUST preserve all human faces, facial features, body proportions, and anatomical details EXACTLY as they appear in the original image. Do NOT alter, distort, exaggerate, smooth, reshape, or stylize any face, skin texture, eye shape, nose, mouth, hair, or body part unless the user EXPLICITLY requests facial modification. Maintain the subject's identity, expression, and likeness with photographic accuracy. This applies to ALL people in the image.`;

async function callGeminiImage(parts, aspectRatio) {
  const ai = getAI();

  const config = {};
  if (aspectRatio && ASPECT_RATIO_MAP[aspectRatio]) {
    config.imageConfig = { aspectRatio: ASPECT_RATIO_MAP[aspectRatio] };
  }

  // Inject face preservation into any text prompt
  const enhancedParts = parts.map((p) => {
    if (p.text) {
      return { text: `${FACE_PRESERVATION_DIRECTIVE}\n\n${p.text}` };
    }
    return p;
  });

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: { parts: enhancedParts },
    config,
  });

  const resultPart =
    response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData) || null;

  if (resultPart?.inlineData?.data) return resultPart.inlineData.data;

  throw new Error("AI_NO_IMAGE_RETURNED");
}

// -------------------------------------------------------------
// Local Sharp processing (instant, no AI) — mounted BEFORE AI routes
// -------------------------------------------------------------
const createLocalRouter = require("./local.routes.cjs");
app.use("/api/local", createLocalRouter());

// -------------------------------------------------------------
// RAW Router Mount
// -------------------------------------------------------------
const createRawRouter = require("./raw.routes.cjs");
app.use("/api/raw", createRawRouter({ callGeminiImage }));

// -------------------------------------------------------------
// JSON endpoints (JPEG/base64)
// -------------------------------------------------------------
app.post("/api/ai/transform-image", async (req, res) => {
  try {
    const { imageBase64, instruction, aspectRatio } = req.body || {};
    requireBodyFields(req.body, ["imageBase64", "instruction"]);
    validateImageBase64(imageBase64);

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
    imagesBase64.forEach(validateImageBase64);

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
    validateImageBase64(imageBase64);

    const prompt = `Apply a professional transparent text watermark that says "${watermarkText}". Place it subtly in the bottom right corner. Blend it with image lighting. Do not modify any part of the image content. IMAGE ONLY.`;

    const img = await callGeminiImage([
      { inlineData: { data: imageBase64, mimeType: "image/jpeg" } },
      { text: prompt },
    ]);

    return ok(res, { imageBase64: img });
  } catch (e) {
    return fail(res, 400, e?.message || "WATERMARK_FAILED");
  }
});

app.post("/api/ai/super-process", async (req, res) => {
  try {
    const { imageBase64 } = req.body || {};
    requireBodyFields(req.body, ["imageBase64"]);
    validateImageBase64(imageBase64);

    const prompt = `ACT AS A PROFESSIONAL PHOTO RETOUCHING ENGINE.
Perform high-fidelity enhancement:
- Improve lighting balance and dynamic range
- Enhance micro-contrast and color depth
- Reduce noise while preserving fine detail
- Apply subtle professional color grading
OUTPUT the enhanced image. IMAGE ONLY.`;

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
    validateImageBase64(imageBase64);

    const r = Number(radius ?? 15);
    const prompt = `Remove the blemish/imperfection at position [X:${Number(x).toFixed(2)}%, Y:${Number(y).toFixed(2)}%] within a ${r}px radius. Reconstruct the area seamlessly using surrounding texture. Do not alter anything outside the specified area. IMAGE ONLY.`;

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
    validateImageBase64(imageBase64);

    const ai = getAI();
    const prompt =
      "Analyze this image as a professional photographer. Provide JSON scores and critique.";

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_TEXT_MODEL || "gemini-3-flash-preview",
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

// Global error handler
app.use((err, _req, res, _next) => {
  const msg = String(err?.message || err || "SERVER_ERROR");
  console.error("[photogenix-backend] error:", msg);
  return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[photogenix-backend] listening on http://localhost:${PORT}`);
  console.log(
    `[photogenix-backend] CORS_ORIGIN=${ALLOWED_ORIGINS.join(",") || "(none)"}`
  );
  console.log(
    `[photogenix-backend] API_KEY_AUTH=${APP_API_KEY ? "ENABLED" : "DISABLED (set APP_API_KEY to enable)"}`
  );
});
