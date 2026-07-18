import store from "./store.js";
import { openDrawer } from "./drawer.js";
import { confirmAction } from "./confirm.js";

const overlay = document.getElementById("modalOverlay");
const titleEl = document.getElementById("modalTitle");
const badgesEl = document.getElementById("modalBadges");
const closeBtn = document.getElementById("modalClose");
const editBtn = document.getElementById("btnEditModal");

const figmaContainer = document.getElementById("figmaContainer");
const figmaActions = document.getElementById("figmaActions");

const docContainer = document.getElementById("docContainer");
const docActions = document.getElementById("docActions");

let activeItemId = null;
let isOpen = false;

export function initModal() {
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  // Listen to ESC key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) {
      closeModal();
    }
  });

  editBtn.addEventListener("click", () => {
    if (activeItemId) {
      closeModal();
      openDrawer("edit", activeItemId);
    }
  });

  // Listen to store updates to live-reload modal details if updated in drawer
  store.on("change", () => {
    if (isOpen && activeItemId) {
      renderModalContent();
    }
  });
}

export function openModal(itemId) {
  isOpen = true;
  activeItemId = itemId;
  renderModalContent();
  overlay.classList.add("active");
}

export function closeModal() {
  isOpen = false;
  activeItemId = null;
  overlay.classList.remove("active");
}

function renderModalContent() {
  const item = store.getItems().find(i => i.id === activeItemId);
  if (!item) {
    closeModal();
    return;
  }

  const platform = store.getPlatforms().find(p => p.id === item.platformId);
  const phase = store.getPhases().find(p => p.id === item.phaseId);

  titleEl.textContent = item.title;
  
  // Render badges
  badgesEl.innerHTML = `
    <span class="modal-badge platform-badge">${platform ? platform.name : 'Unknown Platform'}</span>
    <span class="modal-badge phase-badge">${phase ? phase.name : 'Unknown Phase'}</span>
    <span class="modal-badge type-badge ${item.type}-badge">${item.type}</span>
  `;

  renderFigmaSection(item);
  renderDocSection(item);
}

// --- Figma Section Render ---
function renderFigmaSection(item) {
  const hasFigma = item.figmaUrl && item.figmaUrl.trim().length > 0;

  if (!hasFigma) {
    // Empty state
    figmaActions.innerHTML = "";
    figmaContainer.innerHTML = `
      <div class="embed-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <p>No Figma design or flowchart url added yet.</p>
        <button class="btn btn-secondary btn-sm btn-add-figma-url">Add Figma Embed</button>
      </div>
    `;

    figmaContainer.querySelector(".btn-add-figma-url").addEventListener("click", () => {
      showEmbedInputForm(figmaContainer, "figma", item.figmaUrl);
    });
  } else {
    // Actions Header
    figmaActions.innerHTML = `
      <button class="btn btn-secondary btn-sm btn-edit-figma">Edit URL</button>
      <button class="btn btn-secondary btn-sm btn-delete-figma btn-danger">Remove</button>
    `;

    // Process figma url to make sure it's embeddable
    let embedUrl = item.figmaUrl;
    if (embedUrl.includes("figma.com") && !embedUrl.includes("figma.com/embed")) {
      embedUrl = `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(embedUrl)}`;
    }

    figmaContainer.innerHTML = `
      <div class="embed-loading-state" id="figmaSpinner">
        <div class="spinner"></div>
        <span>Loading Figma embed...</span>
      </div>
      <iframe src="${embedUrl}" allowfullscreen id="figmaIframe"></iframe>
    `;

    const spinner = document.getElementById("figmaSpinner");
    const iframe = document.getElementById("figmaIframe");
    
    iframe.addEventListener("load", () => {
      if (spinner) spinner.style.display = "none";
    });

    figmaActions.querySelector(".btn-edit-figma").addEventListener("click", () => {
      showEmbedInputForm(figmaContainer, "figma", item.figmaUrl);
    });

    figmaActions.querySelector(".btn-delete-figma").addEventListener("click", async () => {
      const confirmed = await confirmAction("Remove Figma Embed", "Are you sure you want to remove the Figma embed link?");
      if (confirmed) {
        await store.updateItem(item.id, { figmaUrl: "" });
      }
    });
  }
}

