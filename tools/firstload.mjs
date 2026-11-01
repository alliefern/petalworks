// Measures what the first visit downloads before New Game is clickable, at a throttled
// link, and screenshots the title mid-load. Usage: node tools/firstload.mjs [baseUrl]
import { chromium } from 'playwright';
const base = process.argv[2] ?? 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
// Slow 4G: 1.6 Mbps down, 750 Kbps up, 150 ms latency.
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6e6) / 8, uploadThroughput: 750e3 / 8 });
let bytes = 0;
const files = new Map();
cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
cdp.on('Network.responseReceived', (e) => files.set(e.response.url, e.response.mimeType));
const t0 = Date.now();
await page.goto(base);
await page.waitForSelector('[data-testid="loading"]', { timeout: 20000 }).catch(() => null);
await page.waitForTimeout(1500);
await page.screenshot({ path: 'producer/shots/13-title-loading.png' });
await page.waitForFunction(() => !document.querySelector('[data-testid="new-game"]')?.hasAttribute('disabled'), null, { timeout: 120000 });
const ready = (Date.now() - t0) / 1000;
await page.waitForTimeout(500);
const byType = {};
for (const [u, t] of files) byType[t] = (byType[t] ?? 0) + 1;
console.log(JSON.stringify({ newGameReadySeconds: +ready.toFixed(1), bytesBeforeReady: bytes, requests: files.size, byType }));
await browser.close();
