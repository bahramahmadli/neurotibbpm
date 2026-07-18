import store from "./store.js";

const titleEl = document.getElementById("projectTitle");
const descEl = document.getElementById("projectDesc");
const ownerEl = document.getElementById("metaOwner");
const versionEl = document.getElementById("metaVersion");
const lastUpdatedEl = document.getElementById("metaLastUpdated");
const statusEl = document.getElementById("metaStatus");

export function initHeader() {
  // Bind store state to header UI
  store.on("change", (data) => {
    const meta = data.metadata || {};
    
    // Only update if not currently focused to avoid messing up caret
    if (document.activeElement !== titleEl) titleEl.textContent = meta.title || "AANA Product Roadmap";
    if (document.activeElement !== descEl) descEl.textContent = meta.description || "";
    if (document.activeElement !== ownerEl) ownerEl.textContent = meta.owner || "";
    if (document.activeElement !== versionEl) versionEl.textContent = meta.version || "";
    if (document.activeElement !== lastUpdatedEl) lastUpdatedEl.textContent = meta.lastUpdated || "";
    if (document.activeElement !== statusEl) statusEl.textContent = meta.status || "";
  });

  // Setup inline editing listeners
  const setupEditable = (el, fieldName) => {
    if (!el) return;

    // Prevent multiline for title and metadata fields
    if (el !== descEl) {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          el.blur();
        }
      });
    }

    el.addEventListener("blur", () => {
      const text = el.textContent.trim();
      const currentMeta = store.getMetadata();
      
      if (currentMeta[fieldName] !== text) {
        store.updateMetadata({ [fieldName]: text });
      }
    });
  };

  setupEditable(titleEl, "title");
  setupEditable(descEl, "description");
  setupEditable(ownerEl, "owner");
  setupEditable(versionEl, "version");
  setupEditable(lastUpdatedEl, "lastUpdated");
  setupEditable(statusEl, "status");
}
