from pathlib import Path
import json, sys

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
    'js/editor.js', 'js/services/responseService.js', 'js/services/publicImageService.js',
    'js/ui/responseRenderer.js', 'js/ui/imageLightbox.js', 'js/utils/obsUrl.js',
    'apps-script/Code.gs', 'docs/architecture.md', 'docs/setup.md', 'docs/security.md'
]
for rel in required:
    check((root / rel).exists(), f'missing: {rel}')

removed = [
    'js/services/csvStorage.js', 'js/utils/obsExport.js', 'js/v31-patch.js',
    'js/services/imageGatewayService.js', 'gateway'
]
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
check('imageGatewayUrl' not in js and 'imageGatewayToken' not in js, 'gateway connection state still present')

index = (root / 'index.html').read_text(encoding='utf-8')
check('csv-file-input' not in index and 'OBS用HTMLを保存' not in index, 'removed UI still present')
check('sheet-image-column' in index, 'image column mapping missing')
check('gateway-url-input' not in index and 'gateway-token-input' not in index, 'gateway settings UI still present')

for rel in ['assets/icons/favicon-32.png', 'assets/icons/apple-touch-icon.png']:
    check((root / rel).exists(), f'missing restored icon: {rel}')

base_css = (root / 'css/base.css').read_text(encoding='utf-8')
check('.response-image__preview[hidden]' in base_css and 'display:block!important' in base_css, 'thumbnail hidden/lazy CSS override missing')
check('grid-area:1/1' in base_css, 'thumbnail loading state must overlay image')
check('favicon-32.png?v=42' in index and '<div class="app-mark"' in index, 'legacy app icon not restored')
check('rel="icon"' in index and 'apple-touch-icon' in index, 'favicon links missing')

apps_script = (root / 'apps-script/Code.gs').read_text(encoding='utf-8')
for token in ['FV_IMAGES_JSON', 'setupPradioZ', 'ANYONE_WITH_LINK', 'DriveApp.Permission.VIEW', 'thumbnailUrl', 'resourceKey']:
    check(token in apps_script, f'Apps Script requirement missing: {token}')
check(apps_script.index('extractFileIdsFromSheetRow_') < apps_script.index('extractFileIdsFromFormResponse_'), 'sheet-row extraction should be preferred')

public_service = (root / 'js/services/publicImageService.js').read_text(encoding='utf-8')
check('drive.google.com' in public_service, 'Drive image host validation missing')
check('evil.example' not in public_service, 'unexpected test host in production service')

readme = (root / 'README.md').read_text(encoding='utf-8')
check('CSV読み込み: **廃止**' in readme, 'README CSV removal not documented')
check('OBS用単一HTML書き出し: **廃止**' in readme, 'README standalone HTML removal not documented')
check('Cloud Run Image Gateway: **廃止**' in readme, 'README gateway removal not documented')

if errors:
    print('FAILED')
    for error in errors:
        print('-', error)
    sys.exit(1)
print('Python project verification: OK')
