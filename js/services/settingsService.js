import { APP_CONFIG } from "../config/appConfig.js?v=40";
import { FONT_LIMITS, getTemplateById } from "../config/templates.js?v=40";
import { clamp } from "../utils/helpers.js?v=40";

const memoryFallback = new Map();

function storageGet(key) {
  try { return localStorage.getItem(key); }
  catch { return memoryFallback.get(key) ?? null; }
}

function storageSet(key, value) {
  memoryFallback.set(key, value);
  try { localStorage.setItem(key, value); } catch { /* ブラウザ制限時はメモリのみ */ }
}

function storageRemove(key) {
  memoryFallback.delete(key);
  try { localStorage.removeItem(key); } catch { /* no-op */ }
}

function safeParse(raw) {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function sanitizeTemplateSettings(templateId, value = {}) {
  const template = getTemplateById(templateId);
  return {
    nameFontSize: clamp(value.nameFontSize ?? template.defaults.nameFontSize, FONT_LIMITS.name.min, FONT_LIMITS.name.max),
    contentFontSize: clamp(value.contentFontSize ?? template.defaults.contentFontSize, FONT_LIMITS.content.min, FONT_LIMITS.content.max),
    boldText: Boolean(value.boldText ?? false)
  };
}

export function loadSettings() {
  const stored = safeParse(storageGet(APP_CONFIG.storageKey));
  const template = getTemplateById(stored.templateId ?? APP_CONFIG.defaultTemplateId);
  const byTemplate = stored.byTemplate && typeof stored.byTemplate === "object" ? stored.byTemplate : {};

  return {
    templateId: template.id,
    byTemplate: {
      ...byTemplate,
      [template.id]: sanitizeTemplateSettings(template.id, byTemplate[template.id])
    }
  };
}

export function saveSettings(settings) {
  const template = getTemplateById(settings.templateId);
  const byTemplate = { ...(settings.byTemplate ?? {}) };
  byTemplate[template.id] = sanitizeTemplateSettings(template.id, byTemplate[template.id]);
  const safe = { templateId: template.id, byTemplate };
  storageSet(APP_CONFIG.storageKey, JSON.stringify(safe));
  return safe;
}

export function getTemplateSettings(settings, templateId) {
  const template = getTemplateById(templateId);
  return sanitizeTemplateSettings(template.id, settings.byTemplate?.[template.id]);
}

export function updateTemplateSettings(settings, templateId, patch) {
  const template = getTemplateById(templateId);
  const current = getTemplateSettings(settings, template.id);
  const next = {
    ...settings,
    templateId: template.id,
    byTemplate: {
      ...(settings.byTemplate ?? {}),
      [template.id]: sanitizeTemplateSettings(template.id, { ...current, ...patch })
    }
  };
  return saveSettings(next);
}

export function resetTemplateSettings(settings, templateId) {
  const template = getTemplateById(templateId);
  const next = {
    ...settings,
    templateId: template.id,
    byTemplate: {
      ...(settings.byTemplate ?? {}),
      [template.id]: {
        nameFontSize: template.defaults.nameFontSize,
        contentFontSize: template.defaults.contentFontSize,
        boldText: false
      }
    }
  };
  return saveSettings(next);
}

export function saveSelectedResponseId(id) {
  if (id) storageSet(APP_CONFIG.selectedResponseKey, String(id));
  else storageRemove(APP_CONFIG.selectedResponseKey);
}

export function loadSelectedResponseId() {
  return storageGet(APP_CONFIG.selectedResponseKey) || "";
}
