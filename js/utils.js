/**
 * Generate a unique ID (RFC4122 v4 compliant UUID approximation)
 * @returns {string}
 */
export function generateId() {
  return 'id-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
}

/**
 * Format timestamp to a human-readable date string
 * @param {string|number|Date} dateVal 
 * @returns {string}
 */
export function formatDate(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Validates a period string. If it's a 3-month span, e.g., "Jul 2025 – Sep 2025", return parsed details.
 * If not valid, returns null.
 * @param {string} periodStr 
 * @returns {boolean}
 */
export function isValidThreeMonthPeriod(periodStr) {
  if (!periodStr) return false;
  // Simple check for start/end date separated by a dash or en-dash.
  // Format: "Month Year - Month Year" or similar
  const parts = periodStr.split(/[–-]/).map(p => p.trim());
  if (parts.length !== 2) return false;
  
  const start = new Date(parts[0]);
  const end = new Date(parts[1]);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  
  // Calculate months difference
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  const totalMonths = yearDiff * 12 + monthDiff + 1; // inclusive of end month
  
  return totalMonths === 3;
}

/**
 * Sanitize HTML to prevent XSS (minimal version for text display)
 * @param {string} str 
 * @returns {string}
 */
export function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Simple debounce function to limit execution rate of an action (e.g. search)
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
export function debounce(func, wait) {
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
