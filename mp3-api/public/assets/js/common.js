let themeReady = false;
let currentTheme = 'dark';

function applyTheme(mode) {
  currentTheme = mode === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('mcp_theme', currentTheme);
  const toggleBtn = document.getElementById('themeToggle');
  if (toggleBtn) {
    toggleBtn.textContent = currentTheme === 'dark' ? 'Light mode' : 'Dark mode';
  }
}

function initTheme() {
  if (themeReady) return;
  themeReady = true;
  const stored = localStorage.getItem('mcp_theme');
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const fallback = prefersDark ? 'dark' : 'light';
  applyTheme(stored || fallback);
  const toggleBtn = document.getElementById('themeToggle');
  toggleBtn?.addEventListener('click', () => {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });
}

export function initShell({ currentPage }) {
  initTheme();
  const navLinks = document.querySelectorAll('.nav-links a[data-nav], .sidebar a[data-nav]');
  navLinks.forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === currentPage);
  });
}

export async function fetchJson(path, params) {
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });
  }
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}
