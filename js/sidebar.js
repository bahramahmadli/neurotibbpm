const sidebar = document.getElementById('appSidebar');
const toggleBtn = document.getElementById('sidebarToggle');

export function initSidebar() {
  if (!sidebar || !toggleBtn) return;

  // Restore state from localStorage
  const isCollapsed = localStorage.getItem('aana_sidebar_collapsed') === 'true';
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
  }

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const nowCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('aana_sidebar_collapsed', nowCollapsed);
    
    // Trigger window resize event to redraw or update any widths if necessary
    window.dispatchEvent(new Event('resize'));
  });
}
