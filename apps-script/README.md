# Apps Script: 画像メタデータ連携

Googleフォームのファイルアップロード画像を、公開回答シートへ画像そのものではなく安全なメタデータだけ書き出します。

1. Googleフォームの回答先スプレッドシートを開く。
2. **拡張機能 → Apps Script** を開く。
3. `Code.gs` の内容を貼り付けて保存する。
4. `installImageMetadataTrigger()` を1回実行し、必要な権限を許可する。
5. 以後の回答行には `FV_IMAGES_JSON` 列が自動追加・更新される。

書き出す内容は `fileId / name / mimeType` のみです。Drive画像の共有権限は変更しません。
対応形式は JPEG / PNG / WebP、1回答6枚、1ファイル20MBまでです。
