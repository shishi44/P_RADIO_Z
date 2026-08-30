import { loadImageObjectUrl } from "../services/imageGatewayService.js?v=40";

let dialog;
let imageElement;
let titleElement;
let positionElement;
let stateElement;
let previousButton;
let nextButton;
let currentImages = [];
let currentIndex = 0;
let currentConnection = null;
let restoreTarget = null;
let requestSequence = 0;

function buildDialog() {
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.className = "image-lightbox";
  dialog.setAttribute("aria-label", "投稿画像の拡大表示");

  const shell = document.createElement("div");
  shell.className = "image-lightbox__shell";
  const header = document.createElement("header");
  header.className = "image-lightbox__header";
  const meta = document.createElement("div");
  titleElement = document.createElement("strong");
  titleElement.className = "image-lightbox__title";
  positionElement = document.createElement("span");
  positionElement.className = "image-lightbox__position";
  meta.append(titleElement, positionElement);
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "image-lightbox__close";
  closeButton.setAttribute("aria-label", "画像を閉じる");
  closeButton.textContent = "×";
  closeButton.addEventListener("click", () => dialog.close());
  header.append(meta, closeButton);

  const stage = document.createElement("div");
  stage.className = "image-lightbox__stage";
  previousButton = document.createElement("button");
  previousButton.type = "button";
  previousButton.className = "image-lightbox__nav image-lightbox__nav--prev";
  previousButton.setAttribute("aria-label", "前の画像");
  previousButton.textContent = "←";
  previousButton.addEventListener("click", () => move(-1));
  imageElement = document.createElement("img");
  imageElement.className = "image-lightbox__image";
  imageElement.alt = "";
  nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "image-lightbox__nav image-lightbox__nav--next";
  nextButton.setAttribute("aria-label", "次の画像");
  nextButton.textContent = "→";
  nextButton.addEventListener("click", () => move(1));
  stateElement = document.createElement("div");
  stateElement.className = "image-lightbox__state";
  stateElement.setAttribute("role", "status");
  stage.append(previousButton, imageElement, nextButton, stateElement);
  shell.append(header, stage);
  dialog.append(shell);
  document.body.append(dialog);

  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
  });
  dialog.addEventListener("close", () => {
    requestSequence += 1;
    const target = restoreTarget;
    restoreTarget = null;
    target?.focus?.({ preventScroll: true });
  });
  return dialog;
}

async function renderCurrent() {
  const image = currentImages[currentIndex];
  if (!image) return;
  const sequence = ++requestSequence;
  titleElement.textContent = image.name || "投稿画像";
  positionElement.textContent = `${currentIndex + 1} / ${currentImages.length}`;
  previousButton.disabled = currentIndex <= 0;
  nextButton.disabled = currentIndex >= currentImages.length - 1;
  imageElement.hidden = true;
  imageElement.removeAttribute("src");
  stateElement.textContent = "画像を読み込んでいます…";
  stateElement.dataset.state = "loading";
  try {
    const objectUrl = await loadImageObjectUrl(image, currentConnection, { variant: "full" });
    if (sequence !== requestSequence || !dialog.open) return;
    imageElement.src = objectUrl;
    imageElement.alt = image.name || `投稿画像 ${currentIndex + 1}`;
    imageElement.hidden = false;
    stateElement.textContent = "";
    stateElement.dataset.state = "";
  } catch (error) {
    if (sequence !== requestSequence || !dialog.open) return;
    stateElement.textContent = error.message || "画像を表示できませんでした。";
    stateElement.dataset.state = "error";
  }
}
function move(delta) {
  const next = Math.max(0, Math.min(currentImages.length - 1, currentIndex + delta));
  if (next === currentIndex) return;
  currentIndex = next;
  renderCurrent();
}

export function openImageLightbox({ images, startIndex = 0, connection, trigger } = {}) {
  if (!Array.isArray(images) || !images.length) return;
  buildDialog();
  currentImages = images;
  currentIndex = Math.max(0, Math.min(images.length - 1, Number(startIndex) || 0));
  currentConnection = connection;
  restoreTarget = trigger instanceof HTMLElement ? trigger : document.activeElement;
  if (!dialog.open) dialog.showModal();
  renderCurrent();
}
