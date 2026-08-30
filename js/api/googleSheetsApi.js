import { APP_CONFIG } from "../config/appConfig.js?v=40";
import { isValidCallbackName, toStringSafe } from "../utils/helpers.js?v=40";

function validateSpreadsheetId(value) {
  const id = toStringSafe(value).trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) throw new Error("GoogleスプレッドシートIDを確認できませんでした。");
  return id;
}

export function parseGoogleSheetUrl(value) {
  const raw = toStringSafe(value).trim();
  if (!raw) throw new Error("GoogleスプレッドシートのURLを入力してください。");
  const match = raw.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("GoogleスプレッドシートのURL形式を確認してください。");
  const spreadsheetId = validateSpreadsheetId(match[1]);
  const gidMatch = raw.match(/[?#&]gid=(\d+)/);
  return { spreadsheetId, gid: gidMatch ? gidMatch[1] : "0", sourceUrl: raw };
}

function parseGvizDateValue(value) {
  if (typeof value !== "string") return "";
  const match = value.match(/^Date\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+),\s*(\d+),\s*(\d+))?\)$/);
  if (!match) return "";
  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  const date = new Date(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function tableFromGviz(payload) {
  if (!payload || payload.status === "error") {
    const detail = payload?.errors?.[0]?.detailed_message || payload?.errors?.[0]?.message;
    throw new Error(detail || "Googleスプレッドシートを読み込めませんでした。共有設定を確認してください。");
  }
  const table = payload.table;
  if (!table || !Array.isArray(table.cols) || !Array.isArray(table.rows)) {
    throw new Error("Googleスプレッドシートから想定した形式のデータを取得できませんでした。");
  }
  const headers = table.cols.map((column, index) => toStringSafe(column?.label || column?.id || `列${index + 1}`));
  const rows = table.rows.map((row) => headers.map((_, index) => {
    const cell = row?.c?.[index];
    if (!cell) return "";
    const columnType = table.cols[index]?.type;
    if (columnType === "date" || columnType === "datetime") {
      const parsedDate = parseGvizDateValue(cell.v);
      if (parsedDate) return parsedDate;
    }
    if (cell.v instanceof Date) return cell.v.toISOString();
    if (cell.f != null) return toStringSafe(cell.f);
    return toStringSafe(cell.v);
  }));
  return { headers, rows };
}

export function fetchGoogleSheetTable(connection, options = {}) {
  return new Promise((resolve, reject) => {
    const spreadsheetId = validateSpreadsheetId(connection?.spreadsheetId);
    const gid = /^\d+$/.test(toStringSafe(connection?.gid)) ? toStringSafe(connection.gid) : "0";
    const callbackName = `__gfv_sheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    if (!isValidCallbackName(callbackName)) {
      reject(new Error("Google Sheets callback validation failed."));
      return;
    }

    const url = new URL(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq`);
    url.searchParams.set("gid", gid);
    url.searchParams.set("headers", "1");
    url.searchParams.set("tqx", `responseHandler:${callbackName}`);
    url.searchParams.set("_", String(Date.now()));

    const script = document.createElement("script");
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { delete window[callbackName]; } catch { window[callbackName] = undefined; }
      script.remove();
      fn(value);
    };

    window[callbackName] = (payload) => {
      try { finish(resolve, tableFromGviz(payload)); }
      catch (error) { finish(reject, error); }
    };

    script.src = url.toString();
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.onerror = () => finish(reject, new Error("Googleスプレッドシートに接続できませんでした。「リンクを知っている全員が閲覧可」になっているか確認してください。"));

    const timer = setTimeout(
      () => finish(reject, new Error("Googleスプレッドシートの読み込みがタイムアウトしました。")),
      APP_CONFIG.requestTimeoutMs
    );
    if (options.signal) {
      options.signal.addEventListener("abort", () => finish(reject, options.signal.reason ?? new DOMException("Aborted", "AbortError")), { once: true });
    }
    document.head.appendChild(script);
  });
}
