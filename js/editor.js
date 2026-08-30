import { TEMPLATES, FONT_LIMITS, getTemplateById } from "./config/templates.js?v=41";
import { fetchGoogleSheetTable, parseGoogleSheetUrl } from "./api/googleSheetsApi.js?v=41";
import { loadResponses, getDataSourceLabel, clearResponseCache } from "./services/responseService.js?v=41";
import { loadConnection, saveConnection, clearConnection, createSheetConnection } from "./services/connectionService.js?v=41";
import { loadSettings, getTemplateSettings, updateTemplateSettings, resetTemplateSettings, saveSelectedResponseId, loadSelectedResponseId } from "./services/settingsService.js?v=41";
import { loadReviewedIds, setReviewed, setReviewedRange } from "./services/reviewStateService.js?v=41";
import { qs, setText, setHidden } from "./utils/dom.js?v=41";
import { formatDateTime } from "./utils/helpers.js?v=41";
import { suggestColumnMapping } from "./utils/tabular.js?v=41";
import { buildLiveObsUrl } from "./utils/obsUrl.js?v=41";
import { renderResponse, applyTemplateStylesheet } from "./ui/responseRenderer.js?v=41";
import { renderResponseList, updateSelectedResponse } from "./ui/responseList.js?v=41";
import { renderTemplateSelector, updateSelectedTemplate } from "./ui/templateSelector.js?v=41";
import { createFontSizeControl } from "./ui/fontSizeControl.js?v=41";

const elements = {
  stylesheet: qs("#template-stylesheet"),
  reloadButton: qs("#reload-button"),
  connectionButton: qs("#connection-button"),
  obsButton: qs("#obs-button"),
  responseCount: qs("#response-count"),
  listCount: qs("#list-count"),
  lastUpdated: qs("#last-updated"),
  responsesState: qs("#responses-state"),
  responseList: qs("#response-list"),
  previewState: qs("#preview-state"),
  preview: qs("#editor-preview"),
  prevButton: qs("#prev-response"),
  nextButton: qs("#next-response"),
  responsePosition: qs("#response-position"),
  previewReviewed: qs("#preview-reviewed"),
  templateSelector: qs("#template-selector"),
  templateName: qs("#template-name"),
  nameControl: qs("#name-font-control"),
  contentControl: qs("#content-font-control"),
  nameSizeLabel: qs("#name-size-label"),
  contentSizeLabel: qs("#content-size-label"),
  boldTextToggle: qs("#bold-text-toggle"),
  boldTextLabel: qs("#bold-text-label"),
  resetTemplate: qs("#reset-template"),
  connectionDialog: qs("#connection-dialog"),
  obsDialog: qs("#obs-dialog"),
  sheetUrl: qs("#sheet-url-input"),
  sheetRead: qs("#sheet-read-button"),
  sheetState: qs("#sheet-connect-state"),
  sheetMapping: qs("#sheet-mapping"),
  sheetName: qs("#sheet-name-column"),
  sheetContent: qs("#sheet-content-column"),
  sheetTimestamp: qs("#sheet-timestamp-column"),
  sheetImage: qs("#sheet-image-column"),
  sheetSave: qs("#sheet-save-button"),
  disconnect: qs("#disconnect-button"),
  obsLiveUrl: qs("#obs-live-url"),
  obsLiveNote: qs("#obs-live-note"),
  copyObsUrl: qs("#copy-obs-url"),
  openCapture: qs("#open-capture-window"),
  tabAll: qs("#tab-count-all"),
  tabReviewed: qs("#tab-count-reviewed"),
  tabUnreviewed: qs("#tab-count-unreviewed"),
  bulkStart: qs("#bulk-review-start"),
  bulkEnd: qs("#bulk-review-end"),
  bulkButton: qs("#bulk-review-button")
};

const state = {
  responses: [], selectedId: "", settings: loadSettings(), connection: loadConnection(),
  loading: false, error: null, pendingSheet: null, filter: "all", reviewedIds: new Set()
};
let nameControlApi;
let contentControlApi;
const captureChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("pradio-z.capture.v1") : null;
const CAPTURE_SYNC_KEY = "pradio-z.capture-sync.v1";

