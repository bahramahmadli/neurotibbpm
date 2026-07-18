import { escapeHTML } from "./utils.js";

/**
 * Creates a DOM element for a roadmap card
 * @param {Object} item - Roadmap item data
 * @param {Object} handlers - Event handlers { onDetails, onEdit, onDelete }
 * @returns {HTMLElement}
 */
export function createCardElement(item, handlers) {
  const card = document.createElement("div");
  card.className = `roadmap-card type-${item.type}`;
  card.dataset.itemId = item.id;
  card.dataset.platformId = item.platformId;
  card.dataset.phaseId = item.phaseId;
  card.setAttribute("draggable", "true");

  // Determine if embeds are present
  const hasFigma = item.figmaUrl && item.figmaUrl.trim().length > 0;
  const hasDoc = item.docUrl && item.docUrl.trim().length > 0;

  card.innerHTML = `
    <div class="card-header-row">
      <h4 class="card-title">${escapeHTML(item.title)}</h4>
      <div class="card-drag-handle" title="Drag to move item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
          <circle cx="9" cy="5" r="1"/>
          <circle cx="9" cy="12" r="1"/>
          <circle cx="9" cy="19" r="1"/>
          <circle cx="15" cy="5" r="1"/>
          <circle cx="15" cy="12" r="1"/>
          <circle cx="15" cy="19" r="1"/>
        </svg>
      </div>
    </div>
    ${(hasFigma || hasDoc) ? `
      <div class="card-embed-indicators">
        ${hasFigma ? `<span class="embed-indicator-dot figma-dot" title="Figma design attached"></span>` : ''}
        ${hasDoc ? `<span class="embed-indicator-dot doc-dot" title="Document attached"></span>` : ''}
      </div>
    ` : ''}
    <div class="card-footer">
      <span class="card-type-badge badge-${item.type}">${item.type}</span>
      <div class="card-actions">
        <button class="card-action-link btn-details" type="button">Details</button>
        <button class="card-action-icon-btn btn-edit" type="button" title="Edit Item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="card-action-icon-btn btn-delete-card" type="button" title="Delete Item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // Attach event listeners
  card.querySelector(".btn-details").addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onDetails(item.id);
  });

  card.querySelector(".btn-edit").addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onEdit(item.id);
  });

  card.querySelector(".btn-delete-card").addEventListener("click", (e) => {
    e.stopPropagation();
    handlers.onDelete(item.id);
  });

  return card;
}
