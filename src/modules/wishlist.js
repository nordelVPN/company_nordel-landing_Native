function initWishlist() {
  const dialog = document.querySelector('dialog[data-wishlist]');
  if (!dialog) return;

  let opener;
  document.querySelectorAll('[data-wishlist-open]').forEach((button) => {
    button.addEventListener('click', () => {
      opener = button;
      if (!dialog.open) dialog.showModal();
    });
  });

  dialog.querySelectorAll('[data-wishlist-close]').forEach((button) => {
    button.addEventListener('click', () => dialog.close());
  });

  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) {
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => opener?.focus());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWishlist, { once: true });
} else {
  initWishlist();
}
