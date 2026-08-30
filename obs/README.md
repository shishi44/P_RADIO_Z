# P_RADIO_Z OBS

## Browser Source

管理画面の「OBSで使う」からURLをコピーし、OBSの「ソース追加 → ブラウザ」のURLへ貼り付けます。推奨サイズは 1000 x 650 です。背景は透明です。

画像Gatewayを設定している場合、Browser Source URLのフラグメント（`#access=...`）には画像アクセスキーが含まれます。フラグメントはGitHub Pagesへ送信されませんが、URLを配信画面・スクリーンショット・公開文書へ載せないでください。

## ホットキー

`formviewer-hotkeys.lua` をOBSの「ツール → スクリプト」から追加します。Browser Source名をOBS上のソース名と一致させ、「設定 → ホットキー」で前/次・スクロール操作を割り当てます。

単一HTML書き出し方式は廃止しました。
