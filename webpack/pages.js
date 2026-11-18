module.exports = {
  index: {
    template: './pages/index.hbs',
    data: './src/data/index.js',
    modules: ['theme-toggle', 'navigation', 'app-preview', 'wishlist'],
    styles: ['base', 'pages/index']
  },
  about: {
    template: './pages/about.hbs',
    data: './src/data/about.js',
    modules: ['theme-toggle', 'navigation', 'wishlist'],
    styles: ['base', 'pages/about']
  }
};
