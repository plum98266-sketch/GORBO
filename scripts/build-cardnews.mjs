// 인스타그램 카드뉴스(1080x1350 PNG)를 만든다. 실제 앱 화면을 샘플 데이터로 캡처해 카드에 넣는다.
// 사용법: node scripts/build-cardnews.mjs   (Playwright + Chromium 필요) → docs/cardnews/
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = createRequire('/opt/node-tools/node_modules/')('playwright'));
}

// ---------- 1. 앱을 로컬에서 띄운다 ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = readFileSync(join('app', path.endsWith('/') ? `${path}index.html` : path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'text/html; charset=utf-8' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const APP = `http://localhost:${server.address().port}/`;

// ---------- 2. 샘플 데이터 (가상의 아이 '콩이') ----------
const DAY = 864e5;
const now = new Date();
now.setHours(22, 30, 0, 0);
const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function sample() {
  const pid = 'kong';
  const bpms = [19, 21, 20, 22, 18, 20, 23, 21, 19, 22, 20, 21, 24, 22, 20, 19, 21, 23, 22, 21, 20, 24, 25, 23, 26, 25, 27, 28, 31, 26];
  const records = bpms.map((bpm, i) => ({
    id: `r${i}`, petId: pid, at: now.getTime() - (bpms.length - 1 - i) * DAY - (i % 3) * 36e5,
    bpm, taps: bpm / 2, seconds: 30, state: 'sleep', note: '',
  }));
  const meds = [
    { id: 'm1', petId: pid, createdAt: now.getTime() - 40 * DAY, name: '피모벤단', dose: '1.25mg', times: ['08:00', '20:00'] },
    { id: 'm2', petId: pid, createdAt: now.getTime() - 40 * DAY, name: '이뇨제', dose: '반 알', times: ['08:00'] },
  ];
  const taken = { [pid]: {} };
  for (let i = 0; i < 30; i++) {
    const k = dayKey(now.getTime() - i * DAY);
    taken[pid][k] = { 'm1@08:00': 1, 'm2@08:00': 1 };
    if (i % 9 !== 4) taken[pid][k]['m1@20:00'] = 1;
  }
  const symptoms = [
    { id: 's1', petId: pid, at: now.getTime() - 2 * DAY, tags: ['cough'], note: '새벽에 마른기침 3번' },
    { id: 's2', petId: pid, at: now.getTime() - 9 * DAY, tags: ['cough'], note: '' },
  ];
  return {
    version: 1, pets: [{ id: pid, name: '콩이', species: 'dog', diagnosis: '이첨판 폐쇄부전 B2', threshold: 30, createdAt: now.getTime() - 40 * DAY }],
    records, meds, taken, symptoms, activePetId: pid,
    activeDays: Array.from({ length: 30 }, (_, i) => dayKey(now.getTime() - (29 - i) * DAY)), reportViews: 1, installHintHidden: true,
  };
}

const browser = await chromium.launch();

async function shoot(tab, { taps = 0, freeze = true, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height }, deviceScaleFactor: 3, serviceWorkers: 'block', colorScheme: 'light' });
  await ctx.addInitScript(([data, fixed]) => {
    localStorage.setItem('simjang-jikimi:v1', JSON.stringify(data));
    if (!fixed) return;
    const RealDate = Date;
    // 화면 속 날짜가 샘플과 맞도록 '지금'을 고정한다.
    globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
  }, [sample(), freeze ? now.getTime() : 0]);
  const page = await ctx.newPage();
  await page.goto(APP, { waitUntil: 'networkidle' });
  if (tab !== 'home') await page.click(`button[data-tab="${tab}"]`);
  for (let i = 0; i < taps; i++) { await page.click('#tap'); await page.waitForTimeout(450); }
  await page.waitForTimeout(300);
  const buf = await page.screenshot();
  await ctx.close();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const shots = {
  home: await shoot('home'),
  measure: await shoot('measure', { taps: 9, freeze: false }),
  meds: await shoot('meds'),
  report: await shoot('report'),
};


// ---------- 3. 카드 디자인 ----------
const BRAND = '#e8505b';
const FONT = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap';
const TOTAL = 9;

const phone = (src, { h = 900, w = 430, top = 0 } = {}) => `
  <div class="phone" style="width:${w}px;height:${h}px">
    <img src="${src}" style="width:100%;margin-top:${-top}px">
  </div>`;

