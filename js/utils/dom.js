export function qs(selector, root = document) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return element;
}

export function setText(element, value) {
  // 投稿本文をHTMLとして実行しないため、必ず textContent を使用する。
  element.textContent = value == null ? "" : String(value);
}

export function setHidden(element, hidden) {
  element.hidden = Boolean(hidden);
}
