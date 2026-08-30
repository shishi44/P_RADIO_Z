import { serializeConnectionForUrl } from "./tabular.js?v=41";

export function buildLiveObsUrl({ connection, templateId, nameFontSize, contentFontSize, boldText = false, selectedId, refreshSeconds = 60 }) {
  if (!connection || connection.type !== "sheet") return "";
  const url = new URL("./obs.html", location.href);
  const sourceParams = serializeConnectionForUrl(connection);
  for (const [key, value] of sourceParams) url.searchParams.set(key, value);
  url.searchParams.set("template", templateId);
  url.searchParams.set("nameSize", String(nameFontSize));
  url.searchParams.set("contentSize", String(contentFontSize));
  url.searchParams.set("bold", boldText ? "1" : "0");
  if (selectedId) url.searchParams.set("id", selectedId);
  url.searchParams.set("refresh", String(refreshSeconds));
  return url.toString();
}