const slides = [
  // 1. 표지
  { cls: 'cover', html: `
    <div class="kicker">심장병 아이 보호자라면</div>
    <h1>잠든 아이의<br>1분 호흡수,<br>세고 계신가요?</h1>
    <p class="lead">숫자 하나로 변화를<br>먼저 알아채는 방법</p>
    <div class="big30">30</div>
    <div class="swipe">밀어서 보기 →</div>` },

  // 2. 왜 중요한가
  { html: `
    <div class="tag">왜 세야 할까요?</div>
    <h2>기침보다 먼저,<br><em>숨이 빨라질 수</em> 있어요</h2>
    <p>심장병이 나빠지면 폐에 물이 차는<br><b>폐부종</b>이 생길 수 있어요.</p>
    <p>이때 기침이나 호흡곤란이 눈에 띄기 전에 <b>잠잘 때 숨이 조금씩 빨라지는</b> 경우가 있어요.</p>
    <div class="note">그래서 많은 수의사가 집에서<br><b>‘수면 호흡수’</b>를 재 보라고 권해요.</div>` },

  // 3. 기준 숫자
  { html: `
    <div class="tag">기억할 숫자</div>
    <div class="num"><span>30</span>회/분</div>
    <h2 class="center">잠든 상태에서 1분에<br>30회를 넘으면 알려 주세요</h2>
    <p class="center">심장병 아이의 수면 호흡수는 보통 30회 미만이에요.<br>넘으면 담당 수의사에게 연락해 상의하세요.</p>
    <div class="note">기준은 아이마다 다를 수 있어요.<br>우리 아이 기준은 <b>담당 수의사와 함께</b> 정하세요.</div>` },

  // 4. 세는 법
  { html: `
    <div class="tag">세는 법</div>
    <h2>30초면 충분해요</h2>
    <ol class="steps">
      <li><b>깊이 잠들었을 때</b><span>꿈꾸며 움찔거릴 때·막 깼을 때는 피해요</span></li>
      <li><b>가슴이 올라갔다 내려오면 1번</b><span>들숨과 날숨을 합쳐 한 번으로 세요</span></li>
      <li><b>30초 세고 × 2</b><span>30초에 12번이면 1분에 24회</span></li>
      <li><b>매일 비슷한 시간에</b><span>하루 한 번, 같은 조건에서 재야 비교가 돼요</span></li>
    </ol>` },

  // 5. 병원에 연락할 때
  { html: `
    <div class="tag warn">이럴 땐 병원에</div>
    <h2>숫자보다 중요한 건<br><em>변화</em>예요</h2>
    <ul class="checks">
      <li><i>!</i><div><b>다시 재도 30회를 넘어요</b><span>두 번 연속 넘으면 담당 병원에 연락하세요</span></li>
      <li><i>!</i><div><b>평소보다 눈에 띄게 빨라졌어요</b><span>기준 아래라도 꾸준히 오르면 알려 주세요</span></li>
      <li class="danger"><i>!!</i><div><b>입을 벌리고 힘들게 숨 쉬거나<br>잇몸·혀가 파래요</b><span>기다리지 말고 바로 동물병원으로 가세요</span></li>
    </ul>` },

  // 6. 보호자의 고민
  { html: `
    <div class="tag">그런데 현실은…</div>
    <h2>매일 세는데,<br>기록이 <em>흩어져요</em></h2>
    <div class="bubbles">
      <span>⏱ 스톱워치로 30초</span>
      <span>📝 메모장에 숫자</span>
      <span>💬 카톡 ‘나에게 보내기’</span>
      <span>📅 달력에 약 먹인 표시</span>
    </div>
    <div class="quote">“요즘 숨은 어땠어요?”<br><small>진료실에서 물어보면 막막해져요</small></div>` },

  // 7. 앱: 측정
  { cls: 'app', html: `
    <div class="col">
      <div class="tag">그래서 만들었어요</div>
      <h2><em>심장지킴이</em><br>톡톡 누르면<br>끝</h2>
      <ul class="feat">
        <li>숨 쉴 때마다 화면을 탭</li>
        <li>분당 호흡수 자동 계산</li>
        <li>기준을 넘으면 바로 알림</li>
        <li>심장약 투약 체크까지</li>
      </ul>
    </div>
    ${phone(shots.measure, { h: 900, w: 430 })}` },

  // 8. 앱: 리포트
  { cls: 'app', html: `
    <div class="col">
      <div class="tag">진료 날엔</div>
      <h2>이 화면<br><em>하나면</em><br>돼요</h2>
      <ul class="feat">
        <li>14·30·90일 그래프</li>
        <li>평균·최고 호흡수</li>
        <li>기준 넘은 횟수</li>
        <li>투약 순응도·증상</li>
        <li>인쇄·PDF 저장</li>
      </ul>
    </div>
    ${phone(shots.report, { h: 900, w: 430 })}` },

  // 9. 행동 유도
  { cls: 'cta', html: `
    <div class="kicker">무료 베타 참여자 모집</div>
    <h1>심장지킴이,<br>함께 써 주세요</h1>
    <ul class="pills">
      <li>설치 없이 링크로 열기</li>
      <li>회원가입 없음</li>
      <li>기록은 내 휴대폰에만</li>
    </ul>
    <div class="link">프로필 링크에서 바로 열기</div>
    <p class="save">🔖 저장해 두고, 필요한 보호자에게 공유해 주세요</p>
    <p class="disc">기록을 돕는 도구이며 진단을 대신하지 않아요. 숨이 가쁘거나 잇몸이 파랗다면 바로 병원에 연락하세요.</p>` },
];

const CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; }
body { width: 1080px; height: 1350px; font-family: 'Noto Sans KR', sans-serif; color: #2b2420; background: #fbf7f4;
  position: relative; overflow: hidden; word-break: keep-all; }
.slide { position: absolute; inset: 0; padding: 120px 96px 150px; display: flex; flex-direction: column; justify-content: center; }
.foot { position: absolute; left: 96px; right: 96px; bottom: 64px; display: flex; justify-content: space-between; align-items: center;
  font-size: 26px; font-weight: 500; color: #7a6e68; }
.foot b { color: ${BRAND}; font-weight: 900; display: flex; align-items: center; gap: 10px; }
.foot b::before { content: '♥'; font-size: 30px; }
.tag { display: inline-block; align-self: flex-start; background: #fde8e9; color: ${BRAND}; font-weight: 700; font-size: 30px; padding: 10px 26px; border-radius: 999px; margin-bottom: 36px; }
.tag.warn { background: #fde2e2; color: #d23a3a; }
h1 { font-size: 104px; font-weight: 900; line-height: 1.18; letter-spacing: -3px; margin: 0 0 40px; }
h2 { font-size: 76px; font-weight: 900; line-height: 1.25; letter-spacing: -2px; margin: 0 0 48px; }
h2 em, h1 em { font-style: normal; color: ${BRAND}; }
p { font-size: 38px; line-height: 1.6; margin: 0 0 24px; color: #4a403b; }
p b { color: #2b2420; }
.center { text-align: center; }
.note { margin-top: 32px; background: #fff; border: 2px solid #ece4de; border-radius: 28px; padding: 36px 40px; font-size: 34px; line-height: 1.6; color: #4a403b; }
.note b { color: ${BRAND}; }
.cover, .cta { background: ${BRAND}; color: #fff; }
.cover ~ .foot, .cta ~ .foot { color: rgba(255,255,255,.75); }
.cover ~ .foot b, .cta ~ .foot b { color: #fff; }
.kicker { font-size: 38px; font-weight: 700; opacity: .9; margin-bottom: 32px; }
.lead { color: #fff; font-size: 44px; font-weight: 500; line-height: 1.5; opacity: .95; }
.big30 { position: absolute; right: -40px; bottom: 60px; font-size: 520px; font-weight: 900; line-height: 1; color: rgba(255,255,255,.13); letter-spacing: -20px; }
.swipe { position: absolute; right: 96px; bottom: 140px; font-size: 32px; font-weight: 700; background: #fff; color: ${BRAND}; padding: 16px 32px; border-radius: 999px; }
.num { text-align: center; font-size: 60px; font-weight: 700; color: ${BRAND}; margin: 0 0 24px; }
.num span { font-size: 300px; font-weight: 900; line-height: 1; letter-spacing: -10px; margin-right: 12px; }
.steps { list-style: none; padding: 0; margin: 0; counter-reset: s; display: grid; gap: 28px; }
.steps li { counter-increment: s; background: #fff; border: 2px solid #ece4de; border-radius: 28px; padding: 32px 40px 32px 140px; position: relative; }
.steps li::before { content: counter(s); position: absolute; left: 40px; top: 50%; transform: translateY(-50%); width: 72px; height: 72px; border-radius: 50%;
  background: ${BRAND}; color: #fff; font-size: 40px; font-weight: 900; display: grid; place-items: center; }
.steps b, .checks b { display: block; font-size: 42px; font-weight: 900; margin-bottom: 6px; }
.steps span, .checks span { font-size: 30px; color: #7a6e68; }
.checks { list-style: none; padding: 0; margin: 0; display: grid; gap: 28px; }
.checks li { display: flex; gap: 32px; align-items: center; background: #fff; border: 2px solid #ece4de; border-radius: 28px; padding: 36px 40px; }
.checks i { flex: none; width: 72px; height: 72px; border-radius: 50%; background: #fff3d9; color: #d98a00; font-style: normal; font-size: 40px; font-weight: 900; display: grid; place-items: center; }
.checks .danger { background: #fde2e2; border-color: #f5b8b8; }
.checks .danger i { background: #d23a3a; color: #fff; }
.checks .danger b { color: #b42525; }
.bubbles { display: flex; flex-wrap: wrap; gap: 22px; margin-bottom: 56px; }
.bubbles span { background: #fff; border: 2px solid #ece4de; border-radius: 999px; padding: 22px 36px; font-size: 36px; font-weight: 500; }
.bubbles span:nth-child(2) { transform: rotate(-2deg); } .bubbles span:nth-child(3) { transform: rotate(1.5deg); }
.quote { background: #2b2420; color: #fff; border-radius: 32px; padding: 48px; font-size: 54px; font-weight: 900; line-height: 1.4; }
.quote small { display: block; font-size: 34px; font-weight: 500; opacity: .75; margin-top: 12px; }
.app { flex-direction: row; align-items: center; gap: 56px; padding-right: 72px; }
.app .col { flex: 1; }
.app h2 { font-size: 80px; }
.feat { list-style: none; padding: 0; margin: 0; display: grid; gap: 20px; }
.feat li { font-size: 34px; font-weight: 500; display: flex; gap: 16px; align-items: center; }
.feat li::before { content: '✓'; flex: none; width: 44px; height: 44px; border-radius: 50%; background: #e3f5ec; color: #2f9e6d; font-weight: 900; font-size: 26px; display: grid; place-items: center; }
.phone { flex: none; border: 14px solid #2b2420; border-radius: 64px; overflow: hidden; background: #fbf7f4; box-shadow: 0 40px 80px rgba(43,36,32,.25); }
.phone img { display: block; }
.pills { list-style: none; padding: 0; margin: 0 0 56px; display: flex; flex-wrap: wrap; gap: 18px; }
.pills li { background: rgba(255,255,255,.18); border: 2px solid rgba(255,255,255,.5); border-radius: 999px; padding: 16px 32px; font-size: 34px; font-weight: 700; }
.link { align-self: flex-start; background: #fff; color: ${BRAND}; font-size: 46px; font-weight: 900; padding: 30px 56px; border-radius: 999px; margin-bottom: 44px; box-shadow: 0 16px 40px rgba(0,0,0,.15); }
.link::after { content: ' →'; }
.save { color: #fff; font-size: 36px; font-weight: 700; }
.disc { color: rgba(255,255,255,.8); font-size: 26px; line-height: 1.6; margin-top: 24px; }
`;

const OUT = process.env.CARDNEWS_OUT || 'docs/cardnews';
mkdirSync(OUT, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
for (const [i, sl] of slides.entries()) {
  await page.setContent(`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="${FONT}"><style>${CSS}</style>
    <div class="slide ${sl.cls || ''}">${sl.html}</div>
    <div class="foot"><b>심장지킴이</b><span>${i + 1} / ${TOTAL}</span></div>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const file = `${OUT}/${String(i + 1).padStart(2, '0')}.png`;
  await page.screenshot({ path: file });
  console.log('wrote', file);
}
await browser.close();
server.close();
