import { getTemplateById } from "../config/templates.js?v=41";
import { setText } from "../utils/dom.js?v=41";
import { getPublicImageUrl } from "../services/publicImageService.js?v=41";
import { openImageLightbox } from "./imageLightbox.js?v=43";

const renderSequences = new WeakMap();

export function applyTemplateStylesheet(linkElement, templateId) {
  const template = getTemplateById(templateId);
  const stylesheetHref = `${template.stylesheet}?v=41`;
  if (linkElement.getAttribute("href") !== stylesheetHref) linkElement.setAttribute("href", stylesheetHref);
  return template;
}

function createImagesContainer(content, response, sequence) {
  const images = Array.isArray(response.images) ? response.images : [];
  if (!images.length) return;
  const section = document.createElement("section");
  section.className = "response-images";
  section.setAttribute("aria-label", `投稿画像 ${images.length}件`);

  images.forEach((image, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "response-image";
    button.setAttribute("aria-label", `投稿画像 ${index + 1} を拡大表示`);
    button.dataset.state = "loading";

    const preview = document.createElement("img");
    preview.className = "response-image__preview";
    preview.alt = `投稿画像 ${index + 1}`;
    preview.loading = "lazy";
    preview.decoding = "async";
    preview.hidden = true;
    const state = document.createElement("span");
    state.className = "response-image__state";
    state.textContent = "画像読込中";
    button.append(preview, state);
    button.addEventListener("click", () => openImageLightbox({ images, startIndex: index, trigger: button }));
    section.append(button);

    try {
      const imageUrl = getPublicImageUrl(image, { variant: "thumb" });
      preview.addEventListener("load", () => {
        if (renderSequences.get(content) !== sequence || !button.isConnected) return;
        preview.hidden = false;
        state.textContent = "";
        button.dataset.state = "ready";
      }, { once: true });
      preview.addEventListener("error", () => {
        if (renderSequences.get(content) !== sequence || !button.isConnected) return;
        state.textContent = "画像を表示できません";
        button.dataset.state = "error";
        button.disabled = true;
      }, { once: true });
      preview.src = imageUrl;
    } catch (error) {
      state.textContent = error.message || "画像を表示できません";
      button.dataset.state = "error";
      button.disabled = true;
    }
  });
  content.append(section);
}

export function renderResponse(host, response, options = {}) {
  const root = host.querySelector(".template-root");
  const name = host.querySelector(".response-name");
  const content = host.querySelector(".response-content");
  const label = host.querySelector(".template-label");
  if (!root || !name || !content) throw new Error("Template DOM is incomplete.");

  const template = getTemplateById(options.templateId);
  root.dataset.template = template.id;
  root.style.setProperty("--name-font-size", `${options.nameFontSize ?? template.defaults.nameFontSize}px`);
  root.style.setProperty("--content-font-size", `${options.contentFontSize ?? template.defaults.contentFontSize}px`);
  root.style.setProperty("--content-height", `${template.defaults.contentHeight}px`);
  root.style.setProperty("--content-line-height", String(template.defaults.contentLineHeight));
  root.dataset.boldText = options.boldText ? "true" : "false";

  if (label) setText(label, template.label);
  setText(name, response?.name || "お名前未入力");
  setText(content, response?.content || (response?.images?.length ? "" : "内容未入力"));
  const sequence = (renderSequences.get(content) || 0) + 1;
  renderSequences.set(content, sequence);
  createImagesContainer(content, response ?? {}, sequence);
  return template;
}
