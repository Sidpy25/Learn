// Browser smoke test: menu, local party match, screenshots. Needs a running server.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:8080/';
const OUT = process.env.OUT || '.';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(BASE);
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/menu.png` });
await page.click('[data-go=local]');
await page.screenshot({ path: `${OUT}/local-setup.png` });
await page.click('#startLocal');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/countdown.png` });
await page.keyboard.down('KeyA');
await page.waitForTimeout(700);
await page.keyboard.up('KeyA');
await page.waitForTimeout(7000);
await page.screenshot({ path: `${OUT}/gameplay.png` });
const st = await page.evaluate(() => ({ mode: window.__neon.mode, st: window.__neon.view.st, rd: window.__neon.view.rd }));
console.log('state', JSON.stringify(st));
if (errors.length) { console.error('ERRORS', errors); process.exitCode = 1; }
await browser.close();
