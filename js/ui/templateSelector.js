export function renderTemplateSelector(container, templates, selectedId, onSelect) {
  container.replaceChildren();
  const fragment = document.createDocumentFragment();

  templates.forEach((template) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "template-option";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(template.id === selectedId));
    button.dataset.templateId = template.id;

    const preview = document.createElement("span");
    preview.className = "template-option__preview";
    preview.style.background = `linear-gradient(135deg, ${template.previewColors[0]} 0 62%, ${template.previewColors[1]} 62% 100%)`;
    preview.textContent = "Aa";

    const name = document.createElement("span");
    name.className = "template-option__name";
    name.textContent = template.name;

    button.append(preview, name);
    button.addEventListener("click", () => onSelect(template.id));
    fragment.appendChild(button);
  });

  container.appendChild(fragment);
}

export function updateSelectedTemplate(container, selectedId) {
  container.querySelectorAll(".template-option").forEach((item) => {
    item.setAttribute("aria-checked", String(item.dataset.templateId === selectedId));
  });
}
