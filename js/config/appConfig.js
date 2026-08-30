export const APP_CONFIG = Object.freeze({
  requestTimeoutMs: 15000,
  sheetRefreshMs: 60000,
  defaultTemplateId: "clean",
  sampleDataUrl: "./data/sampleResponses.json",
  maxImagesPerResponse: 6,

  // Browser-local settings. Secrets are never hard-coded into the repository.
  storageKey: "pradio-z.settings.v1",
  selectedResponseKey: "pradio-z.selected-response.v1",
  connectionKey: "pradio-z.connection.v1",
  reviewStateKey: "pradio-z.review-state.v1"
});
