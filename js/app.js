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

  function formatPeriod(startDate, endDate) {
    if (!startDate || !endDate) return '';
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return '';
    const formatMonthYear = (d) => {
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };
    return `${formatMonthYear(s)} – ${formatMonthYear(e)}`;
  }

  function parsePeriodToDates(periodStr) {
    if (!periodStr) return { start: "2025-07-01", end: "2025-09-30" };
    const parts = periodStr.split(/[–-]/).map(p => p.trim());
    if (parts.length !== 2) return { start: "2025-07-01", end: "2025-09-30" };
    
    const formatDateObj = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const s = new Date(parts[0]);
    const e = new Date(parts[1]);
    
    return {
      start: isNaN(s.getTime()) ? "2025-07-01" : formatDateObj(s),
      end: isNaN(e.getTime()) ? "2025-09-30" : formatDateObj(e)
    };
  }

  const saveToast = document.getElementById('saveStatusToast');
  const toastText = document.getElementById('toastText');
  
  function showSaveStatus(status, errorMsg = '') {
    if (!saveToast) return;
    saveToast.className = 'save-status-toast active ' + status;
    if (status === 'saving') {
      toastText.textContent = 'Saving...';
    } else if (status === 'saved') {
      toastText.textContent = 'Saved';
      setTimeout(() => {
        if (saveToast.classList.contains('saved')) {
          saveToast.classList.remove('active');
        }
      }, 2000);
    } else if (status === 'failed') {
      toastText.textContent = 'Save failed ' + (errorMsg ? `(${errorMsg.substring(0, 40)})` : '');
      setTimeout(() => {
        if (saveToast.classList.contains('failed')) {
          saveToast.classList.remove('active');
        }
      }, 4000);
    }
  }

  const dbErrorOverlay = document.getElementById('dbErrorOverlay');
  
  function showDbError(show, msg = '') {
    if (!dbErrorOverlay) return;
    if (show) {
      dbErrorOverlay.style.display = 'flex';
      if (msg) {
        document.getElementById('dbErrorMessage').textContent = msg;
      }
    } else {
      dbErrorOverlay.style.display = 'none';
    }
  }

  const authOverlay = document.getElementById('authOverlay');
  const authErrorMsg = document.getElementById('authErrorMsg');
  
  function showAuthOverlay(show, error = '') {
    if (!authOverlay) return;
    authOverlay.style.display = show ? 'flex' : 'none';
    if (error) {
      authErrorMsg.style.display = 'block';
      authErrorMsg.textContent = error;
    } else {
      authErrorMsg.style.display = 'none';
    }

    // Handle local file:// protocol warnings and button disabling
    const authFileWarning = document.getElementById('authFileWarning');
    const btnGoogleSignIn = document.getElementById('btnGoogleSignIn');
    if (authFileWarning && btnGoogleSignIn) {
      if (show && window.location.protocol === 'file:') {
        authFileWarning.style.display = 'block';
        btnGoogleSignIn.disabled = true;
        btnGoogleSignIn.style.opacity = '0.5';
        btnGoogleSignIn.style.cursor = 'not-allowed';
        btnGoogleSignIn.title = "Google Sign-In is not supported when running via file:// protocol.";
      } else {
        authFileWarning.style.display = 'none';
        if (btnGoogleSignIn.disabled) {
          btnGoogleSignIn.disabled = false;
          btnGoogleSignIn.style.opacity = '1';
          btnGoogleSignIn.style.cursor = 'pointer';
          btnGoogleSignIn.title = "";
        }
      }
    }
  }

  function setAuthLoading(loading, loadingText = 'Processing...') {
    const emailInput = document.getElementById("authEmail");
    const passwordInput = document.getElementById("authPassword");
    const btnSignIn = document.getElementById("btnEmailSignIn");
    const btnSignUp = document.getElementById("btnEmailSignUp");
    
    if (emailInput) emailInput.disabled = loading;
    if (passwordInput) passwordInput.disabled = loading;
    
    if (btnSignIn) {
      btnSignIn.disabled = loading;
      btnSignIn.textContent = loading ? loadingText : 'Sign In';
    }
    if (btnSignUp) {
      btnSignUp.disabled = loading;
      btnSignUp.textContent = loading ? '...' : 'Register';
    }
  }

  function timeoutPromise(promise, ms, errorMsg = "Connection timeout") {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(errorMsg));
      }, ms);
      promise.then(
        (res) => {
          clearTimeout(timer);
          resolve(res);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  class DataStore {
    constructor() {
      this._data = {
        metadata: {
          name: "Neurotibb Product Roadmap",
          description: "Interactive phase-based roadmap for coordinating products, timelines, and feature releases.",
          documentOwner: "Neurotibb Product Team",
          version: "v1.2.0",
          status: "Active"
        },
        platforms: [],
        phases: [],
        items: []
      };
      this._listeners = {};
      this._unsubscribes = {};
      this.currentUser = null;
      this.userRole = 'viewer';
      
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
          try {
            this.db.settings({ experimentalForceLongPolling: true });
            console.log("Firestore settings applied: forced long-polling.");
          } catch (e) {
            console.warn("Could not apply Firestore settings:", e);
          }
          console.log("Firebase Compat SDK initialized successfully.");
        } else {
          console.warn("Firebase global SDK not found.");
          showDbError(true, "Firebase SDK script not loaded. Check network or firewall.");
        }
      } catch (err) {
        console.error("Firebase initialization failed: ", err);
        showDbError(true, "Firebase initialization failed: " + err.message);
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
      if (!this.db) {
        showDbError(true, "Firestore database not available.");
        return;
      }

      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          console.log("User logged in:", user.email);
          
          try {
            await timeoutPromise(this.migrateData(), 6000, "Database migration timed out. Please check network/rules.");
            
            const memberDoc = await timeoutPromise(this.db.collection("projects").doc("neurotibb").collection("members").doc(user.uid).get(), 6000, "Membership check timed out. Please check network/rules.");
            if (memberDoc.exists) {
              this.userRole = memberDoc.data().role || 'viewer';
              this.currentUser = { uid: user.uid, email: user.email, displayName: memberDoc.data().displayName || user.email.split('@')[0], role: this.userRole };
              
              await timeoutPromise(this.checkAndSeedDatabase(), 6000, "Database seeding timed out.");
              this.setupUserUI();
              this.startRealtimeListeners();
            } else {
              const membersSnap = await timeoutPromise(this.db.collection("projects").doc("neurotibb").collection("members").limit(1).get(), 6000, "Members collection query timed out.");
              if (membersSnap.empty) {
                console.log("Registering first user as project owner");
                const ownerData = {
                  email: user.email,
                  displayName: user.displayName || user.email.split('@')[0],
                  role: "owner",
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await timeoutPromise(this.db.collection("projects").doc("neurotibb").collection("members").doc(user.uid).set(ownerData), 6000, "Registration save timed out.");
                this.userRole = "owner";
                this.currentUser = { uid: user.uid, email: user.email, displayName: ownerData.displayName, role: "owner" };
                
                await timeoutPromise(this.checkAndSeedDatabase(), 6000, "Database seeding timed out.");
                this.setupUserUI();
                this.startRealtimeListeners();
              } else {
                console.error("Access Denied: Not a member");
                await firebase.auth().signOut();
                showAuthOverlay(true, "Access Denied: You are not a member of the Neurotibb project.");
              }
            }
          } catch (err) {
            console.error("Auth state resolve error:", err);
            showAuthOverlay(true, "Authorization error: " + err.message);
          }
        } else {
          console.log("No user authenticated.");
          this.currentUser = null;
          this.userRole = 'viewer';
          this.stopRealtimeListeners();
          const authSec = document.getElementById('sidebarAuthSection');
          if (authSec) authSec.style.display = 'none';
          showAuthOverlay(true);
        }
      });
    }

    setupUserUI() {
      document.getElementById('userName').textContent = this.currentUser.displayName;
      document.getElementById('userRole').textContent = this.currentUser.role;
      document.getElementById('userAvatar').textContent = this.currentUser.displayName.charAt(0).toUpperCase();
      document.getElementById('sidebarAuthSection').style.display = 'flex';
      showAuthOverlay(false);
      
      const isViewer = this.userRole === 'viewer';
      const addNewItemBtn = document.getElementById('btnAddNewItem');
      if (addNewItemBtn) {
        addNewItemBtn.style.display = isViewer ? 'none' : 'inline-flex';
      }
      
      const titleEl = document.getElementById("projectTitle");
      const descEl = document.getElementById("projectDesc");
      const ownerEl = document.getElementById("metaOwner");
      const versionEl = document.getElementById("metaVersion");
      const statusEl = document.getElementById("metaStatus");
      
      const editable = this.userRole === 'owner';
      if (titleEl) titleEl.setAttribute("contenteditable", editable ? "true" : "false");
      if (descEl) descEl.setAttribute("contenteditable", editable ? "true" : "false");
      if (ownerEl) ownerEl.setAttribute("contenteditable", editable ? "true" : "false");
      if (versionEl) versionEl.setAttribute("contenteditable", editable ? "true" : "false");
      if (statusEl) statusEl.setAttribute("contenteditable", editable ? "true" : "false");
    }

    startRealtimeListeners() {
      this.stopRealtimeListeners();
      if (!this.db) return;
      
      const projectRef = this.db.collection("projects").doc("neurotibb");
      
      this._unsubscribes.metadata = projectRef.onSnapshot(doc => {
        if (doc.exists) {
          const data = doc.data();
          this._data.metadata = {
            title: data.name || "Neurotibb Product Roadmap",
            description: data.description || "",
            owner: data.documentOwner || "",
            version: data.version || "",
            status: data.status || "Active",
            lastUpdated: data.updatedAt ? formatDate(data.updatedAt.toDate()) : "Recently"
          };
          this.emit("change", this._data);
        }
      }, err => {
        console.error("Metadata listener error:", err);
        showDbError(true, "Database read permission error or disconnected: " + err.message);
      });

      this._unsubscribes.platforms = projectRef.collection("platforms")
        .onSnapshot(snap => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(p => p.isArchived !== true);
          list.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
          this._data.platforms = list;
          this.emit("change", this._data);
        }, err => {
          console.error("Platforms listener error:", err);
        });

      this._unsubscribes.phases = projectRef.collection("phases")
        .onSnapshot(snap => {
          const list = snap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              period: formatPeriod(data.startDate, data.endDate)
            };
          }).filter(p => p.isArchived !== true);
          list.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
          this._data.phases = list;
          this.emit("change", this._data);
        }, err => {
          console.error("Phases listener error:", err);
        });

      this._unsubscribes.items = projectRef.collection("items")
        .onSnapshot(snap => {
          const list = snap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              figmaUrl: data.figmaEmbedUrl || "",
              docUrl: data.documentEmbedUrl || ""
            };
          }).filter(p => p.isArchived !== true);
          list.sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
          this._data.items = list;
          this.emit("change", this._data);
        }, err => {
          console.error("Items listener error:", err);
        });
        
      showDbError(false);
    }

    stopRealtimeListeners() {
      Object.keys(this._unsubscribes).forEach(key => {
        if (typeof this._unsubscribes[key] === 'function') {
          this._unsubscribes[key]();
        }
      });
      this._unsubscribes = {};
    }

    async signInWithGoogle() {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        await firebase.auth().signInWithPopup(provider);
      } catch (err) {
        console.error("Google sign in failed:", err);
        showAuthOverlay(true, "Sign In Failed: " + err.message);
      }
    }

    async signInWithEmail(email, password) {
      try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
      } catch (err) {
        console.error("Email sign in failed:", err);
        showAuthOverlay(true, "Sign In Failed: " + err.message);
      }
    }

    async signUpWithEmail(email, password) {
      try {
        await firebase.auth().createUserWithEmailAndPassword(email, password);
      } catch (err) {
        console.error("Register failed:", err);
        showAuthOverlay(true, "Registration Failed: " + err.message);
      }
    }

    async signOut() {
      try {
        await firebase.auth().signOut();
      } catch (err) {
        console.error("Sign out failed:", err);
      }
    }

    validateProject(name) {
      if (!name || name.trim() === "") throw new Error("Project name cannot be empty.");
      return true;
    }

    validatePlatform(name) {
      if (!name || name.trim() === "") throw new Error("Platform name cannot be empty.");
      return true;
    }

    validatePhase(name, startDate, endDate) {
      if (!name || name.trim() === "") throw new Error("Phase name cannot be empty.");
      if (!startDate || !endDate) throw new Error("Phase start date and end date are required.");
      if (!isValidThreeMonthPeriod(startDate, endDate)) {
        throw new Error("Phase period must cover exactly a 3-month duration.");
      }
      return true;
    }

    validateItem(title, type, platformId, phaseId, sortOrder) {
      if (!title || title.trim() === "") throw new Error("Roadmap item title cannot be empty.");
      if (!['page', 'ai', 'feature'].includes(type)) {
        throw new Error("Roadmap item type must be 'page', 'ai', or 'feature'.");
      }
      if (!platformId) throw new Error("platformId is required.");
      if (!phaseId) throw new Error("phaseId is required.");
      if (typeof sortOrder !== 'number' || isNaN(sortOrder)) {
        throw new Error("sortOrder must be a valid number.");
      }
      return true;
    }

    async logAudit(action, entityType, entityId, changedFields) {
      if (!this.db) return;
      try {
        const logId = generateId();
        const logRef = this.db.collection("projects").doc("neurotibb").collection("auditLogs").doc(logId);
        await logRef.set({
          action,
          entityType,
          entityId,
          changedFields: changedFields || {},
          userId: this.currentUser ? this.currentUser.uid : "system",
          userEmail: this.currentUser ? this.currentUser.email : "system@neurotibb.com",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } catch (err) {
        console.error("Failed to write audit log:", err);
      }
    }

    getMetadata() {
      return this._data.metadata;
    }

    async updateMetadata(fields) {
      if (this.userRole !== 'owner') {
        alert("Permission denied. Only owners can edit project metadata.");
        return;
      }
      
      const updateData = {};
      if (fields.title !== undefined) updateData.name = fields.title;
      if (fields.description !== undefined) updateData.description = fields.description;
      if (fields.owner !== undefined) updateData.documentOwner = fields.owner;
      if (fields.version !== undefined) updateData.version = fields.version;
      if (fields.status !== undefined) updateData.status = fields.status;

      try {
        if (updateData.name !== undefined) this.validateProject(updateData.name);
      } catch (e) {
        alert(e.message);
        return;
      }

      Object.assign(this._data.metadata, fields);
      this.emit("change", this._data);

      if (!this.db) return;
      showSaveStatus('saving');
      try {
        updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        updateData.updatedBy = this.currentUser.uid;
        await this.db.collection("projects").doc("neurotibb").update(updateData);
        await this.logAudit("update", "project", "neurotibb", updateData);
        showSaveStatus('saved');
      } catch (err) {
        console.error("Firestore updateMetadata error:", err);
        showSaveStatus('failed', err.message);
      }
    }

    getPlatforms() {
      return this._data.platforms;
    }

    async addPlatform(name) {
      if (this.userRole === 'viewer') {
        alert("Permission denied. Viewers cannot write.");
        return;
      }
      try {
        this.validatePlatform(name);
      } catch (e) {
        alert(e.message);
        return;
      }

      const id = generateId();
      const sortOrder = this._data.platforms.length > 0 
        ? Math.max(...this._data.platforms.map(p => p.sortOrder || 0)) + 1 
        : 1;
      
      const newPlatform = { id, name, sortOrder, isArchived: false };
      this._data.platforms.push(newPlatform);
      this.emit("change", this._data);

      if (!this.db) return newPlatform;
      showSaveStatus('saving');
      try {
        const docData = {
          name,
          sortOrder,
          isArchived: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: this.currentUser.uid,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: this.currentUser.uid
        };
        await this.db.collection("projects").doc("neurotibb").collection("platforms").doc(id).set(docData);
        await this.logAudit("create", "platform", id, docData);
        showSaveStatus('saved');
      } catch (err) {
        console.error("Firestore addPlatform error:", err);
        showSaveStatus('failed', err.message);
      }
      return newPlatform;
    }

    async updatePlatform(id, name) {
      if (this.userRole === 'viewer') {
        alert("Permission denied. Viewers cannot write.");
        return;
      }
      try {
        this.validatePlatform(name);
      } catch (e) {
        alert(e.message);
        return;
      }

      const platform = this._data.platforms.find(p => p.id === id);
      if (platform) {
        platform.name = name;
        this.emit("change", this._data);

        if (!this.db) return;
        showSaveStatus('saving');
        try {
          const updateData = {
            name,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: this.currentUser.uid
          };
          await this.db.collection("projects").doc("neurotibb").collection("platforms").doc(id).update(updateData);
          await this.logAudit("update", "platform", id, updateData);
          showSaveStatus('saved');
        } catch (err) {
          console.error("Firestore updatePlatform error:", err);
          showSaveStatus('failed', err.message);
        }
      }
    }

    async deletePlatform(id) {
      if (this.userRole === 'viewer') {
        alert("Permission denied. Viewers cannot write.");
        return false;
      }

      const activeItems = this._data.items.filter(item => item.platformId === id && !item.isArchived);
      if (activeItems.length > 0) {
        alert("Cannot delete this platform. There are active roadmap items referencing it. Please re-assign or archive those items first.");
        return false;
      }

      const platform = this._data.platforms.find(p => p.id === id);
      if (platform) {
        platform.isArchived = true;
        this.emit("change", this._data);

        if (!this.db) return true;
        showSaveStatus('saving');
        try {
          const updateData = {
            isArchived: true,
            archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
            archivedBy: this.currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: this.currentUser.uid
          };
          await this.db.collection("projects").doc("neurotibb").collection("platforms").doc(id).update(updateData);
          await this.logAudit("archive", "platform", id, updateData);
          showSaveStatus('saved');
        } catch (err) {
          console.error("Firestore deletePlatform error:", err);
          showSaveStatus('failed', err.message);
        }
      }
      return true;
    }

    getPhases() {
      return this._data.phases;
    }

    async addPhase(name, period, objective = "") {
      if (this.userRole === 'viewer') {
        alert("Permission denied. Viewers cannot write.");
        return;
      }

      const { start, end } = parsePeriodToDates(period);
      try {
        this.validatePhase(name, start, end);
      } catch (e) {
        alert(e.message);
        return;
      }

      const id = generateId();
      const sortOrder = this._data.phases.length > 0
        ? Math.max(...this._data.phases.map(p => p.sortOrder || 0)) + 1
        : 1;

      const newPhase = {
        id,
        name,
        startDate: start,
        endDate: end,
        period: formatPeriod(start, end),
        objective,
        sortOrder,
        status: "Active",
        isArchived: false
      };
      
      this._data.phases.push(newPhase);
      this.emit("change", this._data);

      if (!this.db) return newPhase;
      showSaveStatus('saving');
      try {
        const docData = {
          name,
          startDate: start,
          endDate: end,
          objective,
          sortOrder,
          status: "Active",
          isArchived: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: this.currentUser.uid,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: this.currentUser.uid
        };
        await this.db.collection("projects").doc("neurotibb").collection("phases").doc(id).set(docData);
        await this.logAudit("create", "phase", id, docData);
        showSaveStatus('saved');
      } catch (err) {
        console.error("Firestore addPhase error:", err);
        showSaveStatus('failed', err.message);
      }
      return newPhase;
    }

    async updatePhase(id, fields) {
      if (this.userRole === 'viewer') {
        alert("Permission denied. Viewers cannot write.");
        return;
      }

      const phase = this._data.phases.find(p => p.id === id);
      if (!phase) return;

      const updateData = { ...fields };
      if (updateData.period !== undefined) {
        const { start, end } = parsePeriodToDates(updateData.period);
        updateData.startDate = start;
        updateData.endDate = end;
        delete updateData.period;
      }

      try {
        const targetName = updateData.name !== undefined ? updateData.name : phase.name;
        const targetStart = updateData.startDate !== undefined ? updateData.startDate : phase.startDate;
        const targetEnd = updateData.endDate !== undefined ? updateData.endDate : phase.endDate;
        this.validatePhase(targetName, targetStart, targetEnd);
      } catch (e) {
        alert(e.message);
        return;
      }

      Object.assign(phase, fields);
      if (updateData.startDate) {
        phase.startDate = updateData.startDate;
        phase.endDate = updateData.endDate;
        phase.period = formatPeriod(phase.startDate, phase.endDate);
      }
      this.emit("change", this._data);

      if (!this.db) return;
      showSaveStatus('saving');
      try {
        updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        updateData.updatedBy = this.currentUser.uid;
        await this.db.collection("projects").doc("neurotibb").collection("phases").doc(id).update(updateData);
        await this.logAudit("update", "phase", id, updateData);
        showSaveStatus('saved');
      } catch (err) {
        console.error("Firestore updatePhase error:", err);
        showSaveStatus('failed', err.message);
      }
    }

    async deletePhase(id) {
      if (this.userRole === 'viewer') {
        alert("Permission denied. Viewers cannot write.");
        return false;
      }

      const activeItems = this._data.items.filter(item => item.phaseId === id && !item.isArchived);
      if (activeItems.length > 0) {
        alert("Cannot delete this phase. There are active roadmap items referencing it. Please re-assign or archive those items first.");
        return false;
      }

      const phase = this._data.phases.find(ph => ph.id === id);
      if (phase) {
        phase.isArchived = true;
        this.emit("change", this._data);

        if (!this.db) return true;
        showSaveStatus('saving');
        try {
          const updateData = {
            isArchived: true,
            archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
            archivedBy: this.currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: this.currentUser.uid
          };
          await this.db.collection("projects").doc("neurotibb").collection("phases").doc(id).update(updateData);
          await this.logAudit("archive", "phase", id, updateData);
          showSaveStatus('saved');
        } catch (err) {
          console.error("Firestore deletePhase error:", err);
          showSaveStatus('failed', err.message);
        }
      }
      return true;
    }

    getItems() {
      return this._data.items;
    }

    getItemsForCell(platformId, phaseId) {
      return this._data.items
        .filter(item => item.platformId === platformId && item.phaseId === phaseId && !item.isArchived)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }

    async addItem(itemData) {
      if (this.userRole === 'viewer') {
        alert("Permission denied. Viewers cannot write.");
        return;
      }

      const cellItems = this.getItemsForCell(itemData.platformId, itemData.phaseId);
      const sortOrder = cellItems.length > 0
        ? Math.max(...cellItems.map(i => i.sortOrder || 0)) + 1
        : 1;

      try {
        this.validateItem(itemData.title, itemData.type, itemData.platformId, itemData.phaseId, sortOrder);
      } catch (e) {
        alert(e.message);
        return;
      }

      const id = generateId();
      const newItem = {
        id,
        title: itemData.title,
        platformId: itemData.platformId,
        phaseId: itemData.phaseId,
        type: itemData.type,
        figmaUrl: itemData.figmaUrl || "",
        docUrl: itemData.docUrl || "",
        sortOrder,
        isArchived: false
      };

      this._data.items.push(newItem);
      this.emit("change", this._data);

      if (!this.db) return newItem;
      showSaveStatus('saving');
      try {
        const docData = {
          title: newItem.title,
          type: newItem.type,
          platformId: newItem.platformId,
          phaseId: newItem.phaseId,
          sortOrder: newItem.sortOrder,
          figmaEmbedUrl: newItem.figmaUrl,
          documentEmbedUrl: newItem.docUrl,
          isArchived: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: this.currentUser.uid,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: this.currentUser.uid
        };
        await this.db.collection("projects").doc("neurotibb").collection("items").doc(id).set(docData);
        await this.logAudit("create", "item", id, docData);
        showSaveStatus('saved');
      } catch (err) {
        console.error("Firestore addItem error:", err);
        showSaveStatus('failed', err.message);
      }
      return newItem;
    }

    async updateItem(id, fields) {
      if (this.userRole === 'viewer') {
        alert("Permission denied. Viewers cannot write.");
        return;
      }

      const item = this._data.items.find(i => i.id === id);
      if (!item) return;

      const updateData = {};
      if (fields.title !== undefined) updateData.title = fields.title;
      if (fields.type !== undefined) updateData.type = fields.type;
      if (fields.platformId !== undefined) updateData.platformId = fields.platformId;
      if (fields.phaseId !== undefined) updateData.phaseId = fields.phaseId;
      if (fields.figmaUrl !== undefined) updateData.figmaEmbedUrl = fields.figmaUrl;
      if (fields.docUrl !== undefined) updateData.documentEmbedUrl = fields.docUrl;

      if (fields.platformId !== undefined || fields.phaseId !== undefined) {
        const targetPlat = fields.platformId !== undefined ? fields.platformId : item.platformId;
        const targetPhase = fields.phaseId !== undefined ? fields.phaseId : item.phaseId;
        
        if (targetPlat !== item.platformId || targetPhase !== item.phaseId) {
          const cellItems = this.getItemsForCell(targetPlat, targetPhase);
          updateData.sortOrder = cellItems.length > 0
            ? Math.max(...cellItems.map(i => i.sortOrder || 0)) + 1
            : 1;
        }
      }

      try {
        const targetTitle = updateData.title !== undefined ? updateData.title : item.title;
        const targetType = updateData.type !== undefined ? updateData.type : item.type;
        const targetPlat = updateData.platformId !== undefined ? updateData.platformId : item.platformId;
        const targetPhase = updateData.phaseId !== undefined ? updateData.phaseId : item.phaseId;
        const targetSort = updateData.sortOrder !== undefined ? updateData.sortOrder : item.sortOrder;
        this.validateItem(targetTitle, targetType, targetPlat, targetPhase, targetSort);
      } catch (e) {
        alert(e.message);
        return;
      }

      Object.assign(item, fields);
      if (updateData.sortOrder !== undefined) item.sortOrder = updateData.sortOrder;
      this.emit("change", this._data);

      if (!this.db) return;
      showSaveStatus('saving');
      try {
        updateData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        updateData.updatedBy = this.currentUser.uid;
        await this.db.collection("projects").doc("neurotibb").collection("items").doc(id).update(updateData);
        await this.logAudit("update", "item", id, updateData);
        showSaveStatus('saved');
      } catch (err) {
        console.error("Firestore updateItem error:", err);
        showSaveStatus('failed', err.message);
      }
    }

    async updateItemPositions(itemsToUpdate) {
      if (this.userRole === 'viewer') {
        alert("Permission denied. Viewers cannot write.");
        return;
      }

      itemsToUpdate.forEach(updateInfo => {
        const item = this._data.items.find(i => i.id === updateInfo.id);
        if (item) {
          item.platformId = updateInfo.platformId;
          item.phaseId = updateInfo.phaseId;
          item.sortOrder = updateInfo.sortOrder;
        }
      });
      this.emit("change", this._data);

      if (!this.db) return;
      showSaveStatus('saving');
      
      try {
        const batch = this.db.batch();
        const projectRef = this.db.collection("projects").doc("neurotibb");
        const userId = this.currentUser ? this.currentUser.uid : "system";
        const userEmail = this.currentUser ? this.currentUser.email : "system@neurotibb.com";

        itemsToUpdate.forEach(updateInfo => {
          const docRef = projectRef.collection("items").doc(updateInfo.id);
          batch.update(docRef, {
            platformId: updateInfo.platformId,
            phaseId: updateInfo.phaseId,
            sortOrder: updateInfo.sortOrder,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: userId
          });
        });

        const logId = generateId();
        const logRef = projectRef.collection("auditLogs").doc(logId);
        batch.set(logRef, {
          action: "reorder",
          entityType: "item",
          entityId: itemsToUpdate.map(i => i.id).join(","),
          changedFields: { items: itemsToUpdate },
          userId: userId,
          userEmail: userEmail,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();
        showSaveStatus('saved');
      } catch (err) {
        console.error("Firestore updateItemPositions batch error:", err);
        showSaveStatus('failed', err.message);
        
        alert("Save failed. Restoring items to their original positions.");
      }
    }

    async deleteItem(id) {
      if (this.userRole === 'viewer') {
        alert("Permission denied. Viewers cannot write.");
        return;
      }

      const item = this._data.items.find(i => i.id === id);
      if (item) {
        item.isArchived = true;
        this.emit("change", this._data);

        if (!this.db) return;
        showSaveStatus('saving');
        try {
          const updateData = {
            isArchived: true,
            archivedAt: firebase.firestore.FieldValue.serverTimestamp(),
            archivedBy: this.currentUser.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: this.currentUser.uid
          };
          await this.db.collection("projects").doc("neurotibb").collection("items").doc(id).update(updateData);
          await this.logAudit("archive", "item", id, updateData);
          showSaveStatus('saved');
        } catch (err) {
          console.error("Firestore deleteItem error:", err);
          showSaveStatus('failed', err.message);
        }
      }
    }

    async migrateData() {
      if (!this.db) return;
      try {
        const migrationRef = this.db.collection("projects").doc("neurotibb").collection("settings").doc("migration");
        const migrationSnap = await migrationRef.get();
        if (migrationSnap.exists && migrationSnap.data().migrationCompleted) {
          return;
        }

        console.log("Starting data migration...");
        let projectsMigrated = 0;
        let platformsMigrated = 0;
        let phasesMigrated = 0;
        let itemsMigrated = 0;
        let duplicatesSkipped = 0;

        const oldProjectRef = this.db.collection("settings").doc("project");
        const oldProjectSnap = await oldProjectRef.get();
        let projectData = {
          name: "Neurotibb Product Roadmap",
          description: "Interactive phase-based roadmap for coordinating products, timelines, and feature releases.",
          documentOwner: "Neurotibb Product Team",
          version: "v1.2.0",
          status: "Active",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: "system",
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: "system"
        };
        if (oldProjectSnap.exists) {
          const oldData = oldProjectSnap.data();
          projectData.name = oldData.title || projectData.name;
          projectData.description = oldData.description || projectData.description;
          projectData.documentOwner = oldData.owner || projectData.documentOwner;
          projectData.version = oldData.version || projectData.version;
          projectData.status = oldData.status || projectData.status;
        }
        await this.db.collection("projects").doc("neurotibb").set(projectData, { merge: true });
        projectsMigrated++;

        const oldPlatformsSnap = await this.db.collection("platforms").get();
        const platformsBatch = this.db.batch();
        const migratedPlatformIds = new Set();
        
        oldPlatformsSnap.docs.forEach(doc => {
          const data = doc.data();
          if (migratedPlatformIds.has(doc.id)) {
            duplicatesSkipped++;
            return;
          }
          migratedPlatformIds.add(doc.id);
          const newRef = this.db.collection("projects").doc("neurotibb").collection("platforms").doc(doc.id);
          platformsBatch.set(newRef, {
            name: data.name || "",
            sortOrder: Number(data.sortOrder) || 1,
            isArchived: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: "system",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: "system"
          });
          platformsMigrated++;
        });
        if (platformsMigrated > 0) {
          await platformsBatch.commit();
        }

        const oldPhasesSnap = await this.db.collection("phases").get();
        const phasesBatch = this.db.batch();
        const migratedPhaseIds = new Set();

        oldPhasesSnap.docs.forEach(doc => {
          const data = doc.data();
          if (migratedPhaseIds.has(doc.id)) {
            duplicatesSkipped++;
            return;
          }
          migratedPhaseIds.add(doc.id);
          
          let startDate = "2025-07-01";
          let endDate = "2025-09-30";
          if (data.period) {
            const dates = parsePeriodToDates(data.period);
            startDate = dates.start;
            endDate = dates.end;
          }

          const newRef = this.db.collection("projects").doc("neurotibb").collection("phases").doc(doc.id);
          phasesBatch.set(newRef, {
            name: data.name || "",
            objective: data.objective || "",
            startDate: startDate,
            endDate: endDate,
            sortOrder: Number(data.sortOrder) || 1,
            status: data.status || "Active",
            isArchived: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: "system",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: "system"
          });
          phasesMigrated++;
        });
        if (phasesMigrated > 0) {
          await phasesBatch.commit();
        }

        const oldItemsSnap = await this.db.collection("items").get();
        const itemsBatch = this.db.batch();
        const migratedItemIds = new Set();

        oldItemsSnap.docs.forEach(doc => {
          const data = doc.data();
          if (migratedItemIds.has(doc.id)) {
            duplicatesSkipped++;
            return;
          }
          migratedItemIds.add(doc.id);

          const newRef = this.db.collection("projects").doc("neurotibb").collection("items").doc(doc.id);
          itemsBatch.set(newRef, {
            title: data.title || "",
            type: data.type || "page",
            platformId: data.platformId || "",
            phaseId: data.phaseId || "",
            sortOrder: Number(data.sortOrder) || 1,
            figmaEmbedUrl: data.figmaUrl || "",
            documentEmbedUrl: data.docUrl || "",
            isArchived: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: "system",
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: "system"
          });
          itemsMigrated++;
        });
        if (itemsMigrated > 0) {
          await itemsBatch.commit();
        }

        await migrationRef.set({ migrationCompleted: true, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        localStorage.removeItem("neurotibb_roadmap_local_cache");

        console.log("Migration completed.");
      } catch (err) {
        console.error("Migration failed: ", err);
      }
    }

    async checkAndSeedDatabase() {
      if (!this.db || this.userRole !== 'owner') return;
      try {
        const platformsSnap = await this.db.collection("projects").doc("neurotibb").collection("platforms").limit(1).get();
        const phasesSnap = await this.db.collection("projects").doc("neurotibb").collection("phases").limit(1).get();
        if (platformsSnap.empty && phasesSnap.empty) {
          console.log("Database is empty. Automatically seeding initial structure...");
          await this.seedInitialData();
        }
      } catch (err) {
        console.error("Check and seed failed:", err);
      }
    }

    async seedInitialData() {
      if (!this.db) return;
      showSaveStatus('saving');
      try {
        const batch = this.db.batch();
        const projectRef = this.db.collection("projects").doc("neurotibb");
        const userId = this.currentUser ? this.currentUser.uid : "system";

        // Seed Project Metadata
        batch.set(projectRef, {
          name: "Neurotibb Product Roadmap",
          description: "Interactive phase-based roadmap for coordinating products, timelines, and feature releases.",
          documentOwner: "Neurotibb Product Team",
          version: "v1.2.0",
          status: "Active",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdBy: userId,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: userId
        }, { merge: true });

        // Seed Platforms
        const initialPlatforms = [
          { id: "platform-website", name: "Website", sortOrder: 1 },
          { id: "platform-valideyn", name: "Valideyn paneli", sortOrder: 2 },
          { id: "platform-hekim", name: "Həkim paneli", sortOrder: 3 }
        ];
        initialPlatforms.forEach(p => {
          const ref = projectRef.collection("platforms").doc(p.id);
          batch.set(ref, {
            name: p.name,
            sortOrder: p.sortOrder,
            isArchived: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: userId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: userId
          });
        });

        // Seed Phases
        const initialPhases = [
          { id: "phase-mvp", name: "MVP", startDate: "2025-07-01", endDate: "2025-09-30", objective: "Minimum Viable Product release", sortOrder: 1, status: "Active", isArchived: false },
          { id: "phase-p2", name: "Phase 2", startDate: "2025-10-01", endDate: "2025-12-31", objective: "Core enhancements and scaling", sortOrder: 2, status: "Active", isArchived: false },
          { id: "phase-p3", name: "Phase 3", startDate: "2026-01-01", endDate: "2026-03-31", objective: "Advanced AI integration", sortOrder: 3, status: "Active", isArchived: false },
          { id: "phase-p4", name: "Phase 4", startDate: "2026-04-01", endDate: "2026-06-30", objective: "Full ecosystem features", sortOrder: 4, status: "Active", isArchived: false }
        ];
        initialPhases.forEach(ph => {
          const ref = projectRef.collection("phases").doc(ph.id);
          batch.set(ref, {
            name: ph.name,
            startDate: ph.startDate,
            endDate: ph.endDate,
            objective: ph.objective,
            sortOrder: ph.sortOrder,
            status: ph.status,
            isArchived: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: userId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: userId
          });
        });

        await batch.commit();
        showSaveStatus('saved');
        console.log("Database successfully seeded with default roadmap structure.");
      } catch (err) {
        console.error("Error seeding default roadmap structure:", err);
        showSaveStatus('failed', err.message);
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
    const isCollapsed = localStorage.getItem('neurotibb_sidebar_collapsed') === 'true';
    if (isCollapsed) sidebar.classList.add('collapsed');

    sidebarToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      localStorage.setItem('neurotibb_sidebar_collapsed', sidebar.classList.contains('collapsed'));
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
      if (document.activeElement !== titleEl) titleEl.textContent = meta.title || "Neurotibb Product Roadmap";
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
          <div class="phase-period" data-phase-id="${phase.id}" contenteditable="true" spellcheck="false" title="Click to edit period">${escapeHTML(phase.period || '')}</div>
          <div class="phase-objective" data-phase-id="${phase.id}" contenteditable="true" spellcheck="false">${escapeHTML(phase.objective || '')}</div>
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
    console.log("Neurotibb Product Roadmap app initialization starting...");

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

     // Auth Form Submit
     const authForm = document.getElementById("authForm");
     if (authForm) {
       authForm.addEventListener("submit", async (e) => {
         e.preventDefault();
         const email = document.getElementById("authEmail").value.trim();
         const password = document.getElementById("authPassword").value;
         showAuthOverlay(true);
         setAuthLoading(true, "Signing In...");
         try {
           await store.signInWithEmail(email, password);
         } finally {
           setAuthLoading(false);
         }
       });
     }
 
     // Google Sign-In Click
     const btnGoogleSignIn = document.getElementById("btnGoogleSignIn");
     if (btnGoogleSignIn) {
       btnGoogleSignIn.addEventListener("click", async () => {
         showAuthOverlay(true);
         setAuthLoading(true, "Redirecting...");
         try {
           await store.signInWithGoogle();
         } finally {
           setAuthLoading(false);
         }
       });
     }
 
     // Email Sign-Up Click
     const btnEmailSignUp = document.getElementById("btnEmailSignUp");
     if (btnEmailSignUp) {
       btnEmailSignUp.addEventListener("click", async () => {
         const email = document.getElementById("authEmail").value.trim();
         const password = document.getElementById("authPassword").value;
         if (!email || !password) {
           showAuthOverlay(true, "Please fill in email and password to register.");
           return;
         }
         showAuthOverlay(true);
         setAuthLoading(true, "Registering...");
         try {
           await store.signUpWithEmail(email, password);
         } finally {
           setAuthLoading(false);
         }
       });
     }

    // Sign Out Click
    const btnSignOut = document.getElementById("btnSignOut");
    if (btnSignOut) {
      btnSignOut.addEventListener("click", async () => {
        await store.signOut();
      });
    }

    // Retry Database Connection Click
    const btnRetryDbConnection = document.getElementById("btnRetryDbConnection");
    if (btnRetryDbConnection) {
      btnRetryDbConnection.addEventListener("click", async () => {
        showDbError(false);
        await store.init();
      });
    }

    store.on("change", () => {
      renderRoadmap();
    });

    // Initialize Store
    await store.init();
  });

})();
