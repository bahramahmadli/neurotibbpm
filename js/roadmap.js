import store from "./store.js";
import { createCardElement } from "./card.js";
import { openDrawer } from "./drawer.js";
import { openModal } from "./modal.js";
import { getFilters } from "./filters.js";
import { confirmAction } from "./confirm.js";
import { isValidThreeMonthPeriod, escapeHTML } from "./utils.js";

const canvas = document.getElementById("roadmapCanvas");

// Track editing state to prevent cursor jumps
let activeEditingId = null;

export function renderRoadmap() {
  if (!canvas) return;

  const platforms = store.getPlatforms();
  const phases = store.getPhases();
  const filters = getFilters();

  // If no platforms or phases, render empty state
  if (platforms.length === 0 && phases.length === 0) {
    canvas.innerHTML = `
      <div class="roadmap-empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <h3>No roadmap structure defined</h3>
        <p>Please add a platform and phase to start mapping your features.</p>
        <div style="margin-top: 16px; display: flex; gap: 12px;">
          <button class="btn btn-primary" id="btnInitDefaultGrid">Reset Default Structure</button>
        </div>
      </div>
    `;
    
    document.getElementById("btnInitDefaultGrid")?.addEventListener("click", () => {
      store.seedInitialData();
    });
    return;
  }

  // Set Grid template columns: First is Platform column, then phase columns, then "+" add column button
  const columnsCount = phases.length;
  canvas.style.gridTemplateColumns = `220px repeat(${columnsCount}, 280px) 60px`;

  let html = "";

  // 1. --- Render Headers ---
  // Top-left label cell
  html += `<div class="grid-header-cell platform-label-header">Platformalar</div>`;

  // Render Phase columns headers
  phases.forEach((phase) => {
    // Generate class for phase color theme
    const phaseAccentClass = `phase-${phase.id}`;
    
    html += `
      <div class="grid-header-cell" style="border-top: 4px solid var(--phase-${getPhaseColorTheme(phase.id)}-color); background-color: var(--phase-${getPhaseColorTheme(phase.id)}-light);">
        <div class="phase-header-top">
          <span class="phase-name-text" data-phase-id="${phase.id}" contenteditable="true" spellcheck="false">${escapeHTML(phase.name)}</span>
          <div class="phase-actions">
            <button class="phase-btn btn-delete-phase" data-phase-id="${phase.id}" title="Delete Phase">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="phase-period" data-phase-id="${phase.id}" contenteditable="true" spellcheck="false" title="Click to edit 3-month period">${escapeHTML(phase.period)}</div>
        <div class="phase-objective" data-phase-id="${phase.id}" contenteditable="true" spellcheck="false" placeholder="Phase objective...">${escapeHTML(phase.objective || 'Double click to add objective...')}</div>
      </div>
    `;
  });

  // "Add Phase" Header Cell
  html += `
    <div class="grid-add-column-btn" id="btnAddPhaseCol" title="Add Phase Column">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 20px; height: 20px;">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </div>
  `;

  // 2. --- Render Rows (Platforms) ---
  let cardsFilteredCount = 0;
  let totalCardsCount = store.getItems().length;

  platforms.forEach((platform) => {
    // Platform label column cell
    html += `
      <div class="grid-platform-label-cell">
        <span class="platform-name-text" data-platform-id="${platform.id}" contenteditable="true" spellcheck="false">${escapeHTML(platform.name)}</span>
        <div class="platform-actions">
          <button class="phase-btn btn-delete-platform" data-platform-id="${platform.id}" title="Delete Platform">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Intersections (roadmap cells)
    phases.forEach((phase) => {
      // Get items for this cell
      const items = store.getItemsForCell(platform.id, phase.id);

      // Apply Filters
      const filteredItems = items.filter(item => {
        // Title Filter
        if (filters.title && !item.title.toLowerCase().includes(filters.title)) return false;
        
        // Platform Filter
        if (filters.platformId && item.platformId !== filters.platformId) return false;
        
        // Phase Filter
        if (filters.phaseId && item.phaseId !== filters.phaseId) return false;
        
        // Type Filter
        if (filters.types.length > 0 && !filters.types.includes(item.type)) return false;

        return true;
      });

      cardsFilteredCount += filteredItems.length;

      // Render cell
      html += `
        <div class="grid-cell" data-platform-id="${platform.id}" data-phase-id="${phase.id}">
          <div class="card-list" id="list-${platform.id}-${phase.id}">
            <!-- Cards rendered dynamically here -->
          </div>
          <button class="cell-add-btn" data-platform-id="${platform.id}" data-phase-id="${phase.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 12px; height: 12px; margin-right: 4px;">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Item
          </button>
        </div>
      `;
    });

    // Empty space next to "Add Phase" column
    html += `<div style="background-color: var(--bg-app); border-bottom: 1px solid var(--border-color);"></div>`;
  });

  // Bottom row: "Add Platform" Row
  html += `
    <div class="grid-add-row-cell" id="btnAddPlatformRow">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 16px; height: 16px; margin-right: 6px;">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
      Add Platform
    </div>
  `;

  // Empty cells for the rest of the bottom row
  for (let i = 0; i <= phases.length; i++) {
    html += `<div style="background-color: var(--bg-app);"></div>`;
  }

  canvas.innerHTML = html;

  // 3. --- Populate Card elements in each Cell ---
  platforms.forEach((platform) => {
    phases.forEach((phase) => {
      const cellList = document.getElementById(`list-${platform.id}-${phase.id}`);
      if (!cellList) return;

      const items = store.getItemsForCell(platform.id, phase.id);
      
      // Apply filters
      const filteredItems = items.filter(item => {
        if (filters.title && !item.title.toLowerCase().includes(filters.title)) return false;
        if (filters.platformId && item.platformId !== filters.platformId) return false;
        if (filters.phaseId && item.phaseId !== filters.phaseId) return false;
        if (filters.types.length > 0 && !filters.types.includes(item.type)) return false;
        return true;
      });

      filteredItems.forEach(item => {
        const cardEl = createCardElement(item, {
          onDetails: (id) => openModal(id),
          onEdit: (id) => openDrawer("edit", id),
          onDelete: async (id) => {
            const confirmed = await confirmAction("Delete Roadmap Item", "Are you sure you want to delete this roadmap item?");
            if (confirmed) {
              await store.deleteItem(id);
            }
          }
        });
        cellList.appendChild(cardEl);
      });
    });
  });

  // If search/filter returns nothing but items exist, show empty state inside grid
  if (cardsFilteredCount === 0 && totalCardsCount > 0) {
    const filterEmptyOverlay = document.createElement("div");
    filterEmptyOverlay.className = "roadmap-empty-state";
    filterEmptyOverlay.style.gridColumn = `2 / span ${columnsCount}`;
    filterEmptyOverlay.style.gridRow = `2 / span ${platforms.length + 1}`;
    filterEmptyOverlay.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <h3>No matching cards found</h3>
      <p>Try refining your search or filters to see more cards.</p>
    `;
    
    // Inject at the first row cell position
    canvas.appendChild(filterEmptyOverlay);
  }

  // 4. --- Attach Interactions & Handlers ---
  attachInlineEditingHandlers();
  attachHeaderButtonsHandlers();
}

/**
 * Maps a phase ID to a static color palette list for aesthetic consistency
 * @param {string} phaseId 
 * @returns {string}
 */
function getPhaseColorTheme(phaseId) {
  if (phaseId === "phase-mvp") return "mvp";
  if (phaseId === "phase-p2") return "2";
  if (phaseId === "phase-p3") return "3";
  if (phaseId === "phase-p4") return "4";
  
  // Rotating palette for custom phases
  const index = store.getPhases().findIndex(p => p.id === phaseId);
  const extraPalettes = ["custom-1", "custom-2", "custom-3"];
  return extraPalettes[index % extraPalettes.length];
}

function attachInlineEditingHandlers() {
  // A. Phase Name Edit
  canvas.querySelectorAll(".phase-name-text").forEach(el => {
    el.addEventListener("blur", async () => {
      const phaseId = el.dataset.phaseId;
      const text = el.textContent.trim();
      if (!text) {
        renderRoadmap(); // restore previous
        return;
      }
      await store.updatePhase(phaseId, { name: text });
    });
    
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.blur();
      }
    });
  });

  // B. Phase Period Edit with validation
  canvas.querySelectorAll(".phase-period").forEach(el => {
    el.addEventListener("blur", async () => {
      const phaseId = el.dataset.phaseId;
      const text = el.textContent.trim();
      
      if (!isValidThreeMonthPeriod(text)) {
        alert("Phase period must represent exactly a 3-month duration. E.g. 'Jul 2025 – Sep 2025' or 'Oct 2025 – Dec 2025'.");
        renderRoadmap(); // restore previous value
        return;
      }

      await store.updatePhase(phaseId, { period: text });
    });

    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.blur();
      }
    });
  });

  // C. Phase Objective Edit
  canvas.querySelectorAll(".phase-objective").forEach(el => {
    el.addEventListener("focus", () => {
      if (el.textContent === "Double click to add objective...") {
        el.textContent = "";
      }
    });
    el.addEventListener("blur", async () => {
      const phaseId = el.dataset.phaseId;
      const text = el.textContent.trim();
      await store.updatePhase(phaseId, { objective: text });
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.blur();
      }
    });
  });

  // D. Platform Name Edit
  canvas.querySelectorAll(".platform-name-text").forEach(el => {
    el.addEventListener("blur", async () => {
      const platformId = el.dataset.platformId;
      const text = el.textContent.trim();
      if (!text) {
        renderRoadmap();
        return;
      }
      await store.updatePlatform(platformId, text);
    });

    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        el.blur();
      }
    });
  });
}

