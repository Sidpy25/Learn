// Renders the app icon, Android launcher icons, splash screens and the
// Google Play store graphics from client/icons/icon.svg.
// Usage: npm run icons   (needs Playwright + Chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconDir = path.join(root, 'client/icons');
const res = path.join(root, 'android/app/src/main/res');
const store = path.join(root, 'store');
const svg = fs.readFileSync(path.join(iconDir, 'icon.svg'), 'utf8');
const fontCss = fs.readFileSync(path.join(root, 'client/fonts/orbitron.css'), 'utf8').replace(/url\((.*?)\)/g, (_, f) => {
  const data = fs.readFileSync(path.join(root, 'client/fonts', f)).toString('base64');
  return `url(data:font/woff2;base64,${data})`;
});
// The icon art without its background, for adaptive icon foregrounds.
const artOnly = svg.replace(/<rect[^>]*fill="url\(#bg\)"\/>/, '');

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(file, w, h, body, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<style>${fontCss}html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${transparent ? 'transparent' : '#07051a'}}svg{display:block}</style>${body}`);
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, omitBackground: transparent });
  console.log(path.relative(root, file));
}

const sized = (s, w, h = w) => s.replace('<svg ', `<svg width="${w}" height="${h}" `);

for (const size of [192, 512]) await render(path.join(iconDir, `icon-${size}.png`), size, size, sized(svg, size));

function splash(w, h) {
  const m = Math.min(w, h);
  return `<div style="width:${w}px;height:${h}px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${m * 0.04}px;
    background:radial-gradient(ellipse at center,#1d0f4a 0%,#07051a 60%,#020109 100%);font-family:Orbitron;font-weight:900;color:#fff">
    ${sized(artOnly, m * 0.4)}
    <div style="font-size:${m * 0.1}px;letter-spacing:.08em;text-shadow:0 0 ${m * 0.01}px #fff,0 0 ${m * 0.04}px #ff2bd6,0 0 ${m * 0.08}px #ff2bd6">NEON TRAILS</div>
  </div>`;
}

if (fs.existsSync(res)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    const s = Math.round(48 * k);
    const fg = Math.round(108 * k);
    await render(`${res}/mipmap-${d}/ic_launcher.png`, s, s, sized(svg, s));
    await render(`${res}/mipmap-${d}/ic_launcher_round.png`, s, s, `<div style="width:${s}px;height:${s}px;border-radius:50%;overflow:hidden">${sized(svg, s)}</div>`, true);
    // Adaptive icons crop to the centre 66%, so shrink the art into the safe zone.
    await render(`${res}/mipmap-${d}/ic_launcher_foreground.png`, fg, fg, `<div style="width:${fg}px;height:${fg}px;display:grid;place-items:center">${sized(artOnly, fg * 0.72)}</div>`, true);
  }
  const splashes = {
    'drawable/splash.png': [480, 320],
    'drawable-land-mdpi/splash.png': [480, 320], 'drawable-land-hdpi/splash.png': [800, 480],
    'drawable-land-xhdpi/splash.png': [1280, 720], 'drawable-land-xxhdpi/splash.png': [1600, 960],
    'drawable-land-xxxhdpi/splash.png': [1920, 1280],
    'drawable-port-mdpi/splash.png': [320, 480], 'drawable-port-hdpi/splash.png': [480, 800],
    'drawable-port-xhdpi/splash.png': [720, 1280], 'drawable-port-xxhdpi/splash.png': [960, 1600],
    'drawable-port-xxxhdpi/splash.png': [1280, 1920],
  };
  for (const [f, [w, h]] of Object.entries(splashes)) await render(`${res}/${f}`, w, h, splash(w, h));
}

// Google Play listing assets.
await render(`${store}/play-icon-512.png`, 512, 512, sized(svg, 512));
await render(`${store}/feature-graphic-1024x500.png`, 1024, 500, splash(1024, 500));

await browser.close();
