# Setup

## 1. Googleフォーム / Sheets

Googleフォームの回答先をGoogleスプレッドシートにします。現在の静的GitHub Pages構成では本文取得にGVizを使うため、回答シートは閲覧可能な共有設定が必要です。

## 2. Apps Script

回答スプレッドシートで **拡張機能 → Apps Script** を開き、`apps-script/Code.gs` を貼り付けます。`installImageMetadataTrigger()` を1度実行してください。

フォーム送信後、`FV_IMAGES_JSON` 列へ次のような値が入ります。

```json
[{"fileId":"...","name":"photo.jpg","mimeType":"image/jpeg"}]
```

Driveの共有権限は変更しません。

## 3. Cloud Run Gateway

`gateway/` をCloud Runへデプロイします。環境変数:

- `P_RADIO_ACCESS_TOKEN`: 24文字以上のランダム値
- `DRIVE_ALLOWED_FOLDER_ID`: Googleフォームのファイルアップロード先フォルダID
- `ALLOWED_ORIGINS`: `https://shishi44.github.io`

Cloud Runの実行サービスアカウントを、該当Driveフォルダの「閲覧者」として共有してください。

## 4. P_RADIO_Z

管理画面で以下を設定します。

- GoogleスプレッドシートURL
- お名前列
- 内容列
- タイムスタンプ列（任意）
- 画像メタデータ列（通常 `FV_IMAGES_JSON`）
- Gateway URL
- Gatewayアクセスキー

## 5. OBS

「OBSで使う」からBrowser Source URLをコピーします。画像アクセスキーを含む場合、そのURLは第三者へ共有しないでください。
