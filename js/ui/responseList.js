import { formatDateTime, makeExcerpt } from "../utils/helpers.js?v=40";

export function renderResponseList(container, responses, selectedId, options = {}) {
  const {
    onSelect = () => {},
    onReview = () => {},
    numberById = new Map(),
    reviewedIds = new Set(),
    showReviewCheckbox = false
  } = options;

  container.replaceChildren();
  const fragment = document.createDocumentFragment();

  responses.forEach((response, fallbackIndex) => {
    const row = document.createElement("div");
    row.className = "response-item";
    row.dataset.responseId = response.id;
    row.dataset.selected = String(response.id === selectedId);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "response-item__select";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(response.id === selectedId));
    button.dataset.responseId = response.id;

    const number = document.createElement("span");
    number.className = "response-item__number";
    number.textContent = `#${numberById.get(response.id) ?? fallbackIndex + 1}`;

    const main = document.createElement("span");
    main.className = "response-item__main";

    const name = document.createElement("span");
    name.className = "response-item__name";
    name.textContent = response.name || "お名前未入力";

    const excerpt = document.createElement("span");
    excerpt.className = "response-item__excerpt";
    excerpt.textContent = makeExcerpt(response.content) || "内容未入力";

    const time = document.createElement("time");
    time.className = "response-item__time";
    time.dateTime = response.submittedAt;
    time.textContent = formatDateTime(response.submittedAt);

    main.append(name, excerpt, time);
    if (Array.isArray(response.images) && response.images.length) {
      const imageCount = document.createElement("span");
      imageCount.className = "response-item__image-count";
      imageCount.textContent = `画像 ${response.images.length}`;
      main.append(imageCount);
    }
    button.append(number, main);
    button.addEventListener("click", () => onSelect(response.id));
    row.appendChild(button);

    if (showReviewCheckbox) {
      const label = document.createElement("label");
      label.className = "response-item__review";
      label.title = "確認済みにする";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = reviewedIds.has(response.id);
      checkbox.setAttribute("aria-label", `#${numberById.get(response.id) ?? fallbackIndex + 1} を確認済みにする`);
      checkbox.addEventListener("change", () => onReview(response.id, checkbox.checked));
      const text = document.createElement("span");
      text.textContent = "確認";
      label.append(checkbox, text);
      row.appendChild(label);
    } else if (reviewedIds.has(response.id)) {
      const badge = document.createElement("span");
      badge.className = "response-item__reviewed-badge";
      badge.textContent = "確認済み";
      row.appendChild(badge);
    }

    fragment.appendChild(row);
  });
  container.appendChild(fragment);
}

export function updateSelectedResponse(container, selectedId) {
  container.querySelectorAll(".response-item").forEach((item) => {
    const selected = item.dataset.responseId === selectedId;
    item.dataset.selected = String(selected);
    item.querySelector(".response-item__select")?.setAttribute("aria-selected", String(selected));
  });
}