// --- Document Section Render ---
function renderDocSection(item) {
  const hasDoc = item.docUrl && item.docUrl.trim().length > 0;

  if (!hasDoc) {
    // Empty state
    docActions.innerHTML = "";
    docContainer.innerHTML = `
      <div class="embed-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <p>No document or requirements URL added yet.</p>
        <button class="btn btn-secondary btn-sm btn-add-doc-url">Add Document Embed</button>
      </div>
    `;

    docContainer.querySelector(".btn-add-doc-url").addEventListener("click", () => {
      showEmbedInputForm(docContainer, "doc", item.docUrl);
    });
  } else {
    // Actions Header
    docActions.innerHTML = `
      <button class="btn btn-secondary btn-sm btn-edit-doc">Edit URL</button>
      <button class="btn btn-secondary btn-sm btn-delete-doc btn-danger">Remove</button>
    `;

    // Process document url (especially Google Docs publish link or others)
    let embedUrl = item.docUrl;
    
    // Check if it's a google doc that can be previewed or needs /preview
    if (embedUrl.includes("docs.google.com") && !embedUrl.includes("/preview")) {
      if (embedUrl.includes("/edit")) {
        embedUrl = embedUrl.replace(/\/edit.*$/, "/preview");
      }
    }

    docContainer.innerHTML = `
      <div class="embed-loading-state" id="docSpinner">
        <div class="spinner"></div>
        <span>Loading document...</span>
      </div>
      <iframe src="${embedUrl}" id="docIframe"></iframe>
      <div class="embed-fallback-banner">
        <span>If the document does not display in the window:</span>
        <a href="${item.docUrl}" target="_blank" class="embed-fallback-link">Open in New Tab &rarr;</a>
      </div>
    `;

    const spinner = document.getElementById("docSpinner");
    const iframe = document.getElementById("docIframe");

    iframe.addEventListener("load", () => {
      if (spinner) spinner.style.display = "none";
    });

    docActions.querySelector(".btn-edit-doc").addEventListener("click", () => {
      showEmbedInputForm(docContainer, "doc", item.docUrl);
    });

    docActions.querySelector(".btn-delete-doc").addEventListener("click", async () => {
      const confirmed = await confirmAction("Remove Document Embed", "Are you sure you want to remove this document link?");
      if (confirmed) {
        await store.updateItem(item.id, { docUrl: "" });
      }
    });
  }
}

// --- Embed URL Edit Form Overlay ---
function showEmbedInputForm(container, type, currentUrl) {
  // Preserve empty or current state but add overlay form
  const formHtml = `
    <div class="embed-url-form">
      <h4>Enter ${type === "figma" ? "Figma" : "Document"} URL</h4>
      <input type="text" id="tempUrlInput" value="${currentUrl || ''}" placeholder="https://..." required>
      <div class="embed-url-form-actions">
        <button class="btn btn-secondary btn-sm btn-cancel-url-form">Cancel</button>
        <button class="btn btn-primary btn-sm btn-save-url-form">Save</button>
      </div>
    </div>
  `;

  // Append overlay form inside the container
  const div = document.createElement("div");
  div.innerHTML = formHtml;
  const formEl = div.firstElementChild;
  
  container.style.position = "relative";
  container.appendChild(formEl);

  const input = formEl.querySelector("#tempUrlInput");
  input.focus();
  input.select();

  formEl.querySelector(".btn-cancel-url-form").addEventListener("click", (e) => {
    e.stopPropagation();
    formEl.remove();
  });

  formEl.querySelector(".btn-save-url-form").addEventListener("click", async (e) => {
    e.stopPropagation();
    const newUrl = input.value.trim();
    if (newUrl) {
      if (type === "figma") {
        await store.updateItem(activeItemId, { figmaUrl: newUrl });
      } else {
        await store.updateItem(activeItemId, { docUrl: newUrl });
      }
    }
    formEl.remove();
  });

  // Handle Enter/ESC
  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const newUrl = input.value.trim();
      if (newUrl) {
        if (type === "figma") {
          await store.updateItem(activeItemId, { figmaUrl: newUrl });
        } else {
          await store.updateItem(activeItemId, { docUrl: newUrl });
        }
      }
      formEl.remove();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      formEl.remove();
    }
  });
}
export { openModal, closeModal };
