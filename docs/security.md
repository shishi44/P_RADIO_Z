# Security Notes

- Drive原画像は匿名公開しない。
- GitHubリポジトリへ秘密鍵、サービスアカウントJSON、Bearer tokenをコミットしない。
- Gatewayは読み取り専用Drive scopeを使用する。
- Cloud Runサービスアカウントにはアップロード先フォルダだけを共有する。
- `DRIVE_ALLOWED_FOLDER_ID` で任意のDrive file IDをプロキシできないよう制限する。
- JPEG/PNG/WebP以外は拒否する。SVG/HTMLは配信しない。
- `sharp` で再エンコードしてEXIF等を除去する。
- フロントエンド本文は `textContent` を維持する。
- OBS URLにアクセスキーが入る場合、URLは認証情報として扱う。
