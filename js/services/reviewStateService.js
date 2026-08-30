import { APP_CONFIG } from "../config/appConfig.js?v=40";

const memoryFallback = new Map();
function storageGet(key) { try { return localStorage.getItem(key); } catch { return memoryFallback.get(key) ?? null; } }
function storageSet(key, value) { memoryFallback.set(key, value); try { localStorage.setItem(key, value); } catch { /* memory fallback */ } }
function safeParse(raw) { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }

export function connectionReviewKey(connection) {
  if (connection?.type === "sheet") return `sheet:${connection.spreadsheetId}:${connection.gid ?? "0"}`;
  return "none";
}
export function loadReviewedIds(connection) {
  const source = safeParse(storageGet(APP_CONFIG.reviewStateKey))[connectionReviewKey(connection)];
  return new Set(Array.isArray(source?.reviewedIds) ? source.reviewedIds.map(String) : []);
}
export function saveReviewedIds(connection, reviewedIds) {
  const all = safeParse(storageGet(APP_CONFIG.reviewStateKey));
  all[connectionReviewKey(connection)] = { reviewedIds: [...reviewedIds].map(String), updatedAt: new Date().toISOString() };
  storageSet(APP_CONFIG.reviewStateKey, JSON.stringify(all));
  return reviewedIds;
}
export function setReviewed(connection, reviewedIds, responseId, reviewed) {
  const next = new Set(reviewedIds);
  if (reviewed) next.add(String(responseId)); else next.delete(String(responseId));
  saveReviewedIds(connection, next);
  return next;
}
export function setReviewedRange(connection, reviewedIds, responses, startNumber, endNumber) {
  const next = new Set(reviewedIds);
  const start = Math.max(1, Math.min(Number(startNumber) || 1, responses.length || 1));
  const end = Math.max(start, Math.min(Number(endNumber) || start, responses.length || start));
  for (let number = start; number <= end; number += 1) {
    const response = responses[number - 1];
    if (response) next.add(String(response.id));
  }
  saveReviewedIds(connection, next);
  return next;
}
