import store from "./store.js";

const overlay = document.getElementById("drawerOverlay");
const titleEl = document.getElementById("drawerTitle");
const form = document.getElementById("itemForm");

// Form Inputs
const idInput = document.getElementById("formItemId");
const titleInput = document.getElementById("formItemTitle");
const platformSelect = document.getElementById("formItemPlatform");
const phaseSelect = document.getElementById("formItemPhase");

// Error fields
const errTitle = document.getElementById("errItemTitle");
const errPlatform = document.getElementById("errItemPlatform");
const errPhase = document.getElementById("errItemPhase");
const errType = document.getElementById("errItemType");

let isOpen = false;

export function initDrawer() {
  // Close drawer handlers
  document.getElementById("drawerClose").addEventListener("click", closeDrawer);
  document.getElementById("btnCancelDrawer").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeDrawer();
  });

  // Listen to ESC key to close drawer
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) {
      closeDrawer();
    }
  });

  // Handle Form Submission
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submitForm();
  });

  // Clear errors on input
  titleInput.addEventListener("input", () => clearValidationError(titleInput, errTitle));
  platformSelect.addEventListener("change", () => clearValidationError(platformSelect, errPlatform));
  phaseSelect.addEventListener("change", () => clearValidationError(phaseSelect, errPhase));

  const radios = form.querySelectorAll("input[name='formItemType']");
  radios.forEach(r => {
    r.addEventListener("change", () => {
      errType.parentElement.classList.remove("invalid");
    });
  });
}

function clearValidationError(input, errEl) {
  input.parentElement.classList.remove("invalid");
}

export function openDrawer(mode = "create", itemId = null, defaultPlatform = "", defaultPhase = "") {
  isOpen = true;
  resetForm();

  // Populate Platform and Phase options
  populateSelectOptions();

  if (mode === "edit" && itemId) {
    titleEl.textContent = "Edit Roadmap Item";
    const item = store.getItems().find(i => i.id === itemId);
    if (item) {
      idInput.value = item.id;
      titleInput.value = item.title;
      platformSelect.value = item.platformId;
      phaseSelect.value = item.phaseId;
      
      const radio = form.querySelector(`input[name="formItemType"][value="${item.type}"]`);
      if (radio) radio.checked = true;
    }
  } else {
    titleEl.textContent = "Add Roadmap Item";
    idInput.value = "";
    
    if (defaultPlatform) platformSelect.value = defaultPlatform;
    if (defaultPhase) phaseSelect.value = defaultPhase;
  }

  overlay.classList.add("active");
  titleInput.focus();
}

export function closeDrawer() {
  isOpen = false;
  overlay.classList.remove("active");
}

function resetForm() {
  form.reset();
  idInput.value = "";
  
  // Remove all invalid classes
  form.querySelectorAll(".form-field").forEach(field => {
    field.classList.remove("invalid");
  });
}

function populateSelectOptions() {
  const platforms = store.getPlatforms();
  const phases = store.getPhases();

  platformSelect.innerHTML = '<option value="">Select Platform</option>';
  platforms.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    platformSelect.appendChild(opt);
  });

  phaseSelect.innerHTML = '<option value="">Select Phase</option>';
  phases.forEach(ph => {
    const opt = document.createElement("option");
    opt.value = ph.id;
    opt.textContent = ph.name;
    phaseSelect.appendChild(opt);
  });
}

async function submitForm() {
  const itemId = idInput.value;
  const title = titleInput.value.trim();
  const platformId = platformSelect.value;
  const phaseId = phaseSelect.value;
  
  const typeRadio = form.querySelector("input[name='formItemType']:checked");
  const type = typeRadio ? typeRadio.value : "";

  // Validate form
  let isValid = true;

  if (!title) {
    titleInput.parentElement.classList.add("invalid");
    isValid = false;
  } else {
    titleInput.parentElement.classList.remove("invalid");
  }

  if (!platformId) {
    platformSelect.parentElement.classList.add("invalid");
    isValid = false;
  } else {
    platformSelect.parentElement.classList.remove("invalid");
  }

  if (!phaseId) {
    phaseSelect.parentElement.classList.add("invalid");
    isValid = false;
  } else {
    phaseSelect.parentElement.classList.remove("invalid");
  }

  if (!type) {
    errType.parentElement.classList.add("invalid");
    isValid = false;
  } else {
    errType.parentElement.classList.remove("invalid");
  }

  if (!isValid) return;

  const itemData = { title, platformId, phaseId, type };

  if (itemId) {
    // Edit Mode
    await store.updateItem(itemId, itemData);
  } else {
    // Create Mode
    await store.addItem(itemData);
  }

  closeDrawer();
}
export { openDrawer, closeDrawer };
