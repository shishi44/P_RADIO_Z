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

Google Cloud Shellで `gateway/deploy-cloud-run.sh` を使うと、API有効化、専用サービスアカウント、Secret Manager、ソースデプロイ、ヘルスチェックまで自動化できます。

```bash
PROJECT_ID="your-google-cloud-project-id" \
DRIVE_ALLOWED_FOLDER_ID="your-form-file-responses-root-folder-id" \
./gateway/deploy-cloud-run.sh
```

`DRIVE_ALLOWED_FOLDER_ID` には、質問別サブフォルダではなくGoogleフォームが作る **`<フォーム名> (File responses)` 親フォルダ**を指定します。Gateway側は配下フォルダを最大8階層まで確認します。

Cloud Run実行サービスアカウントを、その親フォルダの「閲覧者」として共有してください。Drive全体の権限は不要です。アクセスキーはGitHubへ保存せずSecret Managerへ格納します。

主要設定:

- `P_RADIO_ACCESS_TOKEN`: Secret ManagerからCloud Runへ注入
- `DRIVE_ALLOWED_FOLDER_ID`: Googleフォームの `File responses` 親フォルダID
- `ALLOWED_ORIGINS`: `https://shishi44.github.io`

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
