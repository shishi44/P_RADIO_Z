export function clamp(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

export function toStringSafe(value) {
  return value == null ? "" : String(value);
}

export function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toStringSafe(value);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function makeExcerpt(value, maxLength = 74) {
  const text = toStringSafe(value).replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

export function isValidCallbackName(value) {
  return /^[A-Za-z_$][0-9A-Za-z_$\.]{0,127}$/.test(value);
}
