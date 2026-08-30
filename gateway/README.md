# P_RADIO_Z Image Gateway (Cloud Run)

非公開Google Drive画像を、P_RADIO_ZだけがBearerトークン付きで取得する読み取り専用Gatewayです。

## 必須環境変数

- `P_RADIO_ACCESS_TOKEN`: 24文字以上のランダムな秘密値。
- `DRIVE_ALLOWED_FOLDER_ID`: Googleフォームのアップロード先フォルダID。Gatewayはこのフォルダ配下の画像だけ配信します。
- `ALLOWED_ORIGINS`: 既定値 `https://shishi44.github.io`。複数はカンマ区切り。

## Drive権限

Cloud Run実行サービスアカウントに、Googleフォームのアップロード先フォルダの**閲覧者**権限だけを付与してください。Drive全体の権限は不要です。

## エンドポイント

`GET /v1/images/:fileId?variant=thumb|full`

`Authorization: Bearer <P_RADIO_ACCESS_TOKEN>` が必須です。JPEG/PNG/WebPのみ受け入れ、`sharp` でWebPへ再エンコードするためEXIF等のメタデータは引き継ぎません。
