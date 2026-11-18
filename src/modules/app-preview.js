const { t } = require('./i18n');
const preview = document.querySelector('[data-app-preview]');
if (preview) {
  const connect = preview.querySelector('[data-connect]');
  const render = () => {
    const connected = connect.getAttribute('aria-pressed') === 'true';
    const bindings = [
      [connect, connected ? 'app.disconnect' : 'app.connect'],
      [preview.querySelector('[data-connection-status]'), connected ? 'app.connectedStatus' : 'app.status'],
      [preview.querySelector('[data-connection-heading]'), connected ? 'app.connectedHeading' : 'app.heading'],
      [preview.querySelector('[data-connection-note]'), connected ? 'app.connectedNote' : 'app.note']
    ];
    bindings.forEach(([element, key]) => {
      element.dataset.i18n = key;
      element.textContent = t(key);
    });
  };
  connect.addEventListener('click', () => {
    connect.setAttribute('aria-pressed', String(connect.getAttribute('aria-pressed') !== 'true'));
    render();
  });
  document.addEventListener('languagechange', render);
  render();
  preview.querySelectorAll('[data-demo-info]').forEach((button) => button.addEventListener('click', () => {
    preview.querySelector('[data-demo-notice]').hidden = false;
  }));
}
