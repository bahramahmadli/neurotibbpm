import store from "./store.js";
import { debounce } from "./utils.js";

const searchTitleEl = document.getElementById("searchTitle");
const filterPlatformEl = document.getElementById("filterPlatform");
const filterPhaseEl = document.getElementById("filterPhase");
const clearFiltersEl = document.getElementById("btnClearFilters");

// Type checkboxes
const typePageEl = document.getElementById("typeFilterPage");
const typeAiEl = document.getElementById("typeFilterAi");
const typeFeatureEl = document.getElementById("typeFilterFeature");

let filterCallback = null;

export function initFilters(onFilterChange) {
  filterCallback = onFilterChange;

  // Listen to store changes to populate Platform and Phase dropdowns
  store.on("change", (data) => {
    updateDropdowns(data.platforms, data.phases);
  });

  // Bind change listeners to inputs
  const triggerChange = () => {
    checkClearButtonVisibility();
    if (filterCallback) filterCallback();
  };

  searchTitleEl.addEventListener("input", debounce(triggerChange, 200));
  filterPlatformEl.addEventListener("change", triggerChange);
  filterPhaseEl.addEventListener("change", triggerChange);

  [typePageEl, typeAiEl, typeFeatureEl].forEach(cb => {
    cb.addEventListener("change", triggerChange);
  });

  clearFiltersEl.addEventListener("click", () => {
    clearFilters();
  });
}

function updateDropdowns(platforms, phases) {
  const currentPlatVal = filterPlatformEl.value;
  const currentPhaseVal = filterPhaseEl.value;

  // Re-build Platform Dropdown
  filterPlatformEl.innerHTML = '<option value="">All Platforms</option>';
  platforms.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    if (p.id === currentPlatVal) opt.selected = true;
    filterPlatformEl.appendChild(opt);
  });

  // Re-build Phase Dropdown
  filterPhaseEl.innerHTML = '<option value="">All Phases</option>';
  phases.forEach(ph => {
    const opt = document.createElement("option");
    opt.value = ph.id;
    opt.textContent = ph.name;
    if (ph.id === currentPhaseVal) opt.selected = true;
    filterPhaseEl.appendChild(opt);
  });
}

function checkClearButtonVisibility() {
  const isSearchActive = searchTitleEl.value.trim().length > 0;
  const isPlatActive = filterPlatformEl.value !== "";
  const isPhaseActive = filterPhaseEl.value !== "";
  const isTypeFiltered = !typePageEl.checked || !typeAiEl.checked || !typeFeatureEl.checked;

  if (isSearchActive || isPlatActive || isPhaseActive || isTypeFiltered) {
    clearFiltersEl.style.display = "inline-block";
  } else {
    clearFiltersEl.style.display = "none";
  }
}

export function clearFilters() {
  searchTitleEl.value = "";
  filterPlatformEl.value = "";
  filterPhaseEl.value = "";
  typePageEl.checked = true;
  typeAiEl.checked = true;
  typeFeatureEl.checked = true;

  clearFiltersEl.style.display = "none";
  if (filterCallback) filterCallback();
}

/**
 * Get the active filters
 * @returns {{ title: string, platformId: string, phaseId: string, types: string[] }}
 */
export function getFilters() {
  const types = [];
  if (typePageEl.checked) types.push("page");
  if (typeAiEl.checked) types.push("ai");
  if (typeFeatureEl.checked) types.push("feature");

  return {
    title: searchTitleEl.value.trim().toLowerCase(),
    platformId: filterPlatformEl.value,
    phaseId: filterPhaseEl.value,
    types
  };
}
