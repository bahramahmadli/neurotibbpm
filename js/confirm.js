const overlay = document.getElementById('confirmOverlay');
const titleEl = document.getElementById('confirmTitle');
const messageEl = document.getElementById('confirmMessage');
const cancelBtn = document.getElementById('btnCancelConfirm');
const proceedBtn = document.getElementById('btnProceedConfirm');

let currentResolve = null;

function cleanup() {
  overlay.classList.remove('active');
  cancelBtn.removeEventListener('click', onCancel);
  proceedBtn.removeEventListener('click', onProceed);
  overlay.removeEventListener('click', onOverlayClick);
  document.removeEventListener('keydown', onKeyDown);
}

function onCancel() {
  cleanup();
  if (currentResolve) currentResolve(false);
}

function onProceed() {
  cleanup();
  if (currentResolve) currentResolve(true);
}

function onOverlayClick(e) {
  if (e.target === overlay) {
    onCancel();
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    onCancel();
  } else if (e.key === 'Enter') {
    onProceed();
  }
}

/**
 * Ask user for confirmation using a beautiful custom modal
 * @param {string} title 
 * @param {string} message 
 * @param {string} buttonText 
 * @param {boolean} isDanger 
 * @returns {Promise<boolean>} Resolves to true if confirmed, false otherwise
 */
export function confirmAction(title, message, buttonText = 'Delete', isDanger = true) {
  titleEl.textContent = title;
  messageEl.textContent = message;
  proceedBtn.textContent = buttonText;
  
  // Style proceed button
  if (isDanger) {
    proceedBtn.className = 'btn btn-danger';
  } else {
    proceedBtn.className = 'btn btn-primary';
  }

  overlay.classList.add('active');

  cancelBtn.addEventListener('click', onCancel);
  proceedBtn.addEventListener('click', onProceed);
  overlay.addEventListener('click', onOverlayClick);
  document.addEventListener('keydown', onKeyDown);

  return new Promise((resolve) => {
    currentResolve = resolve;
  });
}
