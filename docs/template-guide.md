# テンプレート追加ガイド

1. `templates/<template-id>/` を作る。
2. `<template-id>.css` を作る。
3. `js/config/templates.js` に登録する。
4. `.template-root[data-template="<template-id>"]` の配下だけをスタイルする。
5. 次のCSS変数を利用する。
   - `--name-font-size`
   - `--content-font-size`
   - `--content-height`
   - `--content-line-height`
6. `.response-content` の固定高・縦スクロール・折り返しを壊さない。
7. 短文、3000文字以上、改行、長URL、HTML文字列で確認する。

## 共通DOM

```html
<article class="template-root" data-template="clean">
  <header class="template-name-wrap">
    <p class="template-label"></p>
    <h1 class="response-name"></h1>
  </header>
  <div class="template-divider"></div>
  <div class="response-content"></div>
</article>
```

投稿データはJavaScript側が `textContent` で設定します。テンプレート側から `innerHTML` を使わないでください。
