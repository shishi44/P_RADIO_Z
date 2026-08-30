/**
 * P_RADIO_Z - Google Forms file-upload metadata bridge
 *
 * Install this script in the response spreadsheet and run
 * installImageMetadataTrigger() once as the spreadsheet owner.
 * Uploaded Drive files remain private. Only validated metadata is written to
 * the public response sheet in FV_IMAGES_JSON.
 */
const P_RADIO_IMAGE_HEADER = 'FV_IMAGES_JSON';
const P_RADIO_MAX_IMAGES = 6;
const P_RADIO_MAX_BYTES = 20 * 1024 * 1024;
const P_RADIO_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('P_RADIO_Z')
    .addItem('画像連携トリガーを設定', 'installImageMetadataTrigger')
    .addItem('最新行を再処理', 'processLatestResponseRow')
    .addToUi();
}

function installImageMetadataTrigger() {
  const spreadsheet = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'handleFormSubmit')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('handleFormSubmit').forSpreadsheet(spreadsheet).onFormSubmit().create();
  ensureMetadataColumn_(spreadsheet.getActiveSheet());
  SpreadsheetApp.getUi().alert('画像連携トリガーを設定しました。今後のフォーム回答から画像メタデータを自動作成します。');
}

function handleFormSubmit(e) {
  if (!e || !e.range) throw new Error('スプレッドシートのフォーム送信トリガーから実行してください。');
  processResponseRow_(e.range.getSheet(), e.range.getRow(), e.values && e.values[0]);
}

function processLatestResponseRow() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet.getActiveSheet();
  if (sheet.getLastRow() < 2) throw new Error('回答行がありません。');
  processResponseRow_(sheet, sheet.getLastRow(), sheet.getRange(sheet.getLastRow(), 1).getValue());
}

function processResponseRow_(sheet, row, timestampValue) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const metadataColumn = ensureMetadataColumn_(sheet);
    const spreadsheet = sheet.getParent();
    const timestamp = timestampValue instanceof Date ? timestampValue : new Date(timestampValue);
    let fileIds = [];

    if (!Number.isNaN(timestamp.getTime())) {
      fileIds = extractFileIdsFromFormResponse_(spreadsheet, timestamp);
    }
    if (!fileIds.length) fileIds = extractFileIdsFromSheetRow_(sheet, row);

    const metadata = buildImageMetadata_(fileIds);
    sheet.getRange(row, metadataColumn).setValue(JSON.stringify(metadata));
  } finally {
    lock.releaseLock();
  }
}

function ensureMetadataColumn_(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const existing = headers.indexOf(P_RADIO_IMAGE_HEADER);
  if (existing >= 0) return existing + 1;
  const column = lastColumn + 1;
  sheet.getRange(1, column).setValue(P_RADIO_IMAGE_HEADER);
  return column;
}

function extractFileIdsFromFormResponse_(spreadsheet, timestamp) {
  const formUrl = spreadsheet.getFormUrl();
  if (!formUrl) return [];
  try {
    const form = FormApp.openByUrl(formUrl);
    const candidates = form.getResponses(new Date(timestamp.getTime() - 2 * 60 * 1000));
    let closest = null;
    let closestDiff = Infinity;
    candidates.forEach((response) => {
      const diff = Math.abs(response.getTimestamp().getTime() - timestamp.getTime());
      if (diff < closestDiff && diff <= 2 * 60 * 1000) { closest = response; closestDiff = diff; }
    });
    if (!closest) return [];
    const ids = [];
    closest.getItemResponses().forEach((itemResponse) => {
      if (itemResponse.getItem().getType() !== FormApp.ItemType.FILE_UPLOAD) return;
      const value = itemResponse.getResponse();
      if (Array.isArray(value)) value.forEach((id) => ids.push(String(id)));
      else if (value) ids.push(String(value));
    });
    return unique_(ids);
  } catch (error) {
    console.warn('FormResponseから画像IDを取得できませんでした。シートリンク解析へフォールバックします。', error);
    return [];
  }
}

function extractFileIdsFromSheetRow_(sheet, row) {
  const lastColumn = sheet.getLastColumn();
  const range = sheet.getRange(row, 1, 1, lastColumn);
  const richValues = range.getRichTextValues()[0];
  const formulas = range.getFormulas()[0];
  const displayValues = range.getDisplayValues()[0];
  const ids = [];

  richValues.forEach((rich) => {
    if (!rich) return;
    collectDriveIdFromUrl_(rich.getLinkUrl(), ids);
    rich.getRuns().forEach((run) => collectDriveIdFromUrl_(run.getLinkUrl(), ids));
  });
  formulas.forEach((formula) => collectDriveIdFromText_(formula, ids));
  displayValues.forEach((text) => collectDriveIdFromText_(text, ids));
  return unique_(ids);
}

function collectDriveIdFromText_(text, target) {
  const source = String(text || '');
  const urls = source.match(/https?:\/\/[^\s"')]+/g) || [];
  urls.forEach((url) => collectDriveIdFromUrl_(url, target));
}

function collectDriveIdFromUrl_(url, target) {
  if (!url) return;
  const source = String(url);
  const patterns = [
    /\/file\/d\/([A-Za-z0-9_-]{10,})/,
    /[?&]id=([A-Za-z0-9_-]{10,})/,
    /\/open\?id=([A-Za-z0-9_-]{10,})/
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) { target.push(match[1]); return; }
  }
}

function buildImageMetadata_(fileIds) {
  const images = [];
  unique_(fileIds).slice(0, P_RADIO_MAX_IMAGES).forEach((fileId) => {
    try {
      const file = DriveApp.getFileById(fileId);
      const mimeType = String(file.getMimeType() || '').toLowerCase();
      if (!P_RADIO_ALLOWED_MIME.has(mimeType)) return;
      if (file.getSize() > P_RADIO_MAX_BYTES) return;
      images.push({ fileId: file.getId(), name: file.getName(), mimeType: mimeType });
    } catch (error) {
      console.warn('Driveファイルを検証できませんでした: ' + fileId, error);
    }
  });
  return images;
}

function unique_(values) {
  return [...new Set((values || []).map(String).filter(Boolean))];
}
