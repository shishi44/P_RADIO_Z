import crypto from "node:crypto";
import express from "express";
import { GoogleAuth } from "google-auth-library";
import sharp from "sharp";

const PORT = Number(process.env.PORT || 8080);
const ACCESS_TOKEN = String(process.env.P_RADIO_ACCESS_TOKEN || "");
const ALLOWED_FOLDER_ID = String(process.env.DRIVE_ALLOWED_FOLDER_ID || "").trim();
const ALLOWED_ORIGINS = new Set(String(process.env.ALLOWED_ORIGINS || "https://shishi44.github.io").split(",").map((value) => value.trim()).filter(Boolean));
const MAX_SOURCE_BYTES = Number(process.env.MAX_SOURCE_BYTES || 20 * 1024 * 1024);
const MAX_INPUT_PIXELS = Number(process.env.MAX_INPUT_PIXELS || 40_000_000);
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

if (ACCESS_TOKEN.length < 24) throw new Error("P_RADIO_ACCESS_TOKEN must be at least 24 characters.");
if (!FILE_ID_PATTERN.test(ALLOWED_FOLDER_ID)) throw new Error("DRIVE_ALLOWED_FOLDER_ID is required.");

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/drive.readonly"] });

const folderAccessCache = new Map();

async function isWithinAllowedFolder(client, initialParents) {
  const queue = [...new Set(Array.isArray(initialParents) ? initialParents : [])];
  const visited = new Set();
  let depth = 0;
  while (queue.length && depth < 8) {
    const currentLevel = queue.splice(0, queue.length);
    for (const folderId of currentLevel) {
      if (folderId === ALLOWED_FOLDER_ID) return true;
      if (visited.has(folderId)) continue;
      visited.add(folderId);
      if (!FILE_ID_PATTERN.test(folderId)) continue;
      if (folderAccessCache.has(folderId)) {
        const cached = folderAccessCache.get(folderId);
        if (cached === true) return true;
        if (Array.isArray(cached)) queue.push(...cached);
        continue;
      }
      try {
        const response = await client.request({
          url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}`,
          params: { fields: "id,parents,trashed", supportsAllDrives: true }
        });
        if (response.data?.trashed) { folderAccessCache.set(folderId, false); continue; }
        const parents = Array.isArray(response.data?.parents) ? response.data.parents : [];
        folderAccessCache.set(folderId, parents);
        queue.push(...parents);
      } catch {
        folderAccessCache.set(folderId, false);
      }
    }
    depth += 1;
  }
  return false;
}
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", true);

function sameSecret(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}
function authenticate(req, res, next) {
  const header = String(req.get("authorization") || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!sameSecret(token, ACCESS_TOKEN)) return res.status(401).json({ error: "unauthorized" });
  next();
}
function applyCors(req, res, next) {
  const origin = String(req.get("origin") || "");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Headers", "Authorization, Accept");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(origin && ALLOWED_ORIGINS.has(origin) ? 204 : 403);
  next();
}
app.use(applyCors);

app.get("/healthz", (_req, res) => res.json({ ok: true }));

app.get("/v1/images/:fileId", authenticate, async (req, res) => {
  const fileId = String(req.params.fileId || "");
  const variant = req.query.variant === "full" ? "full" : "thumb";
  if (!FILE_ID_PATTERN.test(fileId)) return res.status(400).json({ error: "invalid_file_id" });

  try {
    const client = await auth.getClient();
    const metadataResponse = await client.request({
      url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
      params: { fields: "id,name,mimeType,size,parents,trashed,capabilities(canDownload)", supportsAllDrives: true }
    });
    const metadata = metadataResponse.data || {};
    const size = Number(metadata.size || 0);
    if (metadata.trashed) return res.status(404).json({ error: "not_found" });
    if (!ALLOWED_MIME.has(String(metadata.mimeType || "").toLowerCase())) return res.status(415).json({ error: "unsupported_media_type" });
    if (!(await isWithinAllowedFolder(client, metadata.parents))) return res.status(403).json({ error: "outside_allowed_folder" });
    if (metadata.capabilities?.canDownload === false) return res.status(403).json({ error: "download_not_allowed" });
    if (!Number.isFinite(size) || size <= 0 || size > MAX_SOURCE_BYTES) return res.status(413).json({ error: "source_too_large" });

    const mediaResponse = await client.request({
      url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
      params: { alt: "media", supportsAllDrives: true },
      responseType: "arraybuffer"
    });
    const source = Buffer.from(mediaResponse.data);
    if (source.length > MAX_SOURCE_BYTES) return res.status(413).json({ error: "source_too_large" });

    const maxDimension = variant === "full" ? 2560 : 640;
    const output = await sharp(source, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
      .webp({ quality: variant === "full" ? 88 : 80, effort: 4 })
      .toBuffer();

    res.set({
      "Content-Type": "image/webp",
      "Content-Length": String(output.length),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin"
    });
    return res.send(output);
  } catch (error) {
    const status = Number(error?.response?.status || 0);
    if (status === 404) return res.status(404).json({ error: "not_found" });
    if (status === 403) return res.status(403).json({ error: "drive_forbidden" });
    console.error("image gateway error", { fileId, message: error?.message });
    return res.status(500).json({ error: "image_gateway_error" });
  }
});

app.listen(PORT, "0.0.0.0", () => console.log(`P_RADIO_Z image gateway listening on :${PORT}`));
