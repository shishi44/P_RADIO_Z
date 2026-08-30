const freezeDefaults = (defaults) => Object.freeze(defaults);

export const TEMPLATES = Object.freeze([
  Object.freeze({
    id: "clean", name: "Clean", label: "MESSAGE FROM", stylesheet: "./templates/clean/clean.css",
    previewColors: ["#ffffff", "#181d26"], defaults: freezeDefaults({ nameFontSize: 32, contentFontSize: 18, contentHeight: 360, contentLineHeight: 1.75 })
  }),
  Object.freeze({
    id: "paper", name: "Paper", label: "LETTER FROM", stylesheet: "./templates/paper/paper.css",
    previewColors: ["#f7f0df", "#604d38"], defaults: freezeDefaults({ nameFontSize: 30, contentFontSize: 18, contentHeight: 390, contentLineHeight: 1.9 })
  }),
  Object.freeze({
    id: "radio", name: "Radio", label: "ON AIR MESSAGE", stylesheet: "./templates/radio/radio.css",
    previewColors: ["#f3efe7", "#264653"], defaults: freezeDefaults({ nameFontSize: 28, contentFontSize: 21, contentHeight: 380, contentLineHeight: 1.8 })
  }),
  Object.freeze({
    id: "postcard", name: "Postcard", label: "POSTCARD FROM", stylesheet: "./templates/postcard/postcard.css",
    previewColors: ["#f7fbff", "#7aa6c6"], defaults: freezeDefaults({ nameFontSize: 30, contentFontSize: 18, contentHeight: 370, contentLineHeight: 1.8 })
  }),
  Object.freeze({
    id: "notebook", name: "Notebook", label: "NOTE FROM", stylesheet: "./templates/notebook/notebook.css",
    previewColors: ["#fffdf6", "#86a7c5"], defaults: freezeDefaults({ nameFontSize: 30, contentFontSize: 18, contentHeight: 380, contentLineHeight: 1.78 })
  }),
  Object.freeze({
    id: "studio", name: "Studio", label: "STUDIO MESSAGE", stylesheet: "./templates/studio/studio.css",
    previewColors: ["#f7f9fa", "#315c6d"], defaults: freezeDefaults({ nameFontSize: 29, contentFontSize: 19, contentHeight: 370, contentLineHeight: 1.75 })
  }),
  Object.freeze({
    id: "sakura", name: "Sakura", label: "LETTER FROM", stylesheet: "./templates/sakura/sakura.css",
    previewColors: ["#fff8fa", "#d98294"], defaults: freezeDefaults({ nameFontSize: 32, contentFontSize: 18, contentHeight: 370, contentLineHeight: 1.8 })
  }),
  Object.freeze({
    id: "pop", name: "Pop", label: "HELLO FROM", stylesheet: "./templates/pop/pop.css",
    previewColors: ["#fff7c7", "#ff5d73"], defaults: freezeDefaults({ nameFontSize: 36, contentFontSize: 20, contentHeight: 350, contentLineHeight: 1.7 })
  }),
  Object.freeze({
    id: "airwave", name: "Airwave", label: "AIRWAVE MESSAGE", stylesheet: "./templates/airwave/airwave.css",
    previewColors: ["#eef9f8", "#2f7f79"], defaults: freezeDefaults({ nameFontSize: 31, contentFontSize: 19, contentHeight: 370, contentLineHeight: 1.78 })
  }),
  Object.freeze({
    id: "editorial", name: "Editorial", label: "LISTENER LETTER", stylesheet: "./templates/editorial/editorial.css",
    previewColors: ["#f4f0e8", "#262626"], defaults: freezeDefaults({ nameFontSize: 34, contentFontSize: 18, contentHeight: 385, contentLineHeight: 1.85 })
  }),
  Object.freeze({
    id: "midnight", name: "Midnight", label: "MIDNIGHT RADIO", stylesheet: "./templates/midnight/midnight.css",
    previewColors: ["#172033", "#e8a75d"], defaults: freezeDefaults({ nameFontSize: 31, contentFontSize: 19, contentHeight: 370, contentLineHeight: 1.8 })
  }),
  Object.freeze({
    id: "ticket", name: "Ticket", label: "REQUEST TICKET", stylesheet: "./templates/ticket/ticket.css",
    previewColors: ["#fff8e8", "#c26b43"], defaults: freezeDefaults({ nameFontSize: 30, contentFontSize: 18, contentHeight: 365, contentLineHeight: 1.78 })
  })
]);

export const FONT_LIMITS = Object.freeze({
  name: Object.freeze({ min: 16, max: 64, step: 1 }),
  content: Object.freeze({ min: 12, max: 40, step: 1 })
});

export function getTemplateById(id) {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];
}
