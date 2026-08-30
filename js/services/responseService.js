import { APP_CONFIG } from "../config/appConfig.js?v=40";
import { fetchGoogleSheetTable } from "../api/googleSheetsApi.js?v=40";
import { loadConnection, connectionLabel } from "./connectionService.js?v=40";
import { tableToResponsePayload } from "../utils/tabular.js?v=40";
import { toStringSafe } from "../utils/helpers.js?v=40";

let memoryCache = null;
let cacheKey = "";

function normalizeImages(images) {
  if (!Array.isArray(images)) return Object.freeze([]);
  return Object.freeze(images.slice(0, APP_CONFIG.maxImagesPerResponse).map((image) => Object.freeze({
    fileId: toStringSafe(image?.fileId).trim(),
    name: toStringSafe(image?.name).trim() || "投稿画像",
    mimeType: toStringSafe(image?.mimeType).trim().toLowerCase()
  })).filter((image) => image.fileId));
}
function normalizeResponse(item, index) {
  const id = toStringSafe(item?.id).trim() || `response-${index + 1}`;
  return Object.freeze({
    id,
    submittedAt: toStringSafe(item?.submittedAt),
    name: toStringSafe(item?.name),
    content: toStringSafe(item?.content),
    images: normalizeImages(item?.images)
  });
}
function normalizePayload(payload) {
  if (!payload || payload.ok === false) {
    const message = payload?.error?.message || "回答データを取得できませんでした。";
    const error = new Error(message);
    error.code = payload?.error?.code || "API_ERROR";
    throw error;
  }
  const responses = Array.isArray(payload.responses) ? payload.responses.map(normalizeResponse) : [];
  const ordered = responses.map((item, index) => ({ item, index, time: Date.parse(item.submittedAt) })).sort((a, b) => {
    const aValid = Number.isFinite(a.time);
    const bValid = Number.isFinite(b.time);
    if (aValid && bValid && a.time !== b.time) return a.time - b.time;
    if (aValid !== bValid) return aValid ? -1 : 1;
    return a.index - b.index;
  }).map(({ item }) => item);
  return Object.freeze({ ok: true, generatedAt: toStringSafe(payload.generatedAt) || new Date().toISOString(), count: ordered.length, responses: Object.freeze(ordered) });
}
async function fetchSample(options = {}) {
  const response = await fetch(APP_CONFIG.sampleDataUrl, { cache: "no-store", signal: options.signal });
  if (!response.ok) throw new Error(`Sample data HTTP ${response.status}`);
  return response.json();
}
function keyForConnection(connection) {
  const safe = connection?.type === "sheet" ? { ...connection, imageGatewayToken: connection.imageGatewayToken ? "configured" : "" } : connection;
  return JSON.stringify(safe ?? { type: "none" });
}

export async function loadResponses(options = {}) {
  const connection = options.connection ?? loadConnection();
  const nextKey = keyForConnection(connection);
  if (memoryCache && cacheKey === nextKey && !options.force) return memoryCache;

  let payload;
  if (connection.type === "sheet") {
    const table = await fetchGoogleSheetTable(connection, options);
    payload = tableToResponsePayload(table, connection, { idPrefix: `sheet-${connection.gid || 0}` });
  } else if (connection.type === "sample") {
    payload = await fetchSample(options);
  } else {
    const error = new Error("最初にGoogleスプレッドシートを接続してください。");
    error.code = "CONNECTION_REQUIRED";
    throw error;
  }

  memoryCache = normalizePayload(payload);
  cacheKey = nextKey;
  return memoryCache;
}
export function clearResponseCache() { memoryCache = null; cacheKey = ""; }
export function getDataSourceLabel(connection = loadConnection()) { return connectionLabel(connection); }
