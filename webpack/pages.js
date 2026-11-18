module.exports = {
  index: {
    template: './pages/index.hbs',
    data: './src/data/index.js',
    modules: ['i18n', 'theme-toggle', 'navigation', 'app-preview', 'wishlist'],
    styles: ['base', 'pages/index']
  },
  about: {
    template: './pages/about.hbs',
    data: './src/data/about.js',
    modules: ['i18n', 'theme-toggle', 'navigation', 'wishlist'],
    styles: ['base', 'pages/about']
  }
};
