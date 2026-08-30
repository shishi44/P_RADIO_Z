/**
 * P_RADIO_Z - Google Forms image bridge (simple public-link edition)
 *
 * 使い方:
 * 1. Googleフォームの回答スプレッドシートで「拡張機能 → Apps Script」を開く
 * 2. このファイルを貼り付けて保存
 * 3. setupPradioZ() を1回だけ実行して権限を許可
 *
 * 以後、フォームに添付されたJPEG/PNG/WebPを「リンクを知っている全員・閲覧者」へ
 * 自動変更し、FV_IMAGES_JSON列へ表示用URLを書き込みます。
 */
const P_RADIO_IMAGE_HEADER = 'FV_IMAGES_JSON';
const P_RADIO_MAX_IMAGES = 6;
const P_RADIO_MAX_BYTES = 20 * 1024 * 1024;
const P_RADIO_ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('P_RADIO_Z')
    .addItem('初期設定をする', 'setupPradioZ')
    .addItem('最新の回答を再処理', 'processLatestResponseRow')
    .addItem('すべての回答を再処理', 'processAllResponseRows')
    .addToUi();
}

/**
 * 初回に1回だけ実行します。
 * - フォーム送信トリガーを作成
 * - FV_IMAGES_JSON列を作成
 * - 既存の最新回答も再処理
 */
function setupPradioZ() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = findResponseSheet_(spreadsheet);

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === 'handleFormSubmit')
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('handleFormSubmit').forSpreadsheet(spreadsheet).onFormSubmit().create();

  ensureMetadataColumn_(sheet);
  if (sheet.getLastRow() >= 2) {
    processResponseRow_(sheet, sheet.getLastRow(), sheet.getRange(sheet.getLastRow(), 1).getValue());
  }

  SpreadsheetApp.getUi().alert(
    'P_RADIO_Zの初期設定が完了しました。\n\n' +
    '今後の画像は自動で「リンクを知っている全員・閲覧者」に変更され、FV_IMAGES_JSONへ表示情報が入ります。'
  );
}

// 旧手順との互換用。既存の説明から実行しても同じ初期設定になります。
function installImageMetadataTrigger() {
  setupPradioZ();
}

function handleFormSubmit(e) {
  if (!e || !e.range) throw new Error('スプレッドシートのフォーム送信トリガーから実行してください。');
  processResponseRow_(e.range.getSheet(), e.range.getRow(), e.values && e.values[0]);
}

function processLatestResponseRow() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = findResponseSheet_(spreadsheet);
  if (sheet.getLastRow() < 2) throw new Error('回答行がありません。');
  processResponseRow_(sheet, sheet.getLastRow(), sheet.getRange(sheet.getLastRow(), 1).getValue());
  SpreadsheetApp.getUi().alert('最新の回答を再処理しました。');
}

function processAllResponseRows() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = findResponseSheet_(spreadsheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('回答行がありません。');

  for (let row = 2; row <= lastRow; row += 1) {
    processResponseRow_(sheet, row, sheet.getRange(row, 1).getValue());
  }
  SpreadsheetApp.getUi().alert((lastRow - 1) + '件の回答を再処理しました。');
}

function processResponseRow_(sheet, row, timestampValue) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const metadataColumn = ensureMetadataColumn_(sheet);
    const spreadsheet = sheet.getParent();
    const timestamp = timestampValue instanceof Date ? timestampValue : new Date(timestampValue);

    // 行そのもののリンクを最優先にするため、同時刻付近の別回答を取り違えにくい。
    let fileIds = extractFileIdsFromSheetRow_(sheet, row);
    if (!fileIds.length && !Number.isNaN(timestamp.getTime())) {
      fileIds = extractFileIdsFromFormResponse_(spreadsheet, timestamp);
    }

    const metadata = buildImageMetadata_(fileIds);
    sheet.getRange(row, metadataColumn).setValue(JSON.stringify(metadata));
  } finally {
    lock.releaseLock();
  }
}

function findResponseSheet_(spreadsheet) {
  const sheets = spreadsheet.getSheets();
  for (const sheet of sheets) {
    const lastColumn = Math.max(1, sheet.getLastColumn());
    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    if (headers.some((value) => String(value).trim() === 'タイムスタンプ')) return sheet;
  }
  return spreadsheet.getActiveSheet();
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
      if (diff < closestDiff && diff <= 2 * 60 * 1000) {
        closest = response;
        closestDiff = diff;
      }
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
    console.warn('FormResponseから画像IDを取得できませんでした。', error);
    return [];
  }
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
    if (match) {
      target.push(match[1]);
      return;
    }
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

      let publicAccess = true;
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (sharingError) {
        publicAccess = false;
        console.warn('画像をリンク共有へ変更できませんでした: ' + fileId, sharingError);
      }

      const resourceKey = String(file.getResourceKey() || '');
      const urls = publicAccess ? buildPublicImageUrls_(file.getId(), resourceKey) : { thumbnailUrl: '', url: '' };
      images.push({
        fileId: file.getId(),
        name: file.getName(),
        mimeType: mimeType,
        public: publicAccess,
        resourceKey: resourceKey,
        thumbnailUrl: urls.thumbnailUrl,
        url: urls.url
      });
    } catch (error) {
      console.warn('Driveファイルを検証できませんでした: ' + fileId, error);
    }
  });
  return images;
}

function buildPublicImageUrls_(fileId, resourceKey) {
  const base = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId);
  const key = resourceKey ? '&resourcekey=' + encodeURIComponent(resourceKey) : '';
  return {
    thumbnailUrl: base + '&sz=w640' + key,
    url: base + '&sz=w2560' + key
  };
}

function unique_(values) {
  return [...new Set((values || []).map(String).filter(Boolean))];
}
