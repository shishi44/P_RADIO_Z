# P_RADIO_Z

Googleフォームのお便りをGoogle Sheetsから読み込み、配信・OBS向けテンプレートへ整形する静的Webアプリです。画像付き投稿は **B+方式**（非公開Google Drive + Apps Scriptメタデータ連携 + Cloud Run Image Gateway）で扱います。

## 方針

- 回答本文: 公開Google SheetsをGVizで読み取り。
- 投稿画像: Google Drive原本は非公開のまま。
- 画像メタデータ: Apps Scriptが `FV_IMAGES_JSON` 列へ `fileId / name / mimeType` を書き出す。
- 画像配信: Cloud Run GatewayがBearer認証後にDriveから取得し、WebPへ再エンコードして返す。
- 対応画像: JPEG / PNG / WebP。
- 画像表示: 小サムネイル + クリック/タップ/キーボードで拡大。
- OBS: Browser Source URL + Luaホットキー、または専用キャプチャ画面。
- CSV読み込み: **廃止**。
- OBS用単一HTML書き出し: **廃止**。

## ディレクトリ

- `index.html`: 管理・編集画面
- `viewer.html`: Viewer
- `obs.html`: OBS Browser Source
- `capture.html`: ウィンドウキャプチャ画面
- `js/`: フロントエンド
- `templates/`: 12テンプレート
- `apps-script/`: Googleフォーム画像メタデータ連携
- `gateway/`: Cloud Run画像Gateway
- `obs/`: OBS Luaホットキー
- `tests/`: 静的検証

## 初期設定

1. Googleフォームの回答先をGoogleスプレッドシートにする。
2. 回答本文をGVizで読めるよう、回答シートを「リンクを知っている全員 / 閲覧者」にする。公開したくない個人情報は同じシートへ置かない。
3. `apps-script/Code.gs` を回答スプレッドシートのApps Scriptへ貼り付け、`installImageMetadataTrigger()` を実行する。
4. `gateway/` をCloud Runへデプロイする。
5. Cloud Run実行サービスアカウントへ、フォーム画像アップロード先フォルダの閲覧権限だけを付与する。
6. 管理画面でシートURL、列、Gateway URL、アクセスキーを設定する。

詳細は `docs/setup.md` と `docs/architecture.md` を参照してください。

## セキュリティ

- GitHub Pages側へサービスアカウント鍵やCloud認証情報を置かない。
- GatewayのアクセスキーはブラウザlocalStorageへ保存される。OBS URL生成時はURLクエリにも含まれるため、そのURL自体を秘密情報として扱う。
- Gatewayは `DRIVE_ALLOWED_FOLDER_ID` 配下のJPEG/PNG/WebPだけ許可する。
- Gatewayは画像をWebPへ再エンコードし、EXIF等のメタデータを除去する。
- 投稿本文は `textContent` で描画し、HTMLとして実行しない。

## テスト

```bash
node tests/static-check.mjs
python tests/verify_project.py
find js -name '*.js' -print0 | xargs -0 -n1 node --check
cd gateway && npm run check
```

GitHub Pagesへの公開は、開発・検証後に明示的に行ってください。
