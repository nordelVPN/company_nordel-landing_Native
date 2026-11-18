const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium, firefox, webkit } = require('playwright');
const { PNG } = require('pngjs');

const engineName = process.argv[2] || 'chromium';
const engine = { chromium, firefox, webkit }[engineName];
if (!engine) throw new Error('Expected chromium, firefox or webkit');
const root = path.resolve(__dirname, '..');
const build = path.join(root, 'build/prod');
const output = path.join(root, 'docs/frontend/qa/front-001', engineName);
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  const file = path.resolve(build, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(build + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, body) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
    res.end(error ? 'Not found' : body);
  });
});
const report = { engine: engineName, checks: [], comparisons: [], errors: [] };

function comparison(actualPath, referencePath, name) {
  const actual = PNG.sync.read(fs.readFileSync(actualPath));
  const reference = PNG.sync.read(fs.readFileSync(referencePath));
  assert.equal(actual.width, reference.width);
  assert.equal(actual.height, reference.height);
  const overlay = new PNG({ width: actual.width, height: actual.height });
  const difference = new PNG({ width: actual.width, height: actual.height });
  let sum = 0;
  for (let i = 0; i < actual.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const delta = Math.abs(actual.data[i + c] - reference.data[i + c]);
      sum += delta;
      overlay.data[i + c] = Math.round((actual.data[i + c] + reference.data[i + c]) / 2);
      difference.data[i + c] = delta;
    }
    overlay.data[i + 3] = difference.data[i + 3] = 255;
  }
  fs.writeFileSync(path.join(output, name + '-overlay.png'), PNG.sync.write(overlay));
  fs.writeFileSync(path.join(output, name + '-difference.png'), PNG.sync.write(difference));
  return { name, width: actual.width, height: actual.height, meanChannelDifference: sum / (actual.width * actual.height * 3), note: 'Diagnostic only: no visual acceptance threshold.' };
}

(async () => {
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + server.address().port;
    browser = await engine.launch({ headless: true, ...(engineName === 'chromium' && process.argv[3] ? { channel: process.argv[3] } : {}) });
    report.version = browser.version();
    for (const theme of ['light', 'dark']) {
      for (const width of [375, 768, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', deviceScaleFactor: 1 });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('response', (response) => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
        page.on('requestfailed', (request) => errors.push(request.url() + ' ' + request.failure()?.errorText));
        await page.goto(url, { waitUntil: 'networkidle' });
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        const measurements = await page.evaluate(() => ({
          width: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          reducedMotion: getComputedStyle(document.documentElement).scrollBehavior,
          outside: [...document.querySelectorAll('main h1, main h2, main h3, main p, main button, main a')].filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1);
          }).map((el) => el.textContent.trim())
        }));
        assert(measurements.scrollWidth <= measurements.width + 1, 'Horizontal overflow');
        assert.deepEqual(measurements.outside, [], 'Content outside viewport');
        assert.equal(measurements.reducedMotion, 'auto');
        assert.equal(await page.locator('h1').count(), 1);
        await page.screenshot({ path: path.join(output, theme + '-' + width + '.png'), fullPage: true });
        if (width <= 900) {
          const menu = page.locator('[data-menu-toggle]');
          await menu.focus();
          await page.keyboard.press('Enter');
          assert.equal(await menu.getAttribute('aria-expanded'), 'true');
          assert(await page.locator('#main-nav').isVisible());
          await page.keyboard.press('Escape');
          assert.equal(await menu.getAttribute('aria-expanded'), 'false');
          assert(await menu.evaluate((el) => el === document.activeElement));
        }
        const connect = page.locator('[data-connect]');
        await connect.focus();
        await page.keyboard.press('Enter');
        assert.equal(await connect.getAttribute('aria-pressed'), 'true');
        assert.match(await page.locator('[data-connection-note]').textContent(), /Demo only/);
        await connect.click();
        assert.equal(await connect.getAttribute('aria-pressed'), 'false');
        await page.locator('[data-demo-info]').first().click();
        assert(await page.locator('[data-demo-notice]').isVisible());
        const cta = page.locator('[data-wishlist-open]').first();
        await cta.focus();
        await page.keyboard.press('Enter');
        assert(await page.locator('dialog').evaluate((el) => el.open));
        assert(await page.locator('dialog button:disabled').isVisible());
        for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
        assert(await page.locator('dialog').evaluate((el) => el.contains(document.activeElement)));
        await page.keyboard.press('Escape');
        assert(await cta.evaluate((el) => el === document.activeElement));
        const opposite = theme === 'dark' ? 'light' : 'dark';
        await page.emulateMedia({ colorScheme: opposite });
        await page.waitForFunction((theme) => document.documentElement.dataset.theme === theme, opposite);
        assert.equal(await page.locator('html').getAttribute('data-theme'), opposite);
        await page.locator('[data-theme-toggle]').click();
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
        const focus = await page.locator('[data-theme-toggle]').evaluate((el) => { el.focus(); return getComputedStyle(el).outlineStyle; });
        report.checks.push({ theme, width, measurements, interactionChecks: 'passed', focusOutlineObserved: focus, errors });
        assert.deepEqual(errors, []);
        await context.close();
      }
    }
    if (engineName === 'chromium') {
      for (const theme of ['light', 'dark']) {
        for (const screen of [1, 2, 3]) {
          const reference = path.join(root, 'src/assets/images/concept', theme === 'dark' ? 'dark_theme/screen_' + screen + '_dark_theme.png' : 'screen_' + screen + '.png');
          const { width, height } = PNG.sync.read(fs.readFileSync(reference));
          const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion: 'reduce', deviceScaleFactor: 1 });
          const page = await context.newPage();
          await page.goto(url, { waitUntil: 'networkidle' });
          await page.evaluate((screen) => {
            const keep = screen === 1 ? ['why-nordel'] : screen === 2 ? ['app'] : ['pricing'];
            for (const child of document.querySelector('main').children) {
              if (!keep.includes(child.id) && !(screen === 1 && child.classList.contains('features'))) child.style.display = 'none';
            }
          }, screen);
          await page.evaluate(() => { window.scrollTo(0, 0); });
          await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const name = theme + '-screen-' + screen;
          const actual = path.join(output, name + '.png');
          await page.screenshot({ path: actual });

          report.comparisons.push(comparison(actual, reference, name));
          await context.close();
        }
      }
    }
  } catch (error) {
    report.errors.push(error.stack);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