function attachHeaderButtonsHandlers() {
  // A. Cell '+' Add buttons
  canvas.querySelectorAll(".cell-add-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const platId = btn.dataset.platformId;
      const phaseId = btn.dataset.phaseId;
      openDrawer("create", null, platId, phaseId);
    });
  });

  // B. Delete Platform Row
  canvas.querySelectorAll(".btn-delete-platform").forEach(btn => {
    btn.addEventListener("click", async () => {
      const platformId = btn.dataset.platformId;
      const platform = store.getPlatforms().find(p => p.id === platformId);
      const itemsInPlatform = store.getItems().filter(item => item.platformId === platformId);

      let msg = `Are you sure you want to delete the platform row "${platform ? platform.name : ''}"?`;
      if (itemsInPlatform.length > 0) {
        msg = `WARNING: The platform row "${platform ? platform.name : ''}" contains ${itemsInPlatform.length} roadmap items. Deleting the platform will also permanently delete all of these items. Are you sure you want to proceed?`;
      }

      const confirmed = await confirmAction("Delete Platform Row", msg, "Delete Platform", true);
      if (confirmed) {
        await store.deletePlatform(platformId);
      }
    });
  });

  // C. Delete Phase Column
  canvas.querySelectorAll(".btn-delete-phase").forEach(btn => {
    btn.addEventListener("click", async () => {
      const phaseId = btn.dataset.phaseId;
      const phase = store.getPhases().find(ph => ph.id === phaseId);
      const itemsInPhase = store.getItems().filter(item => item.phaseId === phaseId);

      let msg = `Are you sure you want to delete the phase column "${phase ? phase.name : ''}"?`;
      if (itemsInPhase.length > 0) {
        msg = `WARNING: The phase column "${phase ? phase.name : ''}" contains ${itemsInPhase.length} roadmap items. Deleting the phase will also permanently delete all of these items. Are you sure you want to proceed?`;
      }

      const confirmed = await confirmAction("Delete Phase Column", msg, "Delete Phase", true);
      if (confirmed) {
        await store.deletePhase(phaseId);
      }
    });
  });

  // D. Add Phase Column button
  const addPhaseColBtn = document.getElementById("btnAddPhaseCol");
  if (addPhaseColBtn) {
    addPhaseColBtn.addEventListener("click", async () => {
      const name = prompt("Enter new phase name:", `Phase ${store.getPhases().length + 1}`);
      if (!name) return;
      
      const period = prompt("Enter 3-month period (e.g. 'Jul 2025 – Sep 2025'):", "Jul 2025 – Sep 2025");
      if (!period) return;

      if (!isValidThreeMonthPeriod(period)) {
        alert("Invalid period. Phase period must represent exactly a 3-month duration. Phase not created.");
        return;
      }

      const objective = prompt("Enter optional phase objective:", "");
      await store.addPhase(name, period, objective || "");
    });
  }

  // E. Add Platform Row button
  const addPlatRowBtn = document.getElementById("btnAddPlatformRow");
  if (addPlatRowBtn) {
    addPlatRowBtn.addEventListener("click", async () => {
      const name = prompt("Enter new platform name:");
      if (name && name.trim()) {
        await store.addPlatform(name.trim());
      }
    });
  }
}
export { renderRoadmap };
