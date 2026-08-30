const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,}$/;
const ALLOWED_HOSTS = new Set(["drive.google.com"]);

function validateFileId(fileId) {
  const value = String(fileId ?? "").trim();
  if (!FILE_ID_PATTERN.test(value)) throw new Error("画像IDの形式が不正です。");
  return value;
}
function validatePublicUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const url = new URL(raw);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) throw new Error("画像URLの形式が不正です。");
  return url.toString();
}
function buildDriveThumbnailUrl(image, width) {
  const fileId = validateFileId(image?.fileId);
  const url = new URL("https://drive.google.com/thumbnail");
  url.searchParams.set("id", fileId);
  url.searchParams.set("sz", `w${width}`);
  const resourceKey = String(image?.resourceKey ?? "").trim();
  if (resourceKey) url.searchParams.set("resourcekey", resourceKey);
  return url.toString();
}

export function getPublicImageUrl(image, { variant = "thumb" } = {}) {
  if (image?.public === false) throw new Error("画像のリンク共有に失敗しています。Driveの共有設定を確認してください。");
  if (!new Set(["thumb", "full"]).has(variant)) throw new Error("画像サイズ指定が不正です。");
  const preferred = variant === "thumb" ? image?.thumbnailUrl : image?.url;
  const validated = validatePublicUrl(preferred);
  if (validated) return validated;
  return buildDriveThumbnailUrl(image, variant === "full" ? 2560 : 640);
}
