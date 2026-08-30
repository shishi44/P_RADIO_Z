import { getTemplateById } from "./config/templates.js?v=41";
import { loadResponses, clearResponseCache } from "./services/responseService.js?v=41";
import { loadConnection } from "./services/connectionService.js?v=41";
import { loadSettings, getTemplateSettings, loadSelectedResponseId, saveSelectedResponseId } from "./services/settingsService.js?v=41";
import { qs, setText, setHidden } from "./utils/dom.js?v=41";
import { renderResponse, applyTemplateStylesheet } from "./ui/responseRenderer.js?v=41";

const elements = {
  stylesheet: qs("#template-stylesheet"),
  status: qs("#viewer-status"),
  preview: qs("#viewer-preview"),
  navigation: qs("#viewer-navigation"),
  prev: qs("#viewer-prev"),
  next: qs("#viewer-next"),
  position: qs("#viewer-position")
};

const state = { responses: [], index: -1, settings: loadSettings(), connection: loadConnection() };

function showStatus(message) {
  setText(elements.status, message);
  setHidden(elements.status, !message);
  setHidden(elements.preview, Boolean(message));
  setHidden(elements.navigation, Boolean(message) || state.responses.length <= 1);
}

function renderCurrent() {
  const response = state.responses[state.index];
  if (!response) return showStatus("表示できる回答がありません。");
  const params = new URLSearchParams(location.search);
  const template = getTemplateById(params.get("template") || state.settings.templateId);
  const values = getTemplateSettings(state.settings, template.id);
  applyTemplateStylesheet(elements.stylesheet, template.id);
  renderResponse(elements.preview, response, {
    templateId: template.id,
    nameFontSize: Number(params.get("nameSize")) || values.nameFontSize,
    contentFontSize: Number(params.get("contentSize")) || values.contentFontSize,
    boldText: params.has("bold") ? params.get("bold") === "1" : values.boldText,
    connection: state.connection
  });
  elements.position.textContent = `${state.index + 1} / ${state.responses.length}`;
  elements.prev.disabled = state.index <= 0;
  elements.next.disabled = state.index >= state.responses.length - 1;
  saveSelectedResponseId(response.id);
  showStatus("");
}

function move(delta) {
  if (!state.responses.length) return;
  state.index = Math.max(0, Math.min(state.responses.length - 1, state.index + delta));
  renderCurrent();
}

async function init({ force = false } = {}) {
  showStatus("回答を読み込んでいます…");
  try {
    if (force) clearResponseCache();
    const payload = await loadResponses({ force });
    state.responses = [...payload.responses];
    const params = new URLSearchParams(location.search);
    const requestedId = params.get("id") || loadSelectedResponseId();
    const requestedIndex = state.responses.findIndex((item) => item.id === requestedId);
    state.index = requestedIndex >= 0 ? requestedIndex : 0;
    renderCurrent();
  } catch (error) {
    console.error(error);
    showStatus(error.code === "CONNECTION_REQUIRED" ? "編集画面で回答データを接続してください。" : `回答を表示できませんでした: ${error.message || "取得エラー"}`);
  }
}

elements.prev.addEventListener("click", () => move(-1));
elements.next.addEventListener("click", () => move(1));
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
  if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
});
window.addEventListener("storage", (event) => {
  if (event.key?.includes("selected-response")) {
    const id = loadSelectedResponseId();
    const index = state.responses.findIndex((item) => item.id === id);
    if (index >= 0 && index !== state.index) { state.index = index; renderCurrent(); }
  }
});

init();
