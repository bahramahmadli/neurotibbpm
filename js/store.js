import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  collection, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { generateId } from "./utils.js";

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
    
    // Initialize Firebase
    try {
      this.app = initializeApp(firebaseConfig);
      this.db = getFirestore(this.app);
      console.log("Firebase initialized successfully with config projectId:", firebaseConfig.projectId);
    } catch (err) {
      console.error("Firebase initialization failed: ", err);
    }
  }

  // --- Event Emitter ---
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

  // --- Fetch & Sync ---
  async init() {
    try {
      console.log("Fetching data from Firestore...");
      const platformsColl = collection(this.db, "platforms");
      const phasesColl = collection(this.db, "phases");
      const itemsColl = collection(this.db, "items");
      const metaDocRef = doc(this.db, "settings", "project");

      // Load Platforms
      const platformSnap = await getDocs(query(platformsColl, orderBy("sortOrder")));
      const platforms = platformSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Load Phases
      const phaseSnap = await getDocs(query(phasesColl, orderBy("sortOrder")));
      const phases = phaseSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Load Items
      const itemSnap = await getDocs(query(itemsColl, orderBy("sortOrder")));
      const items = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Load Metadata
      const metaSnap = await getDocs(collection(this.db, "settings"));
      let metadata = this._data.metadata;
      if (!metaSnap.empty) {
        const docSnap = metaSnap.docs.find(d => d.id === "project");
        if (docSnap) {
          metadata = docSnap.data();
        }
      }

      this._data = { metadata, platforms, phases, items };

      // If empty database, write initial demo data
      if (platforms.length === 0 && phases.length === 0) {
        console.log("Firestore database is empty. Seeding initial demo data...");
        await this.seedInitialData();
      }

      this.emit("change", this._data);
      console.log("DataStore initialized with", this._data.platforms.length, "platforms,", this._data.phases.length, "phases, and", this._data.items.length, "items.");
    } catch (err) {
      console.error("Error loading data from Firestore: ", err);
      // Fallback to localStorage for robustness if Firebase rules/network block us
      console.log("Falling back to local storage...");
      this.loadFromLocalStorage();
      this.emit("change", this._data);
    }
  }

  async seedInitialData() {
    const initialPlatforms = [
      { id: "platform-website", name: "Website", sortOrder: 1 },
      { id: "platform-valideyn", name: "Valideyn paneli", sortOrder: 2 },
      { id: "platform-hekim", name: "Həkim paneli", sortOrder: 3 }
    ];

    const initialPhases = [
      { id: "phase-mvp", name: "MVP", period: "Jul 2025 – Sep 2025", objective: "Minimum Viable Product release", sortOrder: 1 },
      { id: "phase-p2", name: "Phase 2", period: "Oct 2025 – Dec 2025", objective: "Core enhancements and scaling", sortOrder: 2 },
      { id: "phase-p3", name: "Phase 3", period: "Jan 2026 – Mar 2026", objective: "Advanced AI integration", sortOrder: 3 },
      { id: "phase-p4", name: "Phase 4", period: "Apr 2026 – Jun 2026", objective: "Full ecosystem features", sortOrder: 4 }
    ];

    const batch = writeBatch(this.db);

    initialPlatforms.forEach(p => {
      const ref = doc(this.db, "platforms", p.id);
      batch.set(ref, { name: p.name, sortOrder: p.sortOrder });
    });

    initialPhases.forEach(ph => {
      const ref = doc(this.db, "phases", ph.id);
      batch.set(ref, { name: ph.name, period: ph.period, objective: ph.objective, sortOrder: ph.sortOrder });
    });

    const metaRef = doc(this.db, "settings", "project");
    batch.set(metaRef, this._data.metadata);

    await batch.commit();
    
    this._data.platforms = initialPlatforms;
    this._data.phases = initialPhases;
    this._data.items = [];
    this.saveToLocalStorage();
  }

  loadFromLocalStorage() {
    const local = localStorage.getItem("aana_roadmap_local_cache");
    if (local) {
      try {
        this._data = JSON.parse(local);
      } catch (e) {
        console.error("Error parsing local storage data: ", e);
      }
    }
  }

  saveToLocalStorage() {
    localStorage.setItem("aana_roadmap_local_cache", JSON.stringify(this._data));
  }

  // --- Metadata ---
  getMetadata() {
    return this._data.metadata;
  }

  async updateMetadata(fields) {
    this._data.metadata = { ...this._data.metadata, ...fields };
    this.saveToLocalStorage();
    this.emit("change", this._data);

    try {
      await setDoc(doc(this.db, "settings", "project"), this._data.metadata);
    } catch (err) {
      console.error("Firestore sync error on updateMetadata:", err);
    }
  }

  // --- Platforms ---
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

    try {
      await setDoc(doc(this.db, "platforms", id), { name, sortOrder });
    } catch (err) {
      console.error("Firestore sync error on addPlatform:", err);
    }
    return newPlatform;
  }

  async updatePlatform(id, name) {
    const platform = this._data.platforms.find(p => p.id === id);
    if (platform) {
      platform.name = name;
      this.saveToLocalStorage();
      this.emit("change", this._data);

      try {
        await updateDoc(doc(this.db, "platforms", id), { name });
      } catch (err) {
        console.error("Firestore sync error on updatePlatform:", err);
      }
    }
  }

  async deletePlatform(id) {
    // Delete items assigned to this platform
    const itemsToDelete = this._data.items.filter(item => item.platformId === id);
    this._data.items = this._data.items.filter(item => item.platformId !== id);
    this._data.platforms = this._data.platforms.filter(p => p.id !== id);
    
    this.saveToLocalStorage();
    this.emit("change", this._data);

    try {
      const batch = writeBatch(this.db);
      batch.delete(doc(this.db, "platforms", id));
      itemsToDelete.forEach(item => {
        batch.delete(doc(this.db, "items", item.id));
      });
      await batch.commit();
    } catch (err) {
      console.error("Firestore sync error on deletePlatform:", err);
    }
  }

  // --- Phases ---
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

    try {
      await setDoc(doc(this.db, "phases", id), { name, period, objective, sortOrder });
    } catch (err) {
      console.error("Firestore sync error on addPhase:", err);
    }
    return newPhase;
  }

  async updatePhase(id, fields) {
    const phase = this._data.phases.find(p => p.id === id);
    if (phase) {
      Object.assign(phase, fields);
      this.saveToLocalStorage();
      this.emit("change", this._data);

      try {
        await updateDoc(doc(this.db, "phases", id), fields);
      } catch (err) {
        console.error("Firestore sync error on updatePhase:", err);
      }
    }
  }

  async deletePhase(id) {
    // Delete items assigned to this phase
    const itemsToDelete = this._data.items.filter(item => item.phaseId === id);
    this._data.items = this._data.items.filter(item => item.phaseId !== id);
    this._data.phases = this._data.phases.filter(ph => ph.id !== id);

    this.saveToLocalStorage();
    this.emit("change", this._data);

    try {
      const batch = writeBatch(this.db);
      batch.delete(doc(this.db, "phases", id));
      itemsToDelete.forEach(item => {
        batch.delete(doc(this.db, "items", item.id));
      });
      await batch.commit();
    } catch (err) {
      console.error("Firestore sync error on deletePhase:", err);
    }
  }

  // --- Items ---
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
    
    // Determine sort order in target cell
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

    try {
      await setDoc(doc(this.db, "items", id), {
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
      console.error("Firestore sync error on addItem:", err);
    }
    return newItem;
  }

  async updateItem(id, fields) {
    const item = this._data.items.find(i => i.id === id);
    if (item) {
      const now = new Date().toISOString();
      const updatedFields = { ...fields, updatedDate: now };

      // Handle re-ordering if phase or platform changed
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

      try {
        await updateDoc(doc(this.db, "items", id), updatedFields);
      } catch (err) {
        console.error("Firestore sync error on updateItem:", err);
      }
    }
  }

  async updateItemPositions(itemsToUpdate) {
    // itemsToUpdate is array of { id, platformId, phaseId, sortOrder }
    const batch = writeBatch(this.db);
    const now = new Date().toISOString();

    itemsToUpdate.forEach(updateInfo => {
      const item = this._data.items.find(i => i.id === updateInfo.id);
      if (item) {
        item.platformId = updateInfo.platformId;
        item.phaseId = updateInfo.phaseId;
        item.sortOrder = updateInfo.sortOrder;
        item.updatedDate = now;

        const docRef = doc(this.db, "items", item.id);
        batch.update(docRef, {
          platformId: item.platformId,
          phaseId: item.phaseId,
          sortOrder: item.sortOrder,
          updatedDate: now
        });
      }
    });

    this.saveToLocalStorage();
    this.emit("change", this._data);

    try {
      await batch.commit();
    } catch (err) {
      console.error("Firestore sync error on updateItemPositions:", err);
    }
  }

  async deleteItem(id) {
    this._data.items = this._data.items.filter(i => i.id !== id);
    this.saveToLocalStorage();
    this.emit("change", this._data);

    try {
      await deleteDoc(doc(this.db, "items", id));
    } catch (err) {
      console.error("Firestore sync error on deleteItem:", err);
    }
  }
}

// Single instance shared across all files
const store = new DataStore();
export default store;
export { store };
