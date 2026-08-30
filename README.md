# P_RADIO_Z

Googleフォームのお便りをGoogle Sheetsから読み込み、配信・OBS向けテンプレートへ整形する静的Webアプリです。

現在は **1人運用向けの簡易画像方式** を採用しています。Googleフォームにアップロードされた画像はApps Scriptが「リンクを知っている全員・閲覧者」に自動変更し、P_RADIO_ZはGoogle Driveの表示URLを直接読み込みます。Cloud Runや専用サーバーは不要です。

## 構成

- フロントエンド: Vanilla HTML / CSS / ES Modules
- 本文データ: Google Sheets GViz JSONP
- 画像メタデータ: Apps Script → `FV_IMAGES_JSON`
- 画像表示: リンク共有済みGoogle Drive画像を直接表示
- 設定保存: browser `localStorage`
- 配信: GitHub Pages想定

## 画像回答形式

```json
{
  "id": "...",
  "submittedAt": "...",
  "name": "...",
  "content": "...",
  "images": [
    {
      "fileId": "...",
      "name": "photo.jpg",
      "mimeType": "image/jpeg",
      "public": true,
      "resourceKey": "...",
      "thumbnailUrl": "https://drive.google.com/thumbnail?...",
      "url": "https://drive.google.com/thumbnail?..."
    }
  ]
}
```

画像列がない既存フォームもそのまま利用できます。

## 初期設定

1. Googleフォームを作り、「お名前」「内容」「画像（任意）」を用意する。
2. 回答先をGoogleスプレッドシートにする。
3. 回答スプレッドシートのApps Scriptへ `apps-script/Code.gs` を貼る。
4. `setupPradioZ()` を1回だけ実行する。
5. 回答スプレッドシートを「リンクを知っている全員・閲覧者」にする。
6. P_RADIO_Zの接続画面へスプレッドシートURLを貼る。

詳細は `docs/setup.md` を参照してください。

## 廃止済み

- CSV読み込み: **廃止**
- OBS用単一HTML書き出し: **廃止**
- Cloud Run Image Gateway: **廃止**
- Gatewayアクセスキー / Secret Manager: **不要**

## セキュリティ

- 本文表示は `textContent` を使い、回答本文をHTMLとして実行しません。
- 画像はJPEG / PNG / WebPのみ扱います。
- 画像はリンク共有になるため、URLを知る人は閲覧できます。
- Google Driveのリンク共有では、ファイル所有者情報が表示される場合があります。
- 機密画像を扱う用途では、この簡易構成ではなく認証付き構成が必要です。

## テスト

```bash
node tests/static-check.mjs
python tests/verify_project.py
```
