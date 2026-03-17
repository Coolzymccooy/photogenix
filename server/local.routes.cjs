// server/local.routes.cjs
// -------------------------------------------------------------
// Local Sharp-based image processing — instant, no AI round-trip.
//
// These routes handle operations that DON'T need Gemini:
//   POST /api/local/enhance    -> auto levels, contrast, saturation
//   POST /api/local/sharpen    -> unsharp mask
//   POST /api/local/denoise    -> median/blur noise reduction
//   POST /api/local/watermark  -> text overlay via SVG composite
//   POST /api/local/crop       -> smart crop (center-weighted)
//   POST /api/local/resize     -> resize to target dimensions
//
// All accept { imageBase64 } in JSON body, return { imageBase64 }.
// Responses are sub-second on any modern machine.
// -------------------------------------------------------------

const express = require("express");
const sharp = require("sharp");

module.exports = function createLocalRouter() {
  const router = express.Router();

  function ok(res, data) {
    return res.json({ ok: true, data });
  }
  function fail(res, status, error) {
    return res.status(status).json({ ok: false, error });
  }

  /**
   * Decode base64 image to Sharp instance
   */
  function fromBase64(b64) {
    const buf = Buffer.from(b64, "base64");
    return sharp(buf);
  }

  /**
   * Encode Sharp pipeline result back to base64 JPEG
   */
  async function toBase64(pipeline, quality = 92) {
    const buf = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
    return buf.toString("base64");
  }

  // ----- ENHANCE: auto-levels, contrast boost, slight saturation -----
  router.post("/enhance", async (req, res) => {
    try {
      const { imageBase64 } = req.body || {};
      if (!imageBase64) return fail(res, 400, "MISSING_FIELD_imageBase64");

      const img = fromBase64(imageBase64);
      const metadata = await img.metadata();

      // Normalize (stretch histogram), boost contrast, light saturation lift
      const enhanced = sharp(await img.toBuffer())
        .normalize()                          // auto-levels
        .modulate({ brightness: 1.02, saturation: 1.12 })  // subtle boost
        .sharpen({ sigma: 0.8, m1: 0.5, m2: 0.3 })        // light sharpen
        .gamma(1.05);                         // slight mid-tone lift

      return ok(res, { imageBase64: await toBase64(enhanced) });
    } catch (e) {
      return fail(res, 500, e?.message || "ENHANCE_FAILED");
    }
  });

  // ----- SHARPEN: unsharp mask for blur/shake recovery -----
  router.post("/sharpen", async (req, res) => {
    try {
      const { imageBase64, strength } = req.body || {};
      if (!imageBase64) return fail(res, 400, "MISSING_FIELD_imageBase64");

      const s = Number(strength) || 2;
      const sigma = Math.max(0.5, Math.min(s, 5));

      const sharpened = fromBase64(imageBase64)
        .sharpen({ sigma, m1: 1.0, m2: 0.5 });

      return ok(res, { imageBase64: await toBase64(sharpened) });
    } catch (e) {
      return fail(res, 500, e?.message || "SHARPEN_FAILED");
    }
  });

  // ----- DENOISE: median filter for noise reduction -----
  router.post("/denoise", async (req, res) => {
    try {
      const { imageBase64, strength } = req.body || {};
      if (!imageBase64) return fail(res, 400, "MISSING_FIELD_imageBase64");

      const s = Number(strength) || 3;
      const size = Math.max(3, Math.min(Math.round(s) | 1, 7)); // odd number 3-7

      const denoised = fromBase64(imageBase64)
        .median(size)
        .sharpen({ sigma: 0.5, m1: 0.3, m2: 0.2 }); // recover some detail after denoise

      return ok(res, { imageBase64: await toBase64(denoised) });
    } catch (e) {
      return fail(res, 500, e?.message || "DENOISE_FAILED");
    }
  });

  // ----- WATERMARK: SVG text overlay -----
  router.post("/watermark", async (req, res) => {
    try {
      const { imageBase64, text } = req.body || {};
      if (!imageBase64) return fail(res, 400, "MISSING_FIELD_imageBase64");
      const watermarkText = text || "PHOTOGENIX";

      const img = fromBase64(imageBase64);
      const meta = await img.metadata();
      const w = meta.width || 1920;
      const h = meta.height || 1080;

      const fontSize = Math.max(16, Math.round(w * 0.03));
      const padding = Math.round(w * 0.03);

      // Create SVG watermark overlay
      const svgText = `
        <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
          <text
            x="${w - padding}"
            y="${h - padding}"
            text-anchor="end"
            font-family="Arial, Helvetica, sans-serif"
            font-size="${fontSize}"
            font-weight="bold"
            fill="white"
            opacity="0.35"
            letter-spacing="2"
          >${watermarkText.replace(/[<>&"']/g, '')}</text>
        </svg>
      `;

      const watermarked = sharp(await img.toBuffer())
        .composite([{
          input: Buffer.from(svgText),
          gravity: "southeast",
        }]);

      return ok(res, { imageBase64: await toBase64(watermarked) });
    } catch (e) {
      return fail(res, 500, e?.message || "WATERMARK_FAILED");
    }
  });

  // ----- CROP: center-weighted smart crop -----
  router.post("/crop", async (req, res) => {
    try {
      const { imageBase64, aspectRatio } = req.body || {};
      if (!imageBase64) return fail(res, 400, "MISSING_FIELD_imageBase64");

      const img = fromBase64(imageBase64);
      const meta = await img.metadata();
      const w = meta.width || 1920;
      const h = meta.height || 1080;

      // Parse aspect ratio (default: rule-of-thirds center crop at 90%)
      let targetW = Math.round(w * 0.9);
      let targetH = Math.round(h * 0.9);

      if (aspectRatio) {
        const parts = aspectRatio.split(":").map(Number);
        if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
          const ratio = parts[0] / parts[1];
          if (w / h > ratio) {
            targetW = Math.round(h * ratio);
            targetH = h;
          } else {
            targetW = w;
            targetH = Math.round(w / ratio);
          }
        }
      }

      const cropped = sharp(await img.toBuffer())
        .resize(targetW, targetH, {
          fit: "cover",
          position: "attention",  // Sharp's smart crop (entropy-based)
        });

      return ok(res, { imageBase64: await toBase64(cropped) });
    } catch (e) {
      return fail(res, 500, e?.message || "CROP_FAILED");
    }
  });

  // ----- RESIZE: target dimensions -----
  router.post("/resize", async (req, res) => {
    try {
      const { imageBase64, width, height } = req.body || {};
      if (!imageBase64) return fail(res, 400, "MISSING_FIELD_imageBase64");

      const resized = fromBase64(imageBase64)
        .resize(
          Number(width) || undefined,
          Number(height) || undefined,
          { fit: "inside", withoutEnlargement: true }
        );

      return ok(res, { imageBase64: await toBase64(resized) });
    } catch (e) {
      return fail(res, 500, e?.message || "RESIZE_FAILED");
    }
  });

  return router;
};