function selectedIndex() { return state.responses.findIndex((response) => response.id === state.selectedId); }
function selectedResponse() { const index = selectedIndex(); return index >= 0 ? state.responses[index] : null; }
function numberById() { return new Map(state.responses.map((response, index) => [response.id, index + 1])); }
function isReviewed(id) { return state.reviewedIds.has(String(id)); }
function filteredResponses() {
  if (state.filter === "reviewed") return state.responses.filter((item) => isReviewed(item.id));
  if (state.filter === "unreviewed") return state.responses.filter((item) => !isReviewed(item.id));
  return state.responses;
}
function reviewCounts() {
  const reviewed = state.responses.reduce((count, item) => count + (isReviewed(item.id) ? 1 : 0), 0);
  return { all: state.responses.length, reviewed, unreviewed: state.responses.length - reviewed };
}
function publishCapture(message) {
  const payload = { ...message, at: Date.now() };
  if (captureChannel) captureChannel.postMessage(payload);
  else { try { localStorage.setItem(CAPTURE_SYNC_KEY, JSON.stringify(payload)); } catch { /* no-op */ } }
}
function setStatus(type, message) { elements.responsesState.dataset.state = type || ""; setText(elements.responsesState, message || ""); }
function setPreviewStatus(message) { setText(elements.previewState, message || ""); setHidden(elements.previewState, !message); setHidden(elements.preview, Boolean(message)); }
function updateConnectionBadge() {
  elements.connectionButton.textContent = getDataSourceLabel(state.connection);
  elements.connectionButton.dataset.connected = state.connection.type !== "none" ? "true" : "false";
}
function updateControlsFromSettings() {
  const template = getTemplateById(state.settings.templateId);
  const values = getTemplateSettings(state.settings, template.id);
  elements.templateName.textContent = template.name;
  elements.nameSizeLabel.textContent = `${values.nameFontSize}px`;
  elements.contentSizeLabel.textContent = `${values.contentFontSize}px`;
  elements.boldTextToggle.checked = values.boldText;
  elements.boldTextLabel.textContent = values.boldText ? "太字" : "標準";
  nameControlApi?.setValue(values.nameFontSize);
  contentControlApi?.setValue(values.contentFontSize);
  updateSelectedTemplate(elements.templateSelector, template.id);
}
function updateFilterUI() {
  const counts = reviewCounts();
  elements.tabAll.textContent = String(counts.all);
  elements.tabReviewed.textContent = String(counts.reviewed);
  elements.tabUnreviewed.textContent = String(counts.unreviewed);
  elements.responseCount.textContent = `${counts.unreviewed}件`;
  document.querySelectorAll("[data-response-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.responseFilter === state.filter));
}
function ensureSelectionVisible(referenceIndex = selectedIndex()) {
  const visible = filteredResponses();
  if (!visible.length) { state.selectedId = ""; saveSelectedResponseId(""); return; }
  if (visible.some((item) => item.id === state.selectedId)) return;
  const start = Math.max(0, referenceIndex);
  const next = state.responses.slice(start).find((item) => visible.some((candidate) => candidate.id === item.id));
  const previous = [...state.responses.slice(0, start)].reverse().find((item) => visible.some((candidate) => candidate.id === item.id));
  state.selectedId = (next || previous || visible[0]).id;
  saveSelectedResponseId(state.selectedId);
}
function renderCurrentResponse() {
  const response = selectedResponse();
  const template = getTemplateById(state.settings.templateId);
  const values = getTemplateSettings(state.settings, template.id);
  applyTemplateStylesheet(elements.stylesheet, template.id);
  if (!response) {
    const hasFiltered = filteredResponses().length > 0;
    setPreviewStatus(state.loading ? "回答を読み込んでいます…" : state.error ? "回答を表示できません。" : hasFiltered ? "回答を選択してください。" : "このタブに該当する回答はありません。");
    elements.responsePosition.textContent = "— / —";
    elements.prevButton.disabled = true;
    elements.nextButton.disabled = true;
    elements.previewReviewed.checked = false;
    elements.previewReviewed.disabled = true;
    return;
  }
  setPreviewStatus("");
  renderResponse(elements.preview, response, { templateId: template.id, ...values, connection: state.connection });
  const index = selectedIndex();
  elements.responsePosition.textContent = `${index + 1} / ${state.responses.length}`;
  elements.prevButton.disabled = index <= 0;
  elements.nextButton.disabled = index < 0 || index >= state.responses.length - 1;
  elements.previewReviewed.disabled = false;
  elements.previewReviewed.checked = isReviewed(response.id);
  updateSelectedResponse(elements.responseList, response.id);
}
function selectResponse(id, { focusList = false } = {}) {
  if (!state.responses.some((response) => response.id === id)) return;
  state.selectedId = id;
  saveSelectedResponseId(id);
  renderCurrentResponse();
  publishCapture({ type: "selection", id });
  if (focusList) elements.responseList.querySelector(`.response-item__select[data-response-id="${CSS.escape(id)}"]`)?.focus();
}
function renderList() {
  const visible = filteredResponses();
  renderResponseList(elements.responseList, visible, state.selectedId, {
    onSelect: (id) => selectResponse(id),
    onReview: (id, reviewed) => changeReviewStatus(id, reviewed),
    numberById: numberById(), reviewedIds: state.reviewedIds, showReviewCheckbox: state.filter === "unreviewed"
  });
  elements.listCount.textContent = String(visible.length);
  updateFilterUI();
}
function changeReviewStatus(id, reviewed) {
  const referenceIndex = state.responses.findIndex((item) => item.id === id);
  state.reviewedIds = setReviewed(state.connection, state.reviewedIds, id, reviewed);
  if (state.selectedId === id && ((state.filter === "unreviewed" && reviewed) || (state.filter === "reviewed" && !reviewed))) ensureSelectionVisible(referenceIndex);
  renderList();
  renderCurrentResponse();
}
function applyBulkReview() {
  if (!state.responses.length) return;
  const start = Math.max(1, Number(elements.bulkStart.value) || 1);
  const end = Math.min(state.responses.length, Math.max(start, Number(elements.bulkEnd.value) || start));
  state.reviewedIds = setReviewedRange(state.connection, state.reviewedIds, state.responses, start, end);
  elements.bulkStart.value = String(start);
  elements.bulkEnd.value = String(end);
  ensureSelectionVisible(selectedIndex());
  renderList();
  renderCurrentResponse();
}
function setFilter(filter) {
  if (!["all", "reviewed", "unreviewed"].includes(filter)) return;
  const reference = selectedIndex();
  state.filter = filter;
  ensureSelectionVisible(reference);
  renderList();
  renderCurrentResponse();
}
async function refreshResponses({ force = false } = {}) {
  if (state.loading) return;
  if (state.connection.type === "none") {
    state.responses = []; state.selectedId = ""; state.error = null; state.reviewedIds = new Set();
    renderList(); setStatus("empty", "Googleスプレッドシートを接続してください。"); setPreviewStatus("Googleスプレッドシートを接続してください。");
    elements.lastUpdated.textContent = "未接続"; updateConnectionBadge(); return;
  }
  state.loading = true; state.error = null; elements.reloadButton.disabled = true;
  setStatus("loading", "回答を読み込んでいます…"); setPreviewStatus("回答を読み込んでいます…");
  try {
    if (force) clearResponseCache();
    const payload = await loadResponses({ force, connection: state.connection });
    state.responses = [...payload.responses];
    state.reviewedIds = loadReviewedIds(state.connection);
    const preferredId = state.selectedId || loadSelectedResponseId();
    state.selectedId = state.responses.some((item) => item.id === preferredId) ? preferredId : state.responses[0]?.id || "";
    ensureSelectionVisible(Math.max(0, selectedIndex()));
    if (state.selectedId) saveSelectedResponseId(state.selectedId);
    const max = Math.max(1, state.responses.length);
    elements.bulkStart.max = String(max); elements.bulkEnd.max = String(max);
    if (Number(elements.bulkEnd.value) <= 1 || Number(elements.bulkEnd.value) > max) elements.bulkEnd.value = String(max);
    renderList();
    setStatus(state.responses.length ? "" : "empty", state.responses.length ? "" : "まだ回答がありません。");
    elements.lastUpdated.textContent = payload.generatedAt ? `更新 ${formatDateTime(payload.generatedAt)}` : "取得済み";
  } catch (error) {
    console.error(error); state.responses = []; state.selectedId = ""; state.error = error; renderList();
    setStatus("error", `取得エラー: ${error.message || "回答データを取得できませんでした。"}`); elements.lastUpdated.textContent = "取得失敗";
  } finally {
    state.loading = false; elements.reloadButton.disabled = false; renderCurrentResponse(); updateConnectionBadge();
  }
}
function populateColumnSelects(table, selects, suggested = suggestColumnMapping(table.headers)) {
  for (const select of selects) {
    select.replaceChildren();
    if (select.dataset.optional === "true") select.append(new Option("使用しない", "-1"));
    table.headers.forEach((header, index) => select.append(new Option(`${index + 1}. ${header}`, String(index))));
  }
  elements.sheetName.value = String(suggested.nameColumn);
  elements.sheetContent.value = String(suggested.contentColumn);
  elements.sheetTimestamp.value = String(suggested.timestampColumn >= 0 ? suggested.timestampColumn : -1);
  elements.sheetImage.value = String(suggested.imageColumn >= 0 ? suggested.imageColumn : -1);
}
function readMapping() {
  return {
    nameColumn: Number(elements.sheetName.value), contentColumn: Number(elements.sheetContent.value),
    timestampColumn: Number(elements.sheetTimestamp.value), imageColumn: Number(elements.sheetImage.value)
  };
}
function openConnectionDialog() {
  if (state.connection.type === "sheet") {
    elements.sheetUrl.value = state.connection.sourceUrl || `https://docs.google.com/spreadsheets/d/${state.connection.spreadsheetId}/edit#gid=${state.connection.gid}`;
  }
  elements.connectionDialog.showModal();
}
async function testSheet() {
  setText(elements.sheetState, "読み込んでいます…"); elements.sheetState.dataset.state = "loading"; setHidden(elements.sheetMapping, true);
  try {
    const parsed = parseGoogleSheetUrl(elements.sheetUrl.value);
    const table = await fetchGoogleSheetTable(parsed);
    if (!table.headers.length) throw new Error("列を取得できませんでした。");
    state.pendingSheet = table;
    populateColumnSelects(table, [elements.sheetName, elements.sheetContent, elements.sheetTimestamp, elements.sheetImage]);
    setText(elements.sheetState, `接続できました。${table.rows.length}件のデータを確認しました。`);
    elements.sheetState.dataset.state = "success"; setHidden(elements.sheetMapping, false);
  } catch (error) {
    state.pendingSheet = null; setText(elements.sheetState, error.message); elements.sheetState.dataset.state = "error";
  }
}
async function saveSheetConnection() {
  if (!state.pendingSheet) return testSheet();
  try {
    state.connection = saveConnection(createSheetConnection(elements.sheetUrl.value, readMapping()));
    state.reviewedIds = loadReviewedIds(state.connection); clearResponseCache(); elements.connectionDialog.close(); updateConnectionBadge();
    await refreshResponses({ force: true });
  } catch (error) { setText(elements.sheetState, error.message); elements.sheetState.dataset.state = "error"; }
}
async function disconnect() {
  clearConnection(); clearResponseCache(); state.connection = { type: "none" }; state.responses = []; state.selectedId = ""; state.reviewedIds = new Set();
  updateConnectionBadge(); setText(elements.sheetState, ""); elements.connectionDialog.close(); await refreshResponses(); setTimeout(openConnectionDialog, 50);
}
function selectTemplate(templateId) {
  state.settings = updateTemplateSettings(state.settings, templateId, {}); applyTemplateStylesheet(elements.stylesheet, templateId); updateControlsFromSettings(); renderCurrentResponse(); publishCapture({ type: "settings" });
}
function changeFont(kind, value) {
  const patch = kind === "name" ? { nameFontSize: value } : { contentFontSize: value };
  state.settings = updateTemplateSettings(state.settings, state.settings.templateId, patch); updateControlsFromSettings(); renderCurrentResponse(); publishCapture({ type: "settings" });
}
function changeBold(checked) {
  state.settings = updateTemplateSettings(state.settings, state.settings.templateId, { boldText: checked }); updateControlsFromSettings(); renderCurrentResponse(); publishCapture({ type: "settings" });
}
function initControls() {
  const initial = getTemplateSettings(state.settings, state.settings.templateId);
  nameControlApi = createFontSizeControl(elements.nameControl, { label: "お名前のフォントサイズ", ...FONT_LIMITS.name, value: initial.nameFontSize, onChange: (value) => changeFont("name", value) });
  contentControlApi = createFontSizeControl(elements.contentControl, { label: "内容のフォントサイズ", ...FONT_LIMITS.content, value: initial.contentFontSize, onChange: (value) => changeFont("content", value) });
}
function updateObsDialog() {
  const template = getTemplateById(state.settings.templateId);
  const values = getTemplateSettings(state.settings, template.id);
  const liveUrl = buildLiveObsUrl({ connection: state.connection, templateId: template.id, ...values, selectedId: state.selectedId });
  elements.obsLiveUrl.value = liveUrl;
  elements.copyObsUrl.disabled = !liveUrl;
  elements.obsLiveNote.textContent = liveUrl
    ? "Googleスプレッドシートを自動更新します。公開リンク画像もそのまま表示されます。"
    : "Googleスプレッドシート接続後にBrowser Source URLを生成できます。";
}
async function copyObsUrl() {
  const value = elements.obsLiveUrl.value; if (!value) return;
  try { await navigator.clipboard.writeText(value); elements.copyObsUrl.textContent = "コピー済み"; setTimeout(() => { elements.copyObsUrl.textContent = "コピー"; }, 1400); }
  catch { elements.obsLiveUrl.select(); document.execCommand("copy"); }
}
function openCaptureWindow() {
  const url = new URL("./capture.html", location.href);
  window.open(url.toString(), "pradio-z-capture", "popup=yes,width=1040,height=720,resizable=yes,scrollbars=no");
}
function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
}
function initEvents() {
  elements.reloadButton.addEventListener("click", () => refreshResponses({ force: true }));
  elements.connectionButton.addEventListener("click", openConnectionDialog);
  elements.obsButton.addEventListener("click", () => { updateObsDialog(); elements.obsDialog.showModal(); });
  elements.prevButton.addEventListener("click", () => { const index = selectedIndex(); if (index > 0) selectResponse(state.responses[index - 1].id); });
  elements.nextButton.addEventListener("click", () => { const index = selectedIndex(); if (index >= 0 && index < state.responses.length - 1) selectResponse(state.responses[index + 1].id); });
  elements.previewReviewed.addEventListener("change", () => { const response = selectedResponse(); if (response) changeReviewStatus(response.id, elements.previewReviewed.checked); });
  elements.bulkButton.addEventListener("click", applyBulkReview);
  document.querySelectorAll("[data-response-filter]").forEach((button) => button.addEventListener("click", () => setFilter(button.dataset.responseFilter)));
  elements.boldTextToggle.addEventListener("change", () => changeBold(elements.boldTextToggle.checked));
  elements.resetTemplate.addEventListener("click", () => { state.settings = resetTemplateSettings(state.settings, state.settings.templateId); updateControlsFromSettings(); renderCurrentResponse(); publishCapture({ type: "settings" }); });
  elements.sheetRead.addEventListener("click", testSheet);
  elements.sheetSave.addEventListener("click", saveSheetConnection);
  elements.disconnect.addEventListener("click", disconnect);
  elements.copyObsUrl.addEventListener("click", copyObsUrl);
  elements.openCapture.addEventListener("click", openCaptureWindow);
  elements.sheetTimestamp.dataset.optional = "true";
  elements.sheetImage.dataset.optional = "true";
  elements.preview.querySelector(".response-content")?.addEventListener("scroll", (event) => publishCapture({ type: "scroll", id: state.selectedId, top: event.currentTarget.scrollTop }), { passive: true });
  document.addEventListener("keydown", (event) => {
    if (elements.connectionDialog.open || elements.obsDialog.open || isTypingTarget(event.target)) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); elements.prevButton.click(); }
    if (event.key === "ArrowRight") { event.preventDefault(); elements.nextButton.click(); }
  });
  window.addEventListener("beforeunload", () => captureChannel?.close());
}
function init() {
  state.reviewedIds = loadReviewedIds(state.connection); updateConnectionBadge();
  renderTemplateSelector(elements.templateSelector, TEMPLATES, state.settings.templateId, selectTemplate);
  initControls(); updateControlsFromSettings(); initEvents(); refreshResponses();
  if (state.connection.type === "none") setTimeout(openConnectionDialog, 120);
}
init();
