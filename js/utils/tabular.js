import { APP_CONFIG } from "../config/appConfig.js?v=40";
import { toStringSafe } from "./helpers.js?v=40";

const NAME_HINTS = [
  "お名前(ラジオネーム)", "お名前（ラジオネーム）", "ラジオネーム", "お名前", "名前",
  "ニックネーム", "投稿者名", "ハンドルネーム", "name", "nickname"
];
const CONTENT_HINTS = ["内容", "お便り", "おたより", "メッセージ", "本文", "投稿内容", "message", "content"];
const TIMESTAMP_HINTS = ["タイムスタンプ", "日時", "送信日時", "回答日時", "timestamp", "submitted at", "submittedat"];
const IMAGE_HINTS = ["FV_IMAGES_JSON", "画像", "添付画像", "投稿画像", "image", "images", "imagejson"];
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function normalizeHeader(value) {
  return toStringSafe(value).trim().toLowerCase().replace(/[\s　_-]/g, "").replace(/[（）]/g, (char) => char === "（" ? "(" : ")");
}
function findHintIndex(headers, hints) {
  const normalized = headers.map(normalizeHeader);
  const normalizedHints = hints.map(normalizeHeader);
  for (const hint of normalizedHints) {
    const exact = normalized.indexOf(hint);
    if (exact >= 0) return exact;
  }
  for (let i = 0; i < normalized.length; i += 1) {
    if (normalizedHints.some((hint) => normalized[i].includes(hint) || hint.includes(normalized[i]))) return i;
  }
  return -1;
}

export function suggestColumnMapping(headers) {
  const timestamp = findHintIndex(headers, TIMESTAMP_HINTS);
  const image = findHintIndex(headers, IMAGE_HINTS);
  let name = findHintIndex(headers, NAME_HINTS);
  let content = findHintIndex(headers, CONTENT_HINTS);
  const reserved = new Set([timestamp, image].filter((index) => index >= 0));
  const usable = headers.map((_, index) => index).filter((index) => !reserved.has(index));
  if (name < 0) name = usable[0] ?? 0;
  if (content < 0) content = usable.find((index) => index !== name) ?? usable[1] ?? name;
  return { nameColumn: name, contentColumn: content, timestampColumn: timestamp, imageColumn: image };
}

export function parseImageMetadataCell(value) {
  const raw = toStringSafe(value).trim();
  if (!raw) return [];
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return []; }
  const candidates = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.images) ? parsed.images : [];
  const seen = new Set();
  return candidates.slice(0, APP_CONFIG.maxImagesPerResponse).flatMap((item) => {
    const fileId = toStringSafe(item?.fileId ?? item?.id).trim();
    const mimeType = toStringSafe(item?.mimeType).trim().toLowerCase();
    if (!FILE_ID_PATTERN.test(fileId) || !ALLOWED_IMAGE_TYPES.has(mimeType) || seen.has(fileId)) return [];
    seen.add(fileId);
    return [{ fileId, name: toStringSafe(item?.name ?? item?.fileName).trim() || "投稿画像", mimeType }];
  });
}

export function tableToResponsePayload(table, mapping = {}, { reverse = true, idPrefix = "response" } = {}) {
  const headers = Array.isArray(table?.headers) ? table.headers : [];
  const rows = Array.isArray(table?.rows) ? table.rows : [];
  const suggested = suggestColumnMapping(headers);
  const nameColumn = Number.isInteger(mapping.nameColumn) ? mapping.nameColumn : suggested.nameColumn;
  const contentColumn = Number.isInteger(mapping.contentColumn) ? mapping.contentColumn : suggested.contentColumn;
  const timestampColumn = Number.isInteger(mapping.timestampColumn) ? mapping.timestampColumn : suggested.timestampColumn;
  const imageColumn = Number.isInteger(mapping.imageColumn) ? mapping.imageColumn : suggested.imageColumn;

  const responses = rows.map((row, rowIndex) => ({
    id: `${idPrefix}-${rowIndex + 2}`,
    submittedAt: timestampColumn >= 0 ? toStringSafe(row?.[timestampColumn]) : "",
    name: toStringSafe(row?.[nameColumn]),
    content: toStringSafe(row?.[contentColumn]),
    images: imageColumn >= 0 ? parseImageMetadataCell(row?.[imageColumn]) : []
  })).filter((item) => item.name.trim() || item.content.trim() || item.images.length);

  if (reverse) responses.reverse();
  return { ok: true, generatedAt: new Date().toISOString(), count: responses.length, responses };
}

export function serializeConnectionForUrl(connection) {
  const params = new URLSearchParams();
  if (!connection || connection.type !== "sheet") return params;
  params.set("source", "sheet");
  params.set("sheet", connection.spreadsheetId);
  params.set("gid", String(connection.gid ?? "0"));
  params.set("name", String(connection.nameColumn));
  params.set("content", String(connection.contentColumn));
  params.set("timestamp", String(connection.timestampColumn ?? -1));
  params.set("image", String(connection.imageColumn ?? -1));
  if (connection.imageGatewayUrl) params.set("gateway", connection.imageGatewayUrl);
  return params;
}
