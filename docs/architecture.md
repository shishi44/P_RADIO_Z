# Architecture

## 全体

```text
Google Form
  ├─ text response ──> Google Sheets (GViz) ───────────────┐
  └─ file upload ────> Private Google Drive               │
                            │                              │
Apps Script onFormSubmit    │                              │
  └─ fileId/name/mime ──> FV_IMAGES_JSON ─────────────────┤
                                                           ▼
                                                   P_RADIO_Z GitHub Pages
                                                           │
                                             Bearer-authenticated fetch
                                                           ▼
                                                Cloud Run Image Gateway
                                                           │
                                                   Drive API (readonly)
                                                           ▼
                                               resize/re-encode to WebP
```

## フロントエンド

回答契約は次の形です。

```js
{
  id,
  submittedAt,
  name,
  content,
  images: [
    { fileId, name, mimeType }
  ]
}
```

`renderResponse()` は管理画面 / Viewer / OBS / Captureで共通です。画像も同じ共通レンダラーから表示します。

## データ経路

Google SheetsはGViz JSONPを維持し、列マッピングで `FV_IMAGES_JSON` を任意画像列として選択します。画像列がない既存フォームでも本文表示は通常どおり動作します。

## 画像経路

ブラウザはDrive URLへ直接アクセスしません。`imageGatewayService.js` がGatewayへBearer認証付き `fetch()` を行い、Blob URLとしてサムネイル/拡大画像を表示します。

Gatewayは以下を検証します。

- Bearer token
- fileId形式
- 許可Driveフォルダ直下か
- MIMEがJPEG/PNG/WebPか
- Drive上のサイズ上限
- ダウンロード可否
- 入力画素数

その後WebPへ再エンコードします。
