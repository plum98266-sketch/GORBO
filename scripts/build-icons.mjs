// 아이콘(PNG)과 링크 미리보기 이미지(og.png)를 만든다. 디자인을 바꿀 때만 다시 실행하면 된다.
// 사용법: node scripts/build-icons.mjs   (Playwright + Chromium 필요)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = createRequire('/opt/node-tools/node_modules/')('playwright'));
}

const heart = readFileSync('app/icon.svg', 'utf8')
  .replace(/<rect[^>]*\/>/, '') // 배경은 각 이미지에서 따로 그린다
  .replace('viewBox="0 0 512 512"', 'viewBox="72 92 368 336"') // 하트 부분만 잘라 크게 쓴다
  .replace('<svg ', '<svg width="100%" height="100%" ');
const BRAND = '#e8505b';
const FONT = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;800&display=swap';

// size: 출력 크기, pad: 하트 주변 여백 비율(maskable은 안전 영역 80% 안에 들어가야 함), radius: 모서리
const icons = [
  { file: 'app/icons/apple-touch-icon.png', size: 180, pad: 0.2, radius: 0 }, // iOS가 직접 둥글린다
  { file: 'app/icons/icon-192.png', size: 192, pad: 0.2, radius: 0.22 },
  { file: 'app/icons/icon-512.png', size: 512, pad: 0.2, radius: 0.22 },
  { file: 'app/icons/icon-maskable-512.png', size: 512, pad: 0.28, radius: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const i of icons) {
  await page.setViewportSize({ width: i.size, height: i.size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>
    <div style="width:${i.size}px;height:${i.size}px;background:${BRAND};border-radius:${i.radius * 100}%;
      box-sizing:border-box;padding:${i.pad * i.size}px">${heart}</div>`);
  await page.screenshot({ path: i.file, omitBackground: true });
  console.log('wrote', i.file);
}

await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<link rel="stylesheet" href="${FONT}">
<style>
  html,body{margin:0}
  body{width:1200px;height:630px;background:#fbf7f4;font-family:'Noto Sans KR',sans-serif;color:#2b2420;
    display:grid;grid-template-columns:420px 1fr;align-items:center;overflow:hidden}
  .art{height:630px;background:${BRAND};display:grid;place-items:center}
  .art div{width:260px;height:240px}
  .txt{padding:0 64px}
  h1{font-size:84px;font-weight:800;margin:0 0 18px;letter-spacing:-2px}
  p{font-size:34px;font-weight:500;line-height:1.45;margin:0 0 28px}
  ul{list-style:none;padding:0;margin:0;font-size:26px;font-weight:500;color:#7a6e68;display:grid;gap:8px}
  li::before{content:'';display:inline-block;width:12px;height:12px;border-radius:50%;background:${BRAND};margin-right:14px;vertical-align:middle}
</style>
<div class="art"><div>${heart}</div></div>
<div class="txt">
  <h1>심장지킴이</h1>
  <p>심장병 아이 수면 호흡수,<br>톡톡 눌러 바로 기록하세요</p>
  <ul><li>분당 호흡수 자동 계산 · 경고 알림</li><li>심장약 투약 체크 · 증상 기록</li><li>수의사에게 보여줄 진료 리포트</li></ul>
</div>`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'app/og.png' });
console.log('wrote app/og.png');
await browser.close();
