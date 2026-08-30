import { APP_CONFIG } from "../config/appConfig.js?v=40";
import { parseGoogleSheetUrl } from "../api/googleSheetsApi.js?v=40";

const memoryFallback = new Map();

function getStored(key) {
  try { return localStorage.getItem(key); }
  catch { return memoryFallback.get(key) ?? null; }
}
function setStored(key, value) {
  memoryFallback.set(key, value);
  try { localStorage.setItem(key, value); } catch { /* memory fallback */ }
}
function removeStored(key) {
  memoryFallback.delete(key);
  try { localStorage.removeItem(key); } catch { /* no-op */ }
}
function sanitizeColumn(value, fallback = -1) {
  const number = Number(value);
  return Number.isInteger(number) && number >= -1 ? number : fallback;
}
function sanitizeGatewayUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const url = new URL(raw);
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) throw new Error("画像ゲートウェイURLはHTTPSを使用してください。");
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}
function normalizeSheetConnection(value = {}) {
  return {
    type: "sheet",
    spreadsheetId: String(value.spreadsheetId ?? ""),
    gid: String(value.gid ?? "0"),
    sourceUrl: String(value.sourceUrl ?? ""),
    nameColumn: sanitizeColumn(value.nameColumn, 1),
    contentColumn: sanitizeColumn(value.contentColumn, 2),
    timestampColumn: sanitizeColumn(value.timestampColumn, 0),
    imageColumn: sanitizeColumn(value.imageColumn, -1),
    imageGatewayUrl: sanitizeGatewayUrl(value.imageGatewayUrl),
    imageGatewayToken: String(value.imageGatewayToken ?? "").trim()
  };
}

export function loadConnection() {
  const raw = getStored(APP_CONFIG.connectionKey);
  if (!raw) return { type: "none" };
  try {
    const value = JSON.parse(raw);
    if (value?.type === "sheet" && value.spreadsheetId) return normalizeSheetConnection(value);
  } catch { /* fall through */ }
  return { type: "none" };
}

export function saveConnection(connection) {
  const safe = connection?.type === "sheet" ? normalizeSheetConnection(connection) : { type: "none" };
  setStored(APP_CONFIG.connectionKey, JSON.stringify(safe));
  return safe;
}

export function clearConnection() {
  removeStored(APP_CONFIG.connectionKey);
}

export function createSheetConnection(sheetUrl, mapping = {}, imageGateway = {}) {
  const parsed = parseGoogleSheetUrl(sheetUrl);
  return normalizeSheetConnection({
    ...parsed,
    nameColumn: mapping.nameColumn,
    contentColumn: mapping.contentColumn,
    timestampColumn: mapping.timestampColumn,
    imageColumn: mapping.imageColumn,
    imageGatewayUrl: imageGateway.url,
    imageGatewayToken: imageGateway.token
  });
}

export function connectionFromQuery(
  params = new URLSearchParams(location.search),
  fragmentParams = new URLSearchParams(location.hash.replace(/^#/, ""))
) {
  if (params.get("source") !== "sheet") return null;
  const spreadsheetId = params.get("sheet") || "";
  if (!spreadsheetId) return null;
  try {
    return normalizeSheetConnection({
      type: "sheet",
      spreadsheetId,
      gid: params.get("gid") || "0",
      sourceUrl: "",
      nameColumn: params.get("name"),
      contentColumn: params.get("content"),
      timestampColumn: params.get("timestamp"),
      imageColumn: params.get("image"),
      imageGatewayUrl: params.get("gateway") || "",
      imageGatewayToken: fragmentParams.get("access") || params.get("access") || ""
    });
  } catch {
    return null;
  }
}

export function connectionLabel(connection = loadConnection()) {
  return connection.type === "sheet" ? "Google Sheets" : "未接続";
}
