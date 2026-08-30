globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
})();

const { TEMPLATES, getTemplateById } = await import('../js/config/templates.js');
const settings = await import('../js/services/settingsService.js');
const helpers = await import('../js/utils/helpers.js');
const tabular = await import('../js/utils/tabular.js');
const publicImages = await import('../js/services/publicImageService.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(TEMPLATES.length === 12, '12 templates are required');
assert(getTemplateById('radio').name === 'Radio', 'template lookup failed');
assert(getTemplateById('unknown').id === 'clean', 'unknown template must fallback to clean');
assert(helpers.clamp(100, 16, 64) === 64, 'upper clamp failed');
assert(helpers.clamp(1, 16, 64) === 16, 'lower clamp failed');

let state = settings.loadSettings();
state = settings.updateTemplateSettings(state, 'pop', { nameFontSize: 999, contentFontSize: 1 });
let pop = settings.getTemplateSettings(state, 'pop');
assert(pop.nameFontSize === 64, 'name size must clamp to 64');
assert(pop.contentFontSize === 12, 'content size must clamp to 12');
state = settings.resetTemplateSettings(state, 'pop');
pop = settings.getTemplateSettings(state, 'pop');
assert(pop.nameFontSize === 36 && pop.contentFontSize === 20, 'template reset failed');
settings.saveSelectedResponseId('response-10');
assert(settings.loadSelectedResponseId() === 'response-10', 'selected response persistence failed');

const headers = ['タイムスタンプ', 'お名前(ラジオネーム)', '内容', 'FV_IMAGES_JSON'];
const mapping = tabular.suggestColumnMapping(headers);
assert(mapping.timestampColumn === 0 && mapping.nameColumn === 1 && mapping.contentColumn === 2 && mapping.imageColumn === 3, 'column suggestion failed');

const imageJson = JSON.stringify([
  {
    fileId: '1AbCdEfGhIjKlMnOp',
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    public: true,
    resourceKey: '0-testKey',
    thumbnailUrl: 'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOp&sz=w640',
    url: 'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOp&sz=w2560'
  },
  { fileId: '2AbCdEfGhIjKlMnOp', name: 'unsafe.svg', mimeType: 'image/svg+xml' }
]);
const payload = tabular.tableToResponsePayload({ headers, rows: [['2026-08-30T00:00:00Z', '獅子', '本文', imageJson]] }, mapping, { reverse: false });
assert(payload.responses.length === 1, 'response mapping failed');
assert(payload.responses[0].images.length === 1, 'image MIME filtering failed');
assert(payload.responses[0].images[0].name === 'photo.jpg', 'image metadata mapping failed');
assert(payload.responses[0].images[0].public === true, 'public image flag missing');
assert(publicImages.getPublicImageUrl(payload.responses[0].images[0], { variant: 'thumb' }).startsWith('https://drive.google.com/thumbnail'), 'public Drive URL failed');
assert(publicImages.getPublicImageUrl({ fileId: '1AbCdEfGhIjKlMnOp', resourceKey: '0-testKey' }, { variant: 'full' }).includes('sz=w2560'), 'fallback Drive URL failed');
let unsafeRejected = false;
try { publicImages.getPublicImageUrl({ fileId: '1AbCdEfGhIjKlMnOp', url: 'https://evil.example/image.jpg' }, { variant: 'full' }); } catch { unsafeRejected = true; }
assert(unsafeRejected, 'non-Drive image URL must be rejected');

console.log('Node static behavior checks: OK');
