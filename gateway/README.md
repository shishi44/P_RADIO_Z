# P_RADIO_Z Image Gateway (Cloud Run)

非公開Google Drive画像を、P_RADIO_ZだけがBearerトークン付きで取得する読み取り専用Gatewayです。

## 推奨デプロイ: Cloud Shell

`gateway/deploy-cloud-run.sh` は次を自動化します。

- Cloud Run / Cloud Build / Artifact Registry / Secret Manager / Drive API の有効化
- 専用Cloud Run実行サービスアカウントの作成
- 64文字ランダムアクセスキーの生成とSecret Manager保存
- Secret Managerの最小権限付与
- `gateway/` からCloud Runへソースデプロイ
- `/healthz` の疎通確認
- Gateway URL・アクセスキー・サービスアカウントをCloud Shell内の権限600ファイルへ保存

Google Cloud Shellでリポジトリをcloneした後、次のように実行します。

```bash
PROJECT_ID="your-google-cloud-project-id" \
DRIVE_ALLOWED_FOLDER_ID="your-form-file-responses-root-folder-id" \
./gateway/deploy-cloud-run.sh
```

既定リージョンは `asia-northeast1`、サービス名は `p-radio-z-image-gateway` です。

初回実行後、表示されたCloud Run実行サービスアカウントを、Googleフォームが作成した **`<フォーム名> (File responses)` の親フォルダ** に「閲覧者」として共有してください。質問ごとの `画像（任意） (File responses)` サブフォルダではなく、その1つ上を許可ルートにすると、同じフォーム内の将来のファイルアップロード質問にも対応できます。

画像1枚まで含めて確認する場合は、Drive共有後に次を実行できます。

```bash
PROJECT_ID="your-google-cloud-project-id" \
DRIVE_ALLOWED_FOLDER_ID="your-form-file-responses-root-folder-id" \
TEST_FILE_ID="a-drive-image-file-id" \
./gateway/deploy-cloud-run.sh
```

既存のアクセスキーをローテーションする場合のみ `ROTATE_ACCESS_TOKEN=1` を付けます。ローテーション後はP_RADIO_Z側のGatewayアクセスキーも更新してください。

## 必須環境変数

- `P_RADIO_ACCESS_TOKEN`: 24文字以上のランダムな秘密値。デプロイスクリプトではSecret Managerに保存します。
- `DRIVE_ALLOWED_FOLDER_ID`: Googleフォームの `File responses` 親フォルダID。Gatewayはこのフォルダ配下の画像だけ配信します。
- `ALLOWED_ORIGINS`: 既定値 `https://shishi44.github.io`。複数はカンマ区切り。

## Drive権限

Cloud Run実行サービスアカウントに、Googleフォームの `File responses` 親フォルダの**閲覧者**権限だけを付与してください。Drive全体の権限は不要です。

Cloud Run自体はブラウザの静的サイトから呼び出せるよう公開Invokerにしますが、画像APIは別途 `P_RADIO_ACCESS_TOKEN` のBearer認証を必須にしています。CORSも `ALLOWED_ORIGINS` へ制限します。

## エンドポイント

- `GET /healthz`
- `GET /v1/images/:fileId?variant=thumb|full`

画像エンドポイントでは `Authorization: Bearer <P_RADIO_ACCESS_TOKEN>` が必須です。JPEG/PNG/WebPのみ受け入れ、`sharp` でWebPへ再エンコードするためEXIF等の元メタデータは引き継ぎません。
