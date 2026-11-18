const root = document.documentElement;
const button = document.querySelector('[data-theme-toggle]');
const system = window.matchMedia('(prefers-color-scheme: dark)');
let selected;
try { selected = localStorage.getItem('nordel-theme'); } catch { /* Storage may be unavailable. */ }
if (!['light', 'dark'].includes(selected)) selected = null;

function applyTheme(theme) {
  root.dataset.theme = theme;
  if (button) button.setAttribute('aria-pressed', String(theme === 'dark'));
}
applyTheme(selected || (system.matches ? 'dark' : 'light'));
button?.addEventListener('click', () => {
  selected = root.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(selected);
  try { localStorage.setItem('nordel-theme', selected); } catch { /* Keep the session choice. */ }
});
system.addEventListener('change', () => {
  if (!selected) applyTheme(system.matches ? 'dark' : 'light');
});
window.addEventListener('storage', (event) => {
  if (event.key !== 'nordel-theme' && event.key !== null) return;
  selected = ['light', 'dark'].includes(event.newValue) ? event.newValue : null;
  applyTheme(selected || (system.matches ? 'dark' : 'light'));
});
