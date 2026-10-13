/* Runs before the stylesheet so a saved theme is applied before the first paint. */
(() => {
  'use strict';

  const storageKey = 'jb-theme';
  const root = document.documentElement;
  const icons = {
    light: '<circle cx="12" cy="12" r="3.75"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    dark: '<path d="M20.3 14.25A8.5 8.5 0 0 1 9.75 3.7a8.5 8.5 0 1 0 10.55 10.55Z"/>'
  };
  let theme = 'dark';

  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') theme = saved;
  } catch (_) {
    // The toggle remains usable when browser privacy settings block storage.
  }

  function applyTheme(nextTheme) {
    theme = nextTheme === 'light' ? 'light' : 'dark';
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = theme === 'light' ? '#f6f5f1' : '#0c141f';

    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const targetTheme = theme === 'dark' ? 'light' : 'dark';
      const label = `${targetTheme === 'light' ? 'Light' : 'Dark'} mode`;
      const labelElement = button.querySelector('[data-theme-label]');
      const icon = button.querySelector('[data-theme-icon]');
      button.setAttribute('aria-label', `Switch to ${targetTheme} mode`);
      if (labelElement) labelElement.textContent = label;
      if (icon) icon.innerHTML = icons[targetTheme];
    });
  }

  applyTheme(theme);

  function initializeToggle() {
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        applyTheme(theme === 'dark' ? 'light' : 'dark');
        try {
          window.localStorage.setItem(storageKey, theme);
        } catch (_) {
          // Changing the current page's theme does not depend on persistence.
        }
      });
      button.hidden = false;
    });
    applyTheme(theme);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeToggle, { once: true });
  } else {
    initializeToggle();
  }

  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) {
      applyTheme(event.newValue);
    }
  });
})();
