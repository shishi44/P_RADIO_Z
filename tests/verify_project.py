from pathlib import Path
import json, re, sys

root = Path(__file__).resolve().parents[1]
errors = []

def check(condition, message):
    if not condition:
        errors.append(message)

sample = json.loads((root / 'data/sampleResponses.json').read_text(encoding='utf-8'))
check(sample['count'] == len(sample['responses']), 'sample count mismatch')
check(any('<script>alert(1)</script>' in x.get('content', '') for x in sample['responses']), 'XSS sample missing')

required = [
    'index.html', 'viewer.html', 'obs.html', 'capture.html',
    'js/editor.js', 'js/services/responseService.js', 'js/services/imageGatewayService.js',
    'js/ui/responseRenderer.js', 'js/ui/imageLightbox.js', 'js/utils/obsUrl.js',
    'apps-script/Code.gs', 'gateway/server.js', 'gateway/package.json',
    'docs/architecture.md', 'docs/setup.md', 'docs/security.md'
]
for rel in required:
    check((root / rel).exists(), f'missing: {rel}')

removed = ['js/services/csvStorage.js', 'js/utils/obsExport.js', 'js/v31-patch.js']
for rel in removed:
    check(not (root / rel).exists(), f'obsolete file still exists: {rel}')

templates = ['clean','paper','radio','postcard','notebook','studio','sakura','pop','airwave','editorial','midnight','ticket']
for template in templates:
    css = root / f'templates/{template}/{template}.css'
    check(css.exists(), f'missing css: {template}')

js = '\n'.join(p.read_text(encoding='utf-8') for p in (root / 'js').rglob('*.js'))
check('innerHTML =' not in js and '.innerHTML=' not in js, 'innerHTML assignment detected')
check('insertAdjacentHTML' not in js, 'insertAdjacentHTML detected')
check('textContent' in (root / 'js/utils/dom.js').read_text(encoding='utf-8'), 'textContent helper missing')
check('parseCsv' not in js, 'CSV parser reference detected')
check('downloadStandaloneObsHtml' not in js, 'standalone OBS HTML reference detected')
check('imageColumn' in js and 'images:' in js, 'image response contract missing')

index = (root / 'index.html').read_text(encoding='utf-8')
check('csv-file-input' not in index and 'OBS用HTMLを保存' not in index, 'removed UI still present')
check('sheet-image-column' in index, 'image column mapping missing')
check('gateway-url-input' in index and 'gateway-token-input' in index, 'gateway settings UI missing')

apps_script = (root / 'apps-script/Code.gs').read_text(encoding='utf-8')
for token in ['FV_IMAGES_JSON', 'FILE_UPLOAD', 'DriveApp.getFileById', 'installImageMetadataTrigger']:
    check(token in apps_script, f'Apps Script requirement missing: {token}')

gateway = (root / 'gateway/server.js').read_text(encoding='utf-8')
for token in ['P_RADIO_ACCESS_TOKEN', 'DRIVE_ALLOWED_FOLDER_ID', 'drive.readonly', 'timingSafeEqual', 'image/webp', 'sharp(']:
    check(token in gateway, f'Gateway security requirement missing: {token}')
check('service-account' not in gateway.lower(), 'hard-coded service account hint detected')

readme = (root / 'README.md').read_text(encoding='utf-8')
check('CSV読み込み: **廃止**' in readme, 'README CSV removal not documented')
check('OBS用単一HTML書き出し: **廃止**' in readme, 'README standalone HTML removal not documented')

if errors:
    print('FAILED')
    for error in errors:
        print('-', error)
    sys.exit(1)
print('Python project verification: OK')
