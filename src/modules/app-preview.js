const preview = document.querySelector('[data-app-preview]');
if (preview) {
  const connect = preview.querySelector('[data-connect]');
  connect.addEventListener('click', () => {
    const connected = connect.getAttribute('aria-pressed') !== 'true';
    const state = connected ? 'On' : 'Off';
    connect.setAttribute('aria-pressed', String(connected));
    connect.textContent = connect.dataset[connected ? 'on' : 'off'];
    preview.querySelector('[data-connection-status]').textContent = connect.dataset['status' + state];
    preview.querySelector('[data-connection-heading]').textContent = connect.dataset['heading' + state];
    preview.querySelector('[data-connection-note]').textContent = connect.dataset['note' + state];
  });
  preview.querySelectorAll('[data-demo-info]').forEach((button) => button.addEventListener('click', () => {
    preview.querySelector('[data-demo-notice]').hidden = false;
  }));
}
