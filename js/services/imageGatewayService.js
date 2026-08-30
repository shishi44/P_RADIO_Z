import { APP_CONFIG } from "../config/appConfig.js?v=40";

const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const objectUrlCache = new Map();
const MAX_CACHE_ENTRIES = 40;

function validateConfig(connection) {
  const baseUrl = String(connection?.imageGatewayUrl ?? "").trim().replace(/\/$/, "");
  const token = String(connection?.imageGatewayToken ?? "").trim();
  if (!baseUrl) throw new Error("画像ゲートウェイURLが設定されていません。");
  if (!token) throw new Error("画像ゲートウェイのアクセスキーが設定されていません。");
  return { baseUrl, token };
}
function validateFileId(fileId) {
  const value = String(fileId ?? "").trim();
  if (!FILE_ID_PATTERN.test(value)) throw new Error("画像IDの形式が不正です。");
  return value;
}
function cacheKey(connection, fileId, variant) {
  return `${connection?.imageGatewayUrl || ""}|${fileId}|${variant}`;
}
function remember(key, objectUrl) {
  if (objectUrlCache.has(key)) return objectUrl;
  objectUrlCache.set(key, objectUrl);
  if (objectUrlCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = objectUrlCache.keys().next().value;
    const oldestUrl = objectUrlCache.get(oldestKey);
    objectUrlCache.delete(oldestKey);
    if (oldestUrl) URL.revokeObjectURL(oldestUrl);
  }
  return objectUrl;
}

export async function loadImageObjectUrl(image, connection, { variant = "thumb", signal } = {}) {
  const fileId = validateFileId(image?.fileId);
  if (!new Set(["thumb", "full"]).has(variant)) throw new Error("画像サイズ指定が不正です。");
  const key = cacheKey(connection, fileId, variant);
  if (objectUrlCache.has(key)) return objectUrlCache.get(key);
  const { baseUrl, token } = validateConfig(connection);
  const url = new URL(`${baseUrl}/v1/images/${encodeURIComponent(fileId)}`);
  url.searchParams.set("variant", variant);

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "image/avif,image/webp,image/png,image/jpeg" },
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal
  });
  if (!response.ok) {
    let detail = "";
    try { detail = String((await response.json())?.error ?? ""); } catch { /* ignore */ }
    if (response.status === 401 || response.status === 403) throw new Error("画像アクセスキーまたはDrive権限を確認してください。");
    if (response.status === 404) throw new Error("画像が見つかりません。削除済みの可能性があります。");
    throw new Error(detail || `画像を取得できませんでした (HTTP ${response.status})。`);
  }
  const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) throw new Error("画像ゲートウェイから非対応形式が返されました。");
  const blob = await response.blob();
  if (blob.size > APP_CONFIG.imageClientMaxBytes) throw new Error("画像サイズが表示上限を超えています。");
  return remember(key, URL.createObjectURL(blob));
}

export function clearImageObjectUrlCache() {
  for (const objectUrl of objectUrlCache.values()) URL.revokeObjectURL(objectUrl);
  objectUrlCache.clear();
}
