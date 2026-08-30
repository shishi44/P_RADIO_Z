# Architecture

## 現在の構成

```text
Google Form
  ├─ お名前 / 内容 ───────────────┐
  └─ ファイルアップロード          │
              │                    │
              ▼                    ▼
        Google Drive         Google Sheets
              │                    │
              │              Apps Script onFormSubmit
              │                    │
              │        ┌───────────┴───────────┐
              │        │ FV_IMAGES_JSON         │
              │        │ fileId / URLs / MIME   │
              │        └───────────┬───────────┘
              │                    │
              └─ link-shared image │
                                   ▼
                              P_RADIO_Z
                         Viewer / OBS / Capture
```

## データ取得

本文は従来どおりGoogle SheetsのGViz JSONPを使います。CSV読み込みは廃止済みです。

`FV_IMAGES_JSON` は任意列です。画像質問がないフォームでも本文表示は通常どおり動作します。

## 画像処理

Apps Scriptはフォーム送信時に次を行います。

1. 回答シート行のDriveリンクからfileIdを取得する。
2. 取得できない場合のみFormResponseをフォールバックとして使う。
3. JPEG / PNG / WebP、最大20MB、最大6枚を検証する。
4. Driveファイルを `ANYONE_WITH_LINK + VIEW` に変更する。
5. resource keyとGoogle DriveのサムネイルURLを `FV_IMAGES_JSON` に書く。

ブラウザ側は `publicImageService.js` でGoogle Drive URLだけを許可し、`<img>` の `src` として直接読み込みます。Cloud RunやBearerトークンは使いません。

## 安全性の境界

この構成は「画像がリンクを知る人に見られてもよい」1人運用向けです。画像自体の認証・アクセス制御はありません。機密性が必要になった場合は認証付き画像配信方式へ戻す必要があります。
