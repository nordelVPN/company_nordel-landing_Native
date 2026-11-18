const dictionaries = require('../data/locales.json');
const fallback = 'en';
const storageKey = 'nordel-language';
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
let language = fallback;

function t(key) {
  if (owns(dictionaries[language], key)) return dictionaries[language][key];
  return owns(dictionaries[fallback], key) ? dictionaries[fallback][key] : null;
}

function translate(root = document) {
  const attributes = ['aria-label', 'placeholder', 'title', 'content'];
  const selector = ['[data-i18n]', ...attributes.map((name) => '[data-i18n-' + name + ']')].join(',');
  const elements = [...root.querySelectorAll(selector)];
  if (root.matches && root.matches(selector)) elements.unshift(root);
  elements.forEach((element) => {
    if (element.hasAttribute('data-i18n')) {
      const value = t(element.dataset.i18n);
      if (value !== null) element.textContent = value;
    }
    attributes.forEach((attribute) => {
      const key = element.getAttribute('data-i18n-' + attribute);
      if (key) {
        const value = t(key);
        if (value !== null) element.setAttribute(attribute, value);
      }
    });
  });
}

function setLanguage(value) {
  language = owns(dictionaries, value) ? value : fallback;
  document.documentElement.lang = language;
  translate();
  document.querySelectorAll('[data-language-select]').forEach((select) => { select.value = language; });
  try { localStorage.setItem(storageKey, language); } catch { /* Storage may be unavailable. */ }
  document.dispatchEvent(new window.CustomEvent('languagechange', { detail: { language } }));
}

document.querySelectorAll('[data-language-select]').forEach((select) => {
  select.replaceChildren();
  Object.keys(dictionaries).forEach((code) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = dictionaries[code]['language.name'] || code.toUpperCase();
    select.appendChild(option);
  });
  select.addEventListener('change', () => setLanguage(select.value));
});
let saved = fallback;
try { saved = localStorage.getItem(storageKey) || fallback; } catch { /* Use English. */ }
setLanguage(saved);

module.exports = { t, translate, setLanguage };
