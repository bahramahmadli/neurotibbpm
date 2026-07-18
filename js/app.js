(function() {
  'use strict';

  // ==========================================
  // 1. UTILITY HELPERS
  // ==========================================
  function generateId() {
    return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
  }

  function formatDate(dateVal) {
    if (!dateVal) return '';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function isValidThreeMonthPeriod(periodStr) {
    if (!periodStr) return false;
    const parts = periodStr.split(/[–-]/).map(p => p.trim());
    if (parts.length !== 2) return false;
    
    const start = new Date(parts[0]);
    const end = new Date(parts[1]);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
    
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    const totalMonths = yearDiff * 12 + monthDiff + 1;
    
    return totalMonths === 3;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // ==========================================
  // 2. DATASTORE (FIREBASE & FIRESTORE LOGIC)
  // ==========================================
  const firebaseConfig = {
    apiKey: "AIzaSyB9yLE6hZoHS6Gjbz4W5dP4z4n1QkOdObc",
    authDomain: "neurotibbpm.firebaseapp.com",
    projectId: "neurotibbpm",
    storageBucket: "neurotibbpm.firebasestorage.app",
    messagingSenderId: "784139749752",
    appId: "1:784139749752:web:eb6c51fd6ff6cc33f6a08d",
    measurementId: "G-8MH3YXSSGT"
  };

  class DataStore {
    constructor() {
      this._data = {
        metadata: {
          title: "AANA Product Roadmap",
          description: "Interactive phase-based roadmap for coordinating products, timelines, and feature releases.",
          owner: "AANA Product Team",
          version: "v1.2.0",
          lastUpdated: "Today",
          status: "Active"
        },
        platforms: [],
        phases: [],
        items: []
      };
      this._listeners = {};
      
      // Initialize Firebase (Compat mode) - protected check
      this.app = null;
      this.db = null;
      try {
        if (typeof firebase !== 'undefined') {
          if (!firebase.apps.length) {
            this.app = firebase.initializeApp(firebaseConfig);
          } else {
            this.app = firebase.app();
          }
          this.db = firebase.firestore(this.app);
          console.log("Firebase Compat SDK initialized successfully.");
        } else {
          console.warn("Firebase global SDK not found. Running in offline fallback mode.");
        }
      } catch (err) {
        console.error("Firebase initialization failed: ", err);
      }
    }

    on(event, callback) {
      if (!this._listeners[event]) {
        this._listeners[event] = [];
      }
      this._listeners[event].push(callback);
    }

    emit(event, data) {
      if (this._listeners[event]) {
        this._listeners[event].forEach(callback => callback(data));
      }
    }

    async init() {
      try {
        if (!this.db) {
          throw new Error("Firestore not initialized");
        }
        console.log("Fetching from Firestore...");
        
        // Fetch Platforms
        const platformSnap = await this.db.collection("platforms").orderBy("sortOrder").get();
        const platforms = platformSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch Phases
        const phaseSnap = await this.db.collection("phases").orderBy("sortOrder").get();
        const phases = phaseSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch Items
        const itemSnap = await this.db.collection("items").orderBy("sortOrder").get();
        const items = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch Metadata
        const metaDoc = await this.db.collection("settings").doc("project").get();
        let metadata = this._data.metadata;
        if (metaDoc.exists) {
          metadata = metaDoc.data();
        }

        this._data = { metadata, platforms, phases, items };
        this.saveToLocalStorage();

        if (platforms.length === 0 && phases.length === 0) {
          console.log("Firestore empty. Seeding initial structures...");
          await this.seedInitialData();
        }

        this.emit("change", this._data);
      } catch (err) {
        console.error("Error loading from Firestore: ", err);
        console.log("Fallback to localStorage...");
        this.loadFromLocalStorage();
        
        // Seed local storage with default if completely empty
        if (this._data.platforms.length === 0 && this._data.phases.length === 0) {
          this.seedInitialLocalData();
        }
        
        this.emit("change", this._data);
      }
    }

    seedInitialLocalData() {
      this._data.platforms = [
        { id: "platform-website", name: "Website", sortOrder: 1 },
        { id: "platform-valideyn", name: "Valideyn paneli", sortOrder: 2 },
        { id: "platform-hekim", name: "Həkim paneli", sortOrder: 3 }
      ];

      this._data.phases = [
        { id: "phase-mvp", name: "MVP", period: "Jul 2025 – Sep 2025", objective: "Minimum Viable Product release", sortOrder: 1 },
        { id: "phase-p2", name: "Phase 2", period: "Oct 2025 – Dec 2025", objective: "Core enhancements and scaling", sortOrder: 2 },
        { id: "phase-p3", name: "Phase 3", period: "Jan 2026 – Mar 2026", objective: "Advanced AI integration", sortOrder: 3 },
        { id: "phase-p4", name: "Phase 4", period: "Apr 2026 – Jun 2026", objective: "Full ecosystem features", sortOrder: 4 }
      ];
      this._data.items = [];
      this.saveToLocalStorage();
    }

    async seedInitialData() {
      this.seedInitialLocalData();
      if (!this.db) return;

      try {
        const batch = this.db.batch();
        this._data.platforms.forEach(p => {
          batch.set(this.db.collection("platforms").doc(p.id), { name: p.name, sortOrder: p.sortOrder });
        });
        this._data.phases.forEach(ph => {
          batch.set(this.db.collection("phases").doc(ph.id), { name: ph.name, period: ph.period, objective: ph.objective, sortOrder: ph.sortOrder });
        });
        batch.set(this.db.collection("settings").doc("project"), this._data.metadata);
        await batch.commit();
      } catch (err) {
        console.error("Error seeding Firestore:", err);
      }
    }

    loadFromLocalStorage() {
      const local = localStorage.getItem("aana_roadmap_local_cache");
      if (local) {
        try {
          this._data = JSON.parse(local);
        } catch (e) {
          console.error("localStorage parse error:", e);
        }
      }
    }

    saveToLocalStorage() {
      localStorage.setItem("aana_roadmap_local_cache", JSON.stringify(this._data));
    }

    getMetadata() {
      return this._data.metadata;
    }

    async updateMetadata(fields) {
      this._data.metadata = { ...this._data.metadata, ...fields };
      this.saveToLocalStorage();
      this.emit("change", this._data);

      if (!this.db) return;
      try {
        await this.db.collection("settings").doc("project").set(this._data.metadata);
      } catch (err) {
        console.error("Firestore updateMetadata sync error:", err);
      }
    }

    getPlatforms() {
      return this._data.platforms;
    }

    async addPlatform(name) {
      const id = generateId();
      const sortOrder = this._data.platforms.length > 0 
        ? Math.max(...this._data.platforms.map(p => p.sortOrder || 0)) + 1 
        : 1;
      
      const newPlatform = { id, name, sortOrder };
      this._data.platforms.push(newPlatform);
      this.saveToLocalStorage();
      this.emit("change", this._data);

      if (!this.db) return newPlatform;
      try {
        await this.db.collection("platforms").doc(id).set({ name, sortOrder });
      } catch (err) {
        console.error("Firestore addPlatform sync error:", err);
      }
      return newPlatform;
    }

    async updatePlatform(id, name) {
      const platform = this._data.platforms.find(p => p.id === id);
      if (platform) {
        platform.name = name;
        this.saveToLocalStorage();
        this.emit("change", this._data);

        if (!this.db) return;
        try {
          await this.db.collection("platforms").doc(id).update({ name });
        } catch (err) {
          console.error("Firestore updatePlatform sync error:", err);
        }
      }
    }

    async deletePlatform(id) {
      const itemsToDelete = this._data.items.filter(item => item.platformId === id);
      this._data.items = this._data.items.filter(item => item.platformId !== id);
      this._data.platforms = this._data.platforms.filter(p => p.id !== id);
      
      this.saveToLocalStorage();
      this.emit("change", this._data);

      if (!this.db) return;
      try {
        const batch = this.db.batch();
        batch.delete(this.db.collection("platforms").doc(id));
        itemsToDelete.forEach(item => {
          batch.delete(this.db.collection("items").doc(item.id));
        });
        await batch.commit();
      } catch (err) {
        console.error("Firestore deletePlatform sync error:", err);
      }
    }

    getPhases() {
      return this._data.phases;
    }

    async addPhase(name, period, objective = "") {
      const id = generateId();
      const sortOrder = this._data.phases.length > 0
        ? Math.max(...this._data.phases.map(p => p.sortOrder || 0)) + 1
        : 1;

      const newPhase = { id, name, period, objective, sortOrder };
      this._data.phases.push(newPhase);
      this.saveToLocalStorage();
      this.emit("change", this._data);

      if (!this.db) return newPhase;
      try {
        await this.db.collection("phases").doc(id).set({ name, period, objective, sortOrder });
      } catch (err) {
        console.error("Firestore addPhase sync error:", err);
      }
      return newPhase;
    }

    async updatePhase(id, fields) {
      const phase = this._data.phases.find(p => p.id === id);
      if (phase) {
        Object.assign(phase, fields);
        this.saveToLocalStorage();
        this.emit("change", this._data);

        if (!this.db) return;
        try {
          await this.db.collection("phases").doc(id).update(fields);
        } catch (err) {
          console.error("Firestore updatePhase sync error:", err);
        }
      }
    }

    async deletePhase(id) {
      const itemsToDelete = this._data.items.filter(item => item.phaseId === id);
      this._data.items = this._data.items.filter(item => item.phaseId !== id);
      this._data.phases = this._data.phases.filter(ph => ph.id !== id);

      this.saveToLocalStorage();
      this.emit("change", this._data);

      if (!this.db) return;
      try {
        const batch = this.db.batch();
        batch.delete(this.db.collection("phases").doc(id));
        itemsToDelete.forEach(item => {
          batch.delete(this.db.collection("items").doc(item.id));
        });
        await batch.commit();
      } catch (err) {
        console.error("Firestore deletePhase sync error:", err);
      }
    }

    getItems() {
      return this._data.items;
    }

    getItemsForCell(platformId, phaseId) {
      return this._data.items
        .filter(item => item.platformId === platformId && item.phaseId === phaseId)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }

    async addItem(itemData) {
      const id = generateId();
      const now = new Date().toISOString();
      
      const cellItems = this.getItemsForCell(itemData.platformId, itemData.phaseId);
      const sortOrder = cellItems.length > 0
        ? Math.max(...cellItems.map(i => i.sortOrder || 0)) + 1
        : 1;

      const newItem = {
        id,
        title: itemData.title,
        platformId: itemData.platformId,
        phaseId: itemData.phaseId,
        type: itemData.type,
        figmaUrl: itemData.figmaUrl || "",
        docUrl: itemData.docUrl || "",
        sortOrder,
        createdDate: now,
        updatedDate: now
      };

      this._data.items.push(newItem);
      this.saveToLocalStorage();
      this.emit("change", this._data);

      if (!this.db) return newItem;
      try {
        await this.db.collection("items").doc(id).set({
          title: newItem.title,
          platformId: newItem.platformId,
          phaseId: newItem.phaseId,
          type: newItem.type,
          figmaUrl: newItem.figmaUrl,
          docUrl: newItem.docUrl,
          sortOrder: newItem.sortOrder,
          createdDate: newItem.createdDate,
          updatedDate: newItem.updatedDate
        });
      } catch (err) {
        console.error("Firestore addItem sync error:", err);
      }
      return newItem;
    }

    async updateItem(id, fields) {
      const item = this._data.items.find(i => i.id === id);
      if (item) {
        const now = new Date().toISOString();
        const updatedFields = { ...fields, updatedDate: now };

        if (fields.platformId !== undefined || fields.phaseId !== undefined) {
          const targetPlat = fields.platformId !== undefined ? fields.platformId : item.platformId;
          const targetPhase = fields.phaseId !== undefined ? fields.phaseId : item.phaseId;
          
          if (targetPlat !== item.platformId || targetPhase !== item.phaseId) {
            const cellItems = this.getItemsForCell(targetPlat, targetPhase);
            updatedFields.sortOrder = cellItems.length > 0
              ? Math.max(...cellItems.map(i => i.sortOrder || 0)) + 1
              : 1;
          }
        }

        Object.assign(item, updatedFields);
        this.saveToLocalStorage();
        this.emit("change", this._data);

        if (!this.db) return;
        try {
          await this.db.collection("items").doc(id).update(updatedFields);
        } catch (err) {
          console.error("Firestore updateItem sync error:", err);
        }
      }
    }

    async updateItemPositions(itemsToUpdate) {
      const now = new Date().toISOString();

      itemsToUpdate.forEach(updateInfo => {
        const item = this._data.items.find(i => i.id === updateInfo.id);
        if (item) {
          item.platformId = updateInfo.platformId;
          item.phaseId = updateInfo.phaseId;
          item.sortOrder = updateInfo.sortOrder;
          item.updatedDate = now;
        }
      });

      this.saveToLocalStorage();
      this.emit("change", this._data);

      if (!this.db) return;
      try {
        const batch = this.db.batch();
        itemsToUpdate.forEach(updateInfo => {
          const docRef = this.db.collection("items").doc(updateInfo.id);
          batch.update(docRef, {
            platformId: updateInfo.platformId,
            phaseId: updateInfo.phaseId,
            sortOrder: updateInfo.sortOrder,
            updatedDate: now
          });
        });
        await batch.commit();
      } catch (err) {
        console.error("Firestore updateItemPositions sync error:", err);
      }
    }

    async deleteItem(id) {
      this._data.items = this._data.items.filter(i => i.id !== id);
      this.saveToLocalStorage();
      this.emit("change", this._data);

      if (!this.db) return;
      try {
        await this.db.collection("items").doc(id).delete();
      } catch (err) {
        console.error("Firestore deleteItem sync error:", err);
      }
    }
  }

  const store = new DataStore();

  // ==========================================
  // 3. REUSABLE CONFIRMATION MODAL
  // ==========================================
  const confirmOverlay = document.getElementById('confirmOverlay');
  const confirmTitle = document.getElementById('confirmTitle');
  const confirmMsg = document.getElementById('confirmMessage');
  const btnCancelConfirm = document.getElementById('btnCancelConfirm');
  const btnProceedConfirm = document.getElementById('btnProceedConfirm');
  let confirmResolve = null;

  function cleanupConfirm() {
    confirmOverlay.classList.remove('active');
    btnCancelConfirm.removeEventListener('click', onCancelConfirm);
    btnProceedConfirm.removeEventListener('click', onProceedConfirm);
    confirmOverlay.removeEventListener('click', onConfirmOverlayClick);
    document.removeEventListener('keydown', onConfirmKeyDown);
  }

  function onCancelConfirm() {
    cleanupConfirm();
    if (confirmResolve) confirmResolve(false);
  }

  function onProceedConfirm() {
    cleanupConfirm();
    if (confirmResolve) confirmResolve(true);
  }

  function onConfirmOverlayClick(e) {
    if (e.target === confirmOverlay) onCancelConfirm();
  }

  function onConfirmKeyDown(e) {
    if (e.key === 'Escape') onCancelConfirm();
  }

  function confirmAction(title, message, buttonText = 'Delete', isDanger = true) {
    confirmTitle.textContent = title;
    confirmMsg.textContent = message;
    btnProceedConfirm.textContent = buttonText;
    
    if (isDanger) {
      btnProceedConfirm.className = 'btn btn-danger';
    } else {
      btnProceedConfirm.className = 'btn btn-primary';
    }

    confirmOverlay.classList.add('active');
    btnCancelConfirm.addEventListener('click', onCancelConfirm);
    btnProceedConfirm.addEventListener('click', onProceedConfirm);
    confirmOverlay.addEventListener('click', onConfirmOverlayClick);
    document.addEventListener('keydown', onConfirmKeyDown);

    return new Promise((resolve) => {
      confirmResolve = resolve;
    });
  }

  // ==========================================
  // 4. SIDEBAR MANAGEMENT
  // ==========================================
  const sidebar = document.getElementById('appSidebar');
  const sidebarToggleBtn = document.getElementById('sidebarToggle');

  function initSidebar() {
    if (!sidebar || !sidebarToggleBtn) return;
    const isCollapsed = localStorage.getItem('aana_sidebar_collapsed') === 'true';
    if (isCollapsed) sidebar.classList.add('collapsed');

    sidebarToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('aana_sidebar_collapsed', sidebar.classList.contains('collapsed'));
      window.dispatchEvent(new Event('resize'));
    });
  }

  // ==========================================
  // 5. TOP HEADER METADATA
  // ==========================================
  const titleEl = document.getElementById("projectTitle");
  const descEl = document.getElementById("projectDesc");
  const ownerEl = document.getElementById("metaOwner");
  const versionEl = document.getElementById("metaVersion");
  const lastUpdatedEl = document.getElementById("metaLastUpdated");
  const statusEl = document.getElementById("metaStatus");

  function initHeader() {
    store.on("change", (data) => {
      const meta = data.metadata || {};
      if (document.activeElement !== titleEl) titleEl.textContent = meta.title || "AANA Product Roadmap";
      if (document.activeElement !== descEl) descEl.textContent = meta.description || "";
      if (document.activeElement !== ownerEl) ownerEl.textContent = meta.owner || "";
      if (document.activeElement !== versionEl) versionEl.textContent = meta.version || "";
      if (document.activeElement !== lastUpdatedEl) lastUpdatedEl.textContent = meta.lastUpdated || "";
      if (document.activeElement !== statusEl) statusEl.textContent = meta.status || "";
    });

    const setupEditable = (el, fieldName) => {
      if (!el) return;
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

  // ==========================================
  // 6. FILTERS MANAGEMENT
  // ==========================================
  const searchTitleEl = document.getElementById("searchTitle");
  const filterPlatformEl = document.getElementById("filterPlatform");
  const filterPhaseEl = document.getElementById("filterPhase");
  const clearFiltersEl = document.getElementById("btnClearFilters");
  const typePageEl = document.getElementById("typeFilterPage");
  const typeAiEl = document.getElementById("typeFilterAi");
  const typeFeatureEl = document.getElementById("typeFilterFeature");

  let onFilterChangeCallback = null;

  function initFilters(onFilterChange) {
    onFilterChangeCallback = onFilterChange;

    store.on("change", (data) => {
      updateDropdowns(data.platforms, data.phases);
    });

    const triggerChange = () => {
      checkClearButtonVisibility();
      if (onFilterChangeCallback) onFilterChangeCallback();
    };

    searchTitleEl.addEventListener("input", debounce(triggerChange, 200));
    filterPlatformEl.addEventListener("change", triggerChange);
    filterPhaseEl.addEventListener("change", triggerChange);

    [typePageEl, typeAiEl, typeFeatureEl].forEach(cb => {
      cb.addEventListener("change", triggerChange);
    });

    clearFiltersEl.addEventListener("click", () => {
      searchTitleEl.value = "";
      filterPlatformEl.value = "";
      filterPhaseEl.value = "";
      typePageEl.checked = true;
      typeAiEl.checked = true;
      typeFeatureEl.checked = true;
      clearFiltersEl.style.display = "none";
      if (onFilterChangeCallback) onFilterChangeCallback();
    });
  }

  function updateDropdowns(platforms, phases) {
    const currentPlat = filterPlatformEl.value;
    const currentPhase = filterPhaseEl.value;

    filterPlatformEl.innerHTML = '<option value="">All Platforms</option>';
    platforms.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === currentPlat) opt.selected = true;
      filterPlatformEl.appendChild(opt);
    });

    filterPhaseEl.innerHTML = '<option value="">All Phases</option>';
    phases.forEach(ph => {
      const opt = document.createElement("option");
      opt.value = ph.id;
      opt.textContent = ph.name;
      if (ph.id === currentPhase) opt.selected = true;
      filterPhaseEl.appendChild(opt);
    });
  }

  function checkClearButtonVisibility() {
    const active = searchTitleEl.value.trim().length > 0 ||
                   filterPlatformEl.value !== "" ||
                   filterPhaseEl.value !== "" ||
                   !typePageEl.checked || !typeAiEl.checked || !typeFeatureEl.checked;
    clearFiltersEl.style.display = active ? "inline-block" : "none";
  }

  function getFilters() {
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

  // ==========================================
  // 7. CARD CREATION
  // ==========================================
  function createCardElement(item, handlers) {
    const card = document.createElement("div");
    card.className = `roadmap-card type-${item.type}`;
    card.dataset.itemId = item.id;
    card.dataset.platformId = item.platformId;
    card.dataset.phaseId = item.phaseId;
    card.setAttribute("draggable", "true");

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

  // ==========================================
  // 8. DRAWER MANAGEMENT
  // ==========================================
  const drawerOverlay = document.getElementById("drawerOverlay");
  const drawerTitle = document.getElementById("drawerTitle");
  const itemForm = document.getElementById("itemForm");
  const idInput = document.getElementById("formItemId");
  const titleInput = document.getElementById("formItemTitle");
  const platformSelect = document.getElementById("formItemPlatform");
  const phaseSelect = document.getElementById("formItemPhase");
  const errTitle = document.getElementById("errItemTitle");
  const errPlatform = document.getElementById("errItemPlatform");
  const errPhase = document.getElementById("errItemPhase");
  const errType = document.getElementById("errItemType");
  let isDrawerOpen = false;

  function initDrawer() {
    document.getElementById("drawerClose").addEventListener("click", closeDrawer);
    document.getElementById("btnCancelDrawer").addEventListener("click", closeDrawer);
    drawerOverlay.addEventListener("click", (e) => {
      if (e.target === drawerOverlay) closeDrawer();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isDrawerOpen) closeDrawer();
    });

    itemForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitForm();
    });

    titleInput.addEventListener("input", () => titleInput.parentElement.classList.remove("invalid"));
    platformSelect.addEventListener("change", () => platformSelect.parentElement.classList.remove("invalid"));
    phaseSelect.addEventListener("change", () => phaseSelect.parentElement.classList.remove("invalid"));

    itemForm.querySelectorAll("input[name='formItemType']").forEach(r => {
      r.addEventListener("change", () => errType.parentElement.classList.remove("invalid"));
    });
  }

  function openDrawer(mode = "create", itemId = null, defaultPlatform = "", defaultPhase = "") {
    isDrawerOpen = true;
    itemForm.reset();
    idInput.value = "";
    itemForm.querySelectorAll(".form-field").forEach(f => f.classList.remove("invalid"));

    // Populate selects
    platformSelect.innerHTML = '<option value="">Select Platform</option>';
    store.getPlatforms().forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      platformSelect.appendChild(opt);
    });

    phaseSelect.innerHTML = '<option value="">Select Phase</option>';
    store.getPhases().forEach(ph => {
      const opt = document.createElement("option");
      opt.value = ph.id;
      opt.textContent = ph.name;
      phaseSelect.appendChild(opt);
    });

    if (mode === "edit" && itemId) {
      drawerTitle.textContent = "Edit Roadmap Item";
      const item = store.getItems().find(i => i.id === itemId);
      if (item) {
        idInput.value = item.id;
        titleInput.value = item.title;
        platformSelect.value = item.platformId;
        phaseSelect.value = item.phaseId;
        const radio = itemForm.querySelector(`input[name="formItemType"][value="${item.type}"]`);
        if (radio) radio.checked = true;
      }
    } else {
      drawerTitle.textContent = "Add Roadmap Item";
      if (defaultPlatform) platformSelect.value = defaultPlatform;
      if (defaultPhase) phaseSelect.value = defaultPhase;
    }

    drawerOverlay.classList.add("active");
    titleInput.focus();
  }

  function closeDrawer() {
    isDrawerOpen = false;
    drawerOverlay.classList.remove("active");
  }

  async function submitForm() {
    const itemId = idInput.value;
    const title = titleInput.value.trim();
    const platformId = platformSelect.value;
    const phaseId = phaseSelect.value;
    const typeRadio = itemForm.querySelector("input[name='formItemType']:checked");
    const type = typeRadio ? typeRadio.value : "";

    let valid = true;
    if (!title) {
      titleInput.parentElement.classList.add("invalid");
      valid = false;
    }
    if (!platformId) {
      platformSelect.parentElement.classList.add("invalid");
      valid = false;
    }
    if (!phaseId) {
      phaseSelect.parentElement.classList.add("invalid");
      valid = false;
    }
    if (!type) {
      errType.parentElement.classList.add("invalid");
      valid = false;
    }

    if (!valid) return;
    const data = { title, platformId, phaseId, type };

    if (itemId) {
      await store.updateItem(itemId, data);
    } else {
      await store.addItem(data);
    }
    closeDrawer();
  }

  // ==========================================
  // 9. DETAILS MODAL & EMBEDS
  // ==========================================
  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalBadges = document.getElementById("modalBadges");
  const modalCloseBtn = document.getElementById("modalClose");
  const modalEditBtn = document.getElementById("btnEditModal");
  const figmaContainer = document.getElementById("figmaContainer");
  const figmaActions = document.getElementById("figmaActions");
  const docContainer = document.getElementById("docContainer");
  const docActions = document.getElementById("docActions");
  let activeItemId = null;
  let isModalOpen = false;

  function initModal() {
    modalCloseBtn.addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isModalOpen) closeModal();
    });

    modalEditBtn.addEventListener("click", () => {
      if (activeItemId) {
        closeModal();
        openDrawer("edit", activeItemId);
      }
    });

    store.on("change", () => {
      if (isModalOpen && activeItemId) renderModalContent();
    });
  }

  function openModal(itemId) {
    isModalOpen = true;
    activeItemId = itemId;
    renderModalContent();
    modalOverlay.classList.add("active");
  }

  function closeModal() {
    isModalOpen = false;
    activeItemId = null;
    modalOverlay.classList.remove("active");
  }

  function renderModalContent() {
    const item = store.getItems().find(i => i.id === activeItemId);
    if (!item) {
      closeModal();
      return;
    }

    const platform = store.getPlatforms().find(p => p.id === item.platformId);
    const phase = store.getPhases().find(p => p.id === item.phaseId);

    modalTitle.textContent = item.title;
    modalBadges.innerHTML = `
      <span class="modal-badge platform-badge">${platform ? platform.name : 'Unknown Platform'}</span>
      <span class="modal-badge phase-badge">${phase ? phase.name : 'Unknown Phase'}</span>
      <span class="modal-badge type-badge ${item.type}-badge">${item.type}</span>
    `;

    renderFigmaSection(item);
    renderDocSection(item);
  }

  function renderFigmaSection(item) {
    const hasFigma = item.figmaUrl && item.figmaUrl.trim().length > 0;
    if (!hasFigma) {
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
      figmaActions.innerHTML = `
        <button class="btn btn-secondary btn-sm btn-edit-figma">Edit URL</button>
        <button class="btn btn-secondary btn-sm btn-delete-figma btn-danger">Remove</button>
      `;

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
        const confirmed = await confirmAction("Remove Figma Embed", "Are you sure you want to remove this Figma link?");
        if (confirmed) {
          await store.updateItem(item.id, { figmaUrl: "" });
        }
      });
    }
  }

  function renderDocSection(item) {
    const hasDoc = item.docUrl && item.docUrl.trim().length > 0;
    if (!hasDoc) {
      docActions.innerHTML = "";
      docContainer.innerHTML = `
        <div class="embed-empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <p>No document or requirements URL added yet.</p>
          <button class="btn btn-secondary btn-sm btn-add-doc-url">Add Document Embed</button>
        </div>
      `;
      docContainer.querySelector(".btn-add-doc-url").addEventListener("click", () => {
        showEmbedInputForm(docContainer, "doc", item.docUrl);
      });
    } else {
      docActions.innerHTML = `
        <button class="btn btn-secondary btn-sm btn-edit-doc">Edit URL</button>
        <button class="btn btn-secondary btn-sm btn-delete-doc btn-danger">Remove</button>
      `;

      let embedUrl = item.docUrl;
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

  function showEmbedInputForm(container, type, currentUrl) {
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

    const div = document.createElement("div");
    div.innerHTML = formHtml;
    const formEl = div.firstElementChild;
    container.style.position = "relative";
    container.appendChild(formEl);

    const input = formEl.querySelector("#tempUrlInput");
    input.focus();
    input.select();

    const cleanForm = (e) => {
      e.stopPropagation();
      formEl.remove();
    };

    const saveForm = async (e) => {
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
    };

    formEl.querySelector(".btn-cancel-url-form").addEventListener("click", cleanForm);
    formEl.querySelector(".btn-save-url-form").addEventListener("click", saveForm);

    input.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        await saveForm(e);
      } else if (e.key === "Escape") {
        cleanForm(e);
      }
    });
  }

  // ==========================================
  // 10. DRAG & DROP MECHANICS
  // ==========================================
  let draggedCardId = null;

  function initDragAndDrop() {
    const canvasEl = document.getElementById("roadmapCanvas");
    if (!canvasEl) return;

    canvasEl.addEventListener("dragstart", (e) => {
      const card = e.target.closest(".roadmap-card");
      if (!card) return;
      draggedCardId = card.dataset.itemId;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedCardId);
    });

    canvasEl.addEventListener("dragend", (e) => {
      const card = e.target.closest(".roadmap-card");
      if (card) card.classList.remove("dragging");
      canvasEl.querySelectorAll(".grid-cell").forEach(c => c.classList.remove("drag-over"));
      draggedCardId = null;
    });

    canvasEl.addEventListener("dragover", (e) => {
      const cell = e.target.closest(".grid-cell");
      if (!cell) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      cell.classList.add("drag-over");
    });

    canvasEl.addEventListener("dragleave", (e) => {
      const cell = e.target.closest(".grid-cell");
      if (!cell) return;
      const rect = cell.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX >= rect.right ||
        e.clientY < rect.top ||
        e.clientY >= rect.bottom
      ) {
        cell.classList.remove("drag-over");
      }
    });

    canvasEl.addEventListener("drop", async (e) => {
      const cell = e.target.closest(".grid-cell");
      if (!cell) return;
      e.preventDefault();
      cell.classList.remove("drag-over");

      const itemId = e.dataTransfer.getData("text/plain") || draggedCardId;
      if (!itemId) return;

      const targetPlatId = cell.dataset.platformId;
      const targetPhaseId = cell.dataset.phaseId;

      const cardElements = Array.from(cell.querySelectorAll(".roadmap-card:not(.dragging)"));
      let insertIndex = cardElements.length;
      for (let i = 0; i < cardElements.length; i++) {
        const cardRect = cardElements[i].getBoundingClientRect();
        const cardMidpoint = cardRect.top + cardRect.height / 2;
        if (e.clientY < cardMidpoint) {
          insertIndex = i;
          break;
        }
      }

      const otherItemIds = cardElements.map(el => el.dataset.itemId);
      const newOrderedIds = [...otherItemIds];
      newOrderedIds.splice(insertIndex, 0, itemId);

      const updates = newOrderedIds.map((id, index) => ({
        id,
        platformId: targetPlatId,
        phaseId: targetPhaseId,
        sortOrder: index + 1
      }));

      await store.updateItemPositions(updates);
    });
  }

  // ==========================================
  // 11. ROADMAP GRID CANVAS RENDERING
  // ==========================================
  const canvasEl = document.getElementById("roadmapCanvas");

  function getPhaseColorTheme(phaseId) {
    if (phaseId === "phase-mvp") return "mvp";
    if (phaseId === "phase-p2") return "2";
    if (phaseId === "phase-p3") return "3";
    if (phaseId === "phase-p4") return "4";
    const index = store.getPhases().findIndex(p => p.id === phaseId);
    const extraPalettes = ["custom-1", "custom-2", "custom-3"];
    return extraPalettes[index % extraPalettes.length];
  }

  function renderRoadmap() {
    if (!canvasEl) return;
    const platforms = store.getPlatforms();
    const phases = store.getPhases();
    const filters = getFilters();

    if (platforms.length === 0 && phases.length === 0) {
      canvasEl.innerHTML = `
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

    const columnsCount = phases.length;
    canvasEl.style.gridTemplateColumns = `220px repeat(${columnsCount}, 280px) 60px`;

    let html = "";
    
    // Header Platforms column label
    html += `<div class="grid-header-cell platform-label-header">Platformalar</div>`;

    // Phase headers
    phases.forEach((phase) => {
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
          <div class="phase-period" data-phase-id="${phase.id}" contenteditable="true" spellcheck="false" title="Click to edit period">${escapeHTML(phase.period)}</div>
          <div class="phase-objective" data-phase-id="${phase.id}" contenteditable="true" spellcheck="false" placeholder="Phase objective...">${escapeHTML(phase.objective || 'Double click to add objective...')}</div>
        </div>
      `;
    });

    // "Add Phase" Header button
    html += `
      <div class="grid-add-column-btn" id="btnAddPhaseCol" title="Add Phase Column">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 20px; height: 20px;">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </div>
    `;

    // Platforms grid rows
    let cardsFilteredCount = 0;
    let totalCardsCount = store.getItems().length;

    platforms.forEach((platform) => {
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

      phases.forEach((phase) => {
        const items = store.getItemsForCell(platform.id, phase.id);
        const filteredItems = items.filter(item => {
          if (filters.title && !item.title.toLowerCase().includes(filters.title)) return false;
          if (filters.platformId && item.platformId !== filters.platformId) return false;
          if (filters.phaseId && item.phaseId !== filters.phaseId) return false;
          if (filters.types.length > 0 && !filters.types.includes(item.type)) return false;
          return true;
        });

        cardsFilteredCount += filteredItems.length;

        html += `
          <div class="grid-cell" data-platform-id="${platform.id}" data-phase-id="${phase.id}">
            <div class="card-list" id="list-${platform.id}-${phase.id}">
              <!-- Cards dynamically rendered here -->
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

      html += `<div style="background-color: var(--bg-app); border-bottom: 1px solid var(--border-color);"></div>`;
    });

    // "Add Platform" row button
    html += `
      <div class="grid-add-row-cell" id="btnAddPlatformRow">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 16px; height: 16px; margin-right: 6px;">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Add Platform
      </div>
    `;

    for (let i = 0; i <= phases.length; i++) {
      html += `<div style="background-color: var(--bg-app);"></div>`;
    }

    canvasEl.innerHTML = html;

    // Render cards inside cells
    platforms.forEach((platform) => {
      phases.forEach((phase) => {
        const cellList = document.getElementById(`list-${platform.id}-${phase.id}`);
        if (!cellList) return;

        const items = store.getItemsForCell(platform.id, phase.id);
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
      canvasEl.appendChild(filterEmptyOverlay);
    }

    attachRoadmapCellEventHandlers();
  }

  function attachRoadmapCellEventHandlers() {
    // 1. Cell level '+' button clicks
    canvasEl.querySelectorAll(".cell-add-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        openDrawer("create", null, btn.dataset.platformId, btn.dataset.phaseId);
      });
    });

    // 2. Delete Platform
    canvasEl.querySelectorAll(".btn-delete-platform").forEach(btn => {
      btn.addEventListener("click", async () => {
        const platformId = btn.dataset.platformId;
        const platform = store.getPlatforms().find(p => p.id === platformId);
        const items = store.getItems().filter(i => i.platformId === platformId);
        let msg = `Are you sure you want to delete the platform row "${platform ? platform.name : ''}"?`;
        if (items.length > 0) {
          msg = `WARNING: "${platform ? platform.name : ''}" contains ${items.length} items. Deleting the platform row will permanently delete all associated roadmap items. Continue?`;
        }
        const confirmed = await confirmAction("Delete Platform Row", msg, "Delete Platform");
        if (confirmed) {
          await store.deletePlatform(platformId);
        }
      });
    });

    // 3. Delete Phase
    canvasEl.querySelectorAll(".btn-delete-phase").forEach(btn => {
      btn.addEventListener("click", async () => {
        const phaseId = btn.dataset.phaseId;
        const phase = store.getPhases().find(ph => ph.id === phaseId);
        const items = store.getItems().filter(i => i.phaseId === phaseId);
        let msg = `Are you sure you want to delete the phase column "${phase ? phase.name : ''}"?`;
        if (items.length > 0) {
          msg = `WARNING: "${phase ? phase.name : ''}" contains ${items.length} items. Deleting this phase column will permanently delete all associated roadmap items. Continue?`;
        }
        const confirmed = await confirmAction("Delete Phase Column", msg, "Delete Phase");
        if (confirmed) {
          await store.deletePhase(phaseId);
        }
      });
    });

    // 4. Add Phase button
    document.getElementById("btnAddPhaseCol")?.addEventListener("click", async () => {
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

    // 5. Add Platform button
    document.getElementById("btnAddPlatformRow")?.addEventListener("click", async () => {
      const name = prompt("Enter new platform name:");
      if (name && name.trim()) {
        await store.addPlatform(name.trim());
      }
    });

    // 6. ContentEditable blur events
    canvasEl.querySelectorAll(".phase-name-text").forEach(el => {
      el.addEventListener("blur", async () => {
        const text = el.textContent.trim();
        if (!text) { renderRoadmap(); return; }
        await store.updatePhase(el.dataset.phaseId, { name: text });
      });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); el.blur(); } });
    });

    canvasEl.querySelectorAll(".phase-period").forEach(el => {
      el.addEventListener("blur", async () => {
        const text = el.textContent.trim();
        if (!isValidThreeMonthPeriod(text)) {
          alert("Phase period must represent exactly a 3-month duration. E.g. 'Jul 2025 – Sep 2025'.");
          renderRoadmap();
          return;
        }
        await store.updatePhase(el.dataset.phaseId, { period: text });
      });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); el.blur(); } });
    });

    canvasEl.querySelectorAll(".phase-objective").forEach(el => {
      el.addEventListener("focus", () => { if (el.textContent === "Double click to add objective...") el.textContent = ""; });
      el.addEventListener("blur", async () => {
        const text = el.textContent.trim();
        await store.updatePhase(el.dataset.phaseId, { objective: text });
      });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); el.blur(); } });
    });

    canvasEl.querySelectorAll(".platform-name-text").forEach(el => {
      el.addEventListener("blur", async () => {
        const text = el.textContent.trim();
        if (!text) { renderRoadmap(); return; }
        await store.updatePlatform(el.dataset.platformId, text);
      });
      el.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); el.blur(); } });
    });
  }

  // ==========================================
  // 12. APP INITIALIZATION & BOOTSTRAP
  // ==========================================
  document.addEventListener("DOMContentLoaded", async () => {
    console.log("AANA Product Roadmap app initialization starting...");

    initSidebar();
    initHeader();
    initFilters(() => {
      renderRoadmap();
    });
    initDrawer();
    initModal();
    initDragAndDrop();

    // Top Add Item button click
    const btnAddNew = document.getElementById("btnAddNewItem");
    if (btnAddNew) {
      btnAddNew.addEventListener("click", () => {
        openDrawer("create");
      });
    }

    store.on("change", () => {
      renderRoadmap();
    });

    // Initialize Store (Syncs from Firestore, fallbacks to localStorage)
    await store.init();
  });

})();
