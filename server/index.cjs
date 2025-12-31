// server/index.cjs (CommonJS - Render/Vercel friendly)
// - Keeps GEMINI_API_KEY on the server
// - Adds RAW upload support (dcraw + ImageMagick via Docker image)
// - Safe CORS (supports comma-separated origins)

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");

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
const multer = require("multer");
const { GoogleGenAI, Type } = require("@google/genai");

const app = express();

const PORT = Number(process.env.PORT || 5051);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Render/Vercel origins (comma-separated supported)
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3080";
const ALLOWED_ORIGINS = CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!GEMINI_API_KEY) {
  console.warn("[photogenix-backend] Missing GEMINI_API_KEY (set it in Render env vars)");
}

// Base64 endpoints (JSON) — keep a limit, but RAW should use multipart below.
const JSON_LIMIT = process.env.JSON_LIMIT || "35mb";
app.use(express.json({ limit: JSON_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_LIMIT }));

app.use(
  cors({
    origin: (origin, cb) => {
      // allow server-to-server / curl (no Origin)
      if (!origin) return cb(null, true);

      // allow listed origins
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: false,
  })
);

const createRawRouter = require("./raw.routes.cjs");

// mount: /api/raw/preview and /api/raw/develop
app.use("/api/raw", createRawRouter({ callGeminiImage }));
// Health check
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, ts: Date.now(), origins: ALLOWED_ORIGINS })
);

// Simple in-memory rate limiter (per IP)
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

app.use("/api", rateLimit);

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

// ---------- Gemini image calls ----------
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

// ---------- RAW conversion (dcraw + ImageMagick) ----------
// This expects your Render service to be built from Docker with:
//   apt-get install -y dcraw imagemagick
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(os.tmpdir(), "photogenix");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const id = crypto.randomBytes(8).toString("hex");
      const ext = path.extname(file.originalname || "").slice(0, 12);
      cb(null, `${Date.now()}_${id}${ext}`);
    },
  }),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024) }, // 50MB default
});

function run(cmd, args, { timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const t = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`${cmd}_TIMEOUT`));
    }, timeoutMs);

    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(t);
      if (code === 0) return resolve({ out, err });
      reject(new Error(`${cmd}_FAILED_${code}: ${err || out}`));
    });
  });
}

/**
 * Convert RAW to JPEG using:
 *  dcraw -> PPM/TIFF -> ImageMagick convert -> JPEG
 */
async function rawToJpegBase64(rawPath) {
  const base = rawPath.replace(/\.[^.]+$/, "");
  const ppmPath = `${base}.ppm`;
  const jpgPath = `${base}.jpg`;

  // dcraw:
  // -c: write to stdout (but we write to ppm file for stability)
  // -w: use camera white balance
  // -q 3: AHD interpolation
  // -6: 16-bit output (better for convert)
  await run("dcraw", ["-w", "-q", "3", "-6", "-c", rawPath], { timeoutMs: 90_000 })
    .then(({ out }) => fs.writeFileSync(ppmPath, out, "binary"))
    .catch(async (e) => {
      // some dcraw builds don't like stdout capture; fallback to dcraw writing files
      // (dcraw without -c writes a .ppm next to input)
      await run("dcraw", ["-w", "-q", "3", "-6", rawPath], { timeoutMs: 90_000 });
      // dcraw output is <base>.ppm
      if (!fs.existsSync(ppmPath)) throw e;
    });

  // convert PPM -> JPEG (strip metadata)
  await run("convert", [ppmPath, "-strip", "-quality", "92", jpgPath], {
    timeoutMs: 90_000,
  });

  const buf = fs.readFileSync(jpgPath);
  const b64 = buf.toString("base64");

  // cleanup
  try { fs.unlinkSync(ppmPath); } catch {}
  try { fs.unlinkSync(jpgPath); } catch {}

  return b64;
}

// ---------- Routes ----------


// (1) Convert RAW to JPEG preview (for UI + to avoid browser RAW limitations)
//app.post("/api/raw/preview", upload.single("file"), async (req, res) => {
  //try {
  //  if (!req.file?.path) throw new Error("MISSING_FILE");
  //  const jpegBase64 = await rawToJpegBase64(req.file.path);
   // cleanup uploaded raw
   // try { fs.unlinkSync(req.file.path); } catch {}
   // return ok(res, { jpegBase64 });
 // } catch (e) {
 //   return fail(res, 400, e?.message || "RAW_PREVIEW_FAILED");
//  }
//});




// Existing JSON endpoints (JPEG/base64)
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

app.post("/api/ai/super-process", async (req, res) => {
  try {
    const { imageBase64 } = req.body || {};
    requireBodyFields(req.body, ["imageBase64"]);

    const prompt =
      "ACT AS PRO PHOTO ENGINE. High fidelity 16-bit reconstruction. Professional lighting pass. IMAGE ONLY.";

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

// Global error handler (keeps logs helpful on Render)
app.use((err, _req, res, _next) => {
  const msg = String(err?.message || err || "SERVER_ERROR");
  if (msg === "CORS_NOT_ALLOWED") {
    return res.status(403).json({ ok: false, error: "CORS_NOT_ALLOWED" });
  }
  console.error("[photogenix-backend] error:", msg);
  return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[photogenix-backend] listening on http://localhost:${PORT}`);
  console.log(`[photogenix-backend] CORS_ORIGIN=${ALLOWED_ORIGINS.join(",")}`);
});
