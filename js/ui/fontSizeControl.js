import { clamp } from "../utils/helpers.js";

export function createFontSizeControl(container, options) {
  container.replaceChildren();
  const row = document.createElement("div");
  row.className = "font-control__row";

  const range = document.createElement("input");
  range.type = "range";
  range.min = String(options.min);
  range.max = String(options.max);
  range.step = String(options.step ?? 1);
  range.value = String(options.value);
  range.setAttribute("aria-label", options.label);

  const numberWrap = document.createElement("div");
  numberWrap.className = "font-control__number-wrap";
  const number = document.createElement("input");
  number.className = "font-control__number";
  number.type = "number";
  number.min = String(options.min);
  number.max = String(options.max);
  number.step = String(options.step ?? 1);
  number.value = String(options.value);
  number.setAttribute("aria-label", `${options.label} 数値入力`);
  const unit = document.createElement("span");
  unit.className = "font-control__unit";
  unit.textContent = "px";

  const commit = (raw) => {
    const value = clamp(raw, options.min, options.max);
    range.value = String(value);
    number.value = String(value);
    options.onChange(value);
  };

  range.addEventListener("input", () => commit(range.value));
  number.addEventListener("input", () => {
    if (number.value === "") return;
    commit(number.value);
  });
  number.addEventListener("change", () => commit(number.value || options.min));

  numberWrap.append(number, unit);
  row.append(range, numberWrap);
  container.append(row);

  return {
    setValue(value) {
      const next = clamp(value, options.min, options.max);
      range.value = String(next);
      number.value = String(next);
    }
  };
}
