// server/raw.routes.cjs
// -------------------------------------------------------------
// RAW endpoints for Photogenix (Docker / Render ready)
//
// Routes:
//   POST /api/raw/preview  -> multipart RAW -> JPEG preview
//   POST /api/raw/develop  -> multipart RAW -> JPEG -> Gemini
//   GET  /api/raw/diag     -> verify dcraw + imagemagick exist
//
// REQUIREMENTS (Docker image):
//   apt-get install -y dcraw imagemagick
// -------------------------------------------------------------

// server/raw.routes.cjs
// -------------------------------------------------------------
// RAW endpoints for Photogenix (Docker / Render ready)
//
// Routes:
//   POST /api/raw/preview  -> multipart RAW -> JPEG preview
//   POST /api/raw/develop  -> multipart RAW -> JPEG -> Gemini
//   GET  /api/raw/diag     -> verify dcraw + imagemagick exist
//
// REQUIREMENTS (Docker image):
//   apt-get install -y dcraw imagemagick
// -------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");

module.exports = function createRawRouter({ callGeminiImage }) {
  if (typeof callGeminiImage !== "function") {
    throw new Error("raw.routes.cjs requires callGeminiImage(parts, aspectRatio)");
  }

  const router = express.Router();

  // -------------------------------------------------------------
  // Upload configuration (disk, temp)
  // -------------------------------------------------------------
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        const dir = path.join(os.tmpdir(), "photogenix_raw");
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const id = crypto.randomBytes(8).toString("hex");
        const ext = path.extname(file.originalname || "").slice(0, 16);
        cb(null, `${Date.now()}_${id}${ext}`);
      },
    }),
    limits: {
      fileSize: Number(process.env.MAX_UPLOAD_BYTES || 60 * 1024 * 1024), // 60MB
    },
  });

  function ok(res, data) {
    return res.json({ ok: true, data });
  }

  function fail(res, status, error, details) {
    return res.status(status).json({ ok: false, error, details });
  }

  // -------------------------------------------------------------
  // Process helpers
  // -------------------------------------------------------------
  function run(cmd, args, { timeoutMs = 120_000 } = {}) {
    return new Promise((resolve, reject) => {
      const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
      const out = [];
      const err = [];

      const t = setTimeout(() => {
        try { p.kill("SIGKILL"); } catch {}
        reject(new Error(`${cmd}_TIMEOUT`));
      }, timeoutMs);

      p.stdout.on("data", (d) => out.push(d));
      p.stderr.on("data", (d) => err.push(d));

      p.on("error", (e) => {
        clearTimeout(t);
        reject(e);
      });

      p.on("close", (code) => {
        clearTimeout(t);
        const stdout = Buffer.concat(out);
        const stderr = Buffer.concat(err).toString("utf8");
        if (code === 0) return resolve({ stdout, stderr });
        reject(new Error(`${cmd}_FAILED_${code}: ${stderr}`));
      });
    });
  }

  async function hasBinary(bin) {
    try {
      await run("sh", ["-lc", `command -v ${bin}`], { timeoutMs: 8_000 });
      return true;
    } catch {
      return false;
    }
  }

  function safeUnlink(p) {
    try { if (p) fs.unlinkSync(p); } catch {}
  }

  // -------------------------------------------------------------
  // RAW -> JPEG (dcraw -> TIFF -> ImageMagick convert)
  // -------------------------------------------------------------
  async function rawToJpegBuffer(rawPath) {
    const base = rawPath.replace(/\.[^.]+$/, "");
    const tiffPath = `${base}.tiff`;
    const jpgPath = `${base}.jpg`;

    const hasDcraw = await hasBinary("dcraw");
    const hasConvert = await hasBinary("convert");

    if (!hasDcraw) throw new Error("MISSING_DEP_dcraw");
    if (!hasConvert) throw new Error("MISSING_DEP_imagemagick");

    // dcraw:
    //  -w  camera white balance
    //  -q3 AHD interpolation
    //  -6  16-bit output
    //  -T  write TIFF
    //  -O  output file
    await run(
      "dcraw",
      ["-w", "-q", "3", "-6", "-T", "-O", tiffPath, rawPath],
      { timeoutMs: 180_000 }
    );

    // ImageMagick: TIFF -> JPEG
    await run(
      "convert",
      [tiffPath, "-strip", "-quality", "92", jpgPath],
      { timeoutMs: 120_000 }
    );

    const buf = fs.readFileSync(jpgPath);

    safeUnlink(tiffPath);
    safeUnlink(jpgPath);

    return buf;
  }

  // -------------------------------------------------------------
  // Diagnostics
  // -------------------------------------------------------------
  router.get("/diag", async (_req, res) => {
    return ok(res, {
      deps: {
        dcraw: await hasBinary("dcraw"),
        convert: await hasBinary("convert"),
      },
      tmpDir: path.join(os.tmpdir(), "photogenix_raw"),
      maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 60 * 1024 * 1024),
    });
  });

  // -------------------------------------------------------------
  // Routes
  // -------------------------------------------------------------

  // POST /api/raw/preview
  router.post("/preview", upload.single("file"), async (req, res) => {
    try {
      if (!req.file?.path) throw new Error("MISSING_FILE");

      const jpgBuf = await rawToJpegBuffer(req.file.path);
      safeUnlink(req.file.path);

      return ok(res, {
        jpegBase64: jpgBuf.toString("base64"),
        jpegUrl: `data:image/jpeg;base64,${jpgBuf.toString("base64")}`,
      });
    } catch (e) {
      safeUnlink(req.file?.path);
      const msg = String(e?.message || e || "RAW_PREVIEW_FAILED");
      return fail(res, msg.startsWith("MISSING_DEP_") ? 500 : 400, msg);
    }
  });

  // POST /api/raw/develop
  router.post("/develop", upload.single("file"), async (req, res) => {
    try {
      if (!req.file?.path) throw new Error("MISSING_FILE");

      const aspectRatio = req.body?.aspectRatio;
      const prompt =
        req.body?.prompt ||
        "ACT AS RAW DEVELOPER. Recover highlights and shadows with natural tone mapping. Preserve skin tones, natural color science, and all facial features exactly as captured. Apply professional white balance and exposure correction. IMAGE ONLY.";

      const jpgBuf = await rawToJpegBuffer(req.file.path);
      const jpegBase64 = jpgBuf.toString("base64");

      safeUnlink(req.file.path);

      const imageBase64 = await callGeminiImage(
        [
          { inlineData: { data: jpegBase64, mimeType: "image/jpeg" } },
          { text: prompt },
        ],
        aspectRatio
      );

      return ok(res, {
        imageBase64,
        previewJpegBase64: jpegBase64,
        developedUrl: `data:image/jpeg;base64,${imageBase64}`,
        previewUrl: `data:image/jpeg;base64,${jpegBase64}`,
      });
    } catch (e) {
      safeUnlink(req.file?.path);
      const msg = String(e?.message || e || "RAW_DEVELOP_FAILED");
      return fail(res, msg.startsWith("MISSING_DEP_") ? 500 : 400, msg);
    }
  });

  return router;
};