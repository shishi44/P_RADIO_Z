import { APP_CONFIG } from "./config/appConfig.js?v=40";
import { getTemplateById } from "./config/templates.js?v=40";
import { loadResponses, clearResponseCache } from "./services/responseService.js?v=40";
import { connectionFromQuery, loadConnection } from "./services/connectionService.js?v=40";
import { loadSettings, getTemplateSettings } from "./services/settingsService.js?v=40";
import { qs, setText, setHidden } from "./utils/dom.js?v=40";
import { renderResponse, applyTemplateStylesheet } from "./ui/responseRenderer.js?v=40";

const elements = { stylesheet: qs("#template-stylesheet"), preview: qs("#obs-preview"), debug: qs("#obs-debug") };
const params = new URLSearchParams(location.search);
const connection = connectionFromQuery(params) || loadConnection();
const settings = loadSettings();
const template = getTemplateById(params.get("template") || settings.templateId);
const storedValues = getTemplateSettings(settings, template.id);
const values = {
  nameFontSize: Number(params.get("nameSize")) || storedValues.nameFontSize,
  contentFontSize: Number(params.get("contentSize")) || storedValues.contentFontSize,
  boldText: params.has("bold") ? params.get("bold") === "1" : storedValues.boldText
};
const debugEnabled = params.get("debug") === "1";
const refreshSeconds = Math.max(15, Number(params.get("refresh")) || APP_CONFIG.sheetRefreshMs / 1000);
const state = { responses: [], index: 0, selectedId: params.get("id") || "", timer: null };

function debug(message) {
  if (!debugEnabled) return;
  setText(elements.debug, message);
  setHidden(elements.debug, !message);
}

function renderCurrent({ preserveScroll = false, scrollTop = 0 } = {}) {
  const response = state.responses[state.index];
  if (!response) { setHidden(elements.preview, true); return; }
  state.selectedId = response.id;
  applyTemplateStylesheet(elements.stylesheet, template.id);
  renderResponse(elements.preview, response, { templateId: template.id, ...values, connection });
  if (preserveScroll) elements.preview.querySelector(".response-content")?.scrollTo({ top: scrollTop });
  setHidden(elements.preview, false);
  debug("");
}

function move(delta) {
  if (!state.responses.length) return;
  state.index = Math.max(0, Math.min(state.responses.length - 1, state.index + delta));
  renderCurrent();
}

async function refresh({ force = false } = {}) {
  try {
    const previousId = state.selectedId;
    const previousScrollTop = elements.preview.querySelector(".response-content")?.scrollTop || 0;
    if (force) clearResponseCache();
    const payload = await loadResponses({ connection, force });
    state.responses = [...payload.responses];
    const index = state.responses.findIndex((item) => item.id === state.selectedId);
    state.index = index >= 0 ? index : Math.min(state.index, Math.max(0, state.responses.length - 1));
    const nextId = state.responses[state.index]?.id || "";
    renderCurrent({ preserveScroll: Boolean(previousId && nextId === previousId), scrollTop: previousScrollTop });
  } catch (error) {
    console.error(error);
    setHidden(elements.preview, true);
    debug(error.message || "回答を取得できませんでした。");
  }
}

function scrollContent(delta) {
  const content = elements.preview.querySelector(".response-content");
  if (!content) return;
  content.scrollBy({ top: delta, behavior: "smooth" });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
  if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
  if (event.key === "ArrowUp") { event.preventDefault(); scrollContent(-140); }
  if (event.key === "ArrowDown") { event.preventDefault(); scrollContent(140); }
  if (event.key === "Home") { event.preventDefault(); elements.preview.querySelector(".response-content")?.scrollTo({ top: 0, behavior: "smooth" }); }
});
window.addEventListener("message", (event) => {
  if (event.data?.type === "formviewer:navigate") move(Number(event.data.delta) || 0);
});

refresh({ force: true });
if (connection.type === "sheet") state.timer = setInterval(() => refresh({ force: true }), refreshSeconds * 1000);
