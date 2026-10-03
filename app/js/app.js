import {
  DEFAULT_THRESHOLD, SYMPTOMS, breathsPerMinute, dayKey, lastNDays, dailyAverages,
  assess, dosesForDay, buildReport, normalizeData, emptyData, uid,
} from './core.js';
import { load, save } from './store.js';

let data = load();
let tab = 'home';
const view = document.getElementById('view');

// ---------- 공통 유틸 ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => dayKey(Date.now());
const pet = () => data.pets.find((p) => p.id === data.activePetId) || data.pets[0];
const threshold = (p = pet()) => Number(p?.threshold) || DEFAULT_THRESHOLD;
const petRecords = (p = pet()) => data.records.filter((r) => r.petId === p.id).sort((a, b) => b.at - a.at);
const fmtTime = (ts) => new Date(ts).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtDay = (k) => { const [, m, d] = k.split('-'); return `${Number(m)}/${Number(d)}`; };
// 받침 유무에 따라 조사를 고른다: josa('콩이', '이', '가') → '콩이가'
const josa = (word, withBatchim, without) => {
  const c = String(word).charCodeAt(String(word).length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false;
  return word + (has ? withBatchim : without);
};
const symptomLabel = (id) => SYMPTOMS.find((s) => s.id === id)?.label || id;

function persist() {
  if (!save(data)) toast('저장 공간에 저장하지 못했어요. 백업 파일을 내보내 주세요.');
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- 차트 (SVG) ----------
function chart(range, daily, limit) {
  const W = 340, H = 160, L = 26, R = 16, T = 10, B = 22;
  const vals = range.map((k) => daily.get(k)).filter((v) => v != null);
  const yMax = Math.max(limit + 10, ...(vals.length ? vals : [0])) + 2;
  const x = (i) => L + (range.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (range.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v / yMax);
  const pts = range.map((k, i) => (daily.has(k) ? [x(i), y(daily.get(k)), daily.get(k)] : null));
  let path = '', pen = false;
  for (const p of pts) {
    if (!p) { pen = false; continue; }
    path += `${pen ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)} `;
    pen = true;
  }
  const ticks = [0, Math.round(yMax / 2), limit].filter((v, i, a) => a.indexOf(v) === i);
  const labelEvery = Math.ceil(range.length / 6);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="날짜별 평균 수면 호흡수 그래프">
    ${ticks.map((t) => `<text x="0" y="${y(t) + 3}">${t}</text>`).join('')}
    <line x1="${L}" x2="${W - R}" y1="${y(limit)}" y2="${y(limit)}" stroke="#d23a3a" stroke-dasharray="4 4" stroke-width="1.2"/>
    <line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" stroke="currentColor" opacity=".15"/>
    <path d="${path}" fill="none" stroke="#e8505b" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p) => (p ? `<circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="${p[2] >= limit ? '#d23a3a' : '#e8505b'}"/>` : '')).join('')}
    ${range.map((k, i) => ((i % labelEvery === 0 && range.length - 1 - i >= labelEvery / 2) || i === range.length - 1 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${fmtDay(k)}</text>` : '')).join('')}
  </svg>`;
}

// ---------- 화면: 온보딩 / 반려동물 폼 ----------
function petForm(p = {}) {
  return `
    <label for="pf-name">이름</label>
    <input id="pf-name" type="text" maxlength="20" value="${esc(p.name)}" placeholder="예: 콩이" required>
    <label>종류</label>
    <div class="seg" id="pf-species">
      <button type="button" data-v="dog" class="${p.species !== 'cat' ? 'on' : ''}">🐶 강아지</button>
      <button type="button" data-v="cat" class="${p.species === 'cat' ? 'on' : ''}">🐱 고양이</button>
    </div>
    <label for="pf-diag">진단명 (선택)</label>
    <input id="pf-diag" type="text" maxlength="40" value="${esc(p.diagnosis)}" placeholder="예: 이첨판 폐쇄부전 B2">
    <label for="pf-th">경고 기준 호흡수 (분당)</label>
    <input id="pf-th" type="number" inputmode="numeric" min="10" max="80" value="${esc(p.threshold || DEFAULT_THRESHOLD)}">
    <p class="muted small">보통 수면 중 30회입니다. 수의사가 다른 기준을 알려줬다면 그 값을 입력하세요.</p>`;
}

function readPetForm() {
  const name = document.getElementById('pf-name').value.trim();
  if (!name) { toast('이름을 입력해 주세요.'); return null; }
  const th = Number(document.getElementById('pf-th').value);
  return {
    name,
    species: document.querySelector('#pf-species .on')?.dataset.v || 'dog',
    diagnosis: document.getElementById('pf-diag').value.trim(),
    threshold: th >= 10 && th <= 80 ? th : DEFAULT_THRESHOLD,
  };
}

function bindSeg(id) {
  document.getElementById(id)?.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  });
}

function renderOnboarding() {
  view.innerHTML = `
    <h1>심장지킴이 🫀</h1>
    <p class="muted">심장병이 있는 아이의 <b>수면 호흡수</b>, <b>심장약</b>, <b>증상</b>을 한곳에 기록하고 진료 때 수의사에게 보여주세요.</p>
    <div class="card">
      <h2>우리 아이 등록</h2>
      ${petForm()}
      <div class="spacer"></div>
      <button class="btn primary block" id="pf-save">시작하기</button>
    </div>
    <p class="disclaimer">이 앱은 기록을 돕는 도구이며 진단·치료를 대신하지 않습니다. 호흡이 힘들어 보이거나 잇몸이 파랗다면 바로 동물병원에 연락하세요.</p>`;
  bindSeg('pf-species');
  document.getElementById('pf-save').onclick = () => {
    const v = readPetForm();
    if (!v) return;
    const p = { id: uid(), ...v, createdAt: Date.now() };
    data.pets.push(p);
    data.activePetId = p.id;
    persist();
    go('home');
  };
}

// ---------- 화면: 홈 ----------
const STATUS_TEXT = {
  none: ['아직 측정 기록이 없어요', '아이가 깊이 잠들었을 때 첫 측정을 해보세요.'],
  ok: ['안정적이에요', '기준 이하입니다. 매일 비슷한 시간에 재 주세요.'],
  rising: ['조금 오르는 추세예요', '기준 이하지만 최근 평균이 평소보다 높아요. 측정 횟수를 늘려 주세요.'],
  warn: ['기준을 넘었어요', '30분쯤 뒤 깊이 잠들었을 때 다시 재 보세요. 계속 높으면 병원에 연락하세요.'],
  danger: ['연속으로 기준을 넘었어요', '폐에 물이 차는 신호일 수 있어요. 지금 다니는 동물병원에 연락하세요.'],
};

function renderHome() {
  const p = pet();
  const recs = petRecords(p);
  const a = assess(recs, threshold(p));
  const [title, desc] = STATUS_TEXT[a.level];
  const range = lastNDays(today(), 14);
  const doses = dosesForDay(data.meds.filter((m) => m.petId === p.id));
  const takenToday = data.taken[p.id]?.[today()] || {};
  const left = doses.filter((d) => !takenToday[d.slot]);

  view.innerHTML = `
    <section class="card status ${a.level}">
      <p class="muted small">최근 수면 호흡수</p>
      <div class="big">${a.last ? `${a.last.bpm}<small> 회/분</small>` : '–'}</div>
      <p><b>${title}</b></p>
      <p class="small">${desc}</p>
      ${a.last ? `<p class="muted small">${fmtTime(a.last.at)} 측정 · 기준 ${threshold(p)}회</p>` : ''}
      <div class="spacer"></div>
      <button class="btn primary block" data-go="measure">🫁 지금 호흡수 재기</button>
    </section>

    <section class="card">
      <h2>오늘 남은 약 ${doses.length ? `<span class="pill">${doses.length - left.length}/${doses.length}</span>` : ''}</h2>
      ${doses.length === 0
        ? '<p class="muted">등록된 약이 없어요.</p><button class="btn block" data-go="meds">💊 약 등록하기</button>'
        : left.length === 0
          ? '<p>오늘 약을 모두 먹였어요 👏</p>'
          : left.map((d) => `<button class="dose" data-slot="${esc(d.slot)}"><span class="check"></span><span class="t">${esc(d.time)}</span><span class="grow">${esc(d.name)} <span class="muted small">${esc(d.dose)}</span></span></button>`).join('')}
    </section>

    <section class="card chart">
      <h2>최근 14일</h2>
      ${recs.length ? chart(range, dailyAverages(recs), threshold(p)) : '<p class="muted">측정하면 그래프가 그려져요.</p>'}
      <p class="muted small">빨간 점선은 경고 기준(${threshold(p)}회)입니다.</p>
    </section>`;

  view.querySelectorAll('.dose').forEach((b) => (b.onclick = () => { toggleDose(b.dataset.slot); renderHome(); }));
}

function toggleDose(slot, key = today()) {
  const p = pet();
  data.taken[p.id] ??= {};
  data.taken[p.id][key] ??= {};
  const day = data.taken[p.id][key];
  if (day[slot]) delete day[slot];
  else day[slot] = Date.now();
  persist();
}

// ---------- 화면: 호흡수 측정 ----------
const session = { duration: 30, state: 'idle', taps: 0, startedAt: 0, timer: null, bpm: 0 };

function resetSession() {
  clearInterval(session.timer);
  Object.assign(session, { state: 'idle', taps: 0, startedAt: 0, timer: null, bpm: 0 });
}

function renderMeasure() {
  const p = pet();
  if (session.state === 'done') return renderMeasureResult();
  view.innerHTML = `
    <h1>수면 호흡수 측정</h1>
    <p class="muted small">${esc(josa(p.name, '이', '가'))} <b>깊이 잠들었을 때</b> 가슴이 한 번 오르내릴 때마다 원을 탭하세요. 첫 탭부터 시간이 흘러요.</p>
    <div class="seg no-print" id="dur">
      <button data-v="30" class="${session.duration === 30 ? 'on' : ''}">30초</button>
      <button data-v="60" class="${session.duration === 60 ? 'on' : ''}">60초</button>
    </div>
    <button class="tap-zone" id="tap" aria-label="숨 한 번마다 탭">
      <span class="count" id="tap-count">${session.taps}</span>
      <span class="hint" id="tap-hint">${session.state === 'running' ? '숨 쉴 때마다 탭' : '탭해서 시작'}</span>
    </button>
    <div class="timer-bar"><div id="tbar"></div></div>
    <p class="muted small" id="tleft" style="text-align:center;margin-top:6px">${session.duration}초</p>
    <div class="row">
      <button class="btn" id="m-reset">다시 하기</button>
    </div>
    <details class="card" style="margin-top:14px">
      <summary><b>측정 팁</b></summary>
      <ul class="small">
        <li>들숨+날숨을 <b>1회</b>로 셉니다.</li>
        <li>꿈꾸거나 코골 때, 덥거나 막 뛰고 난 뒤는 피하세요.</li>
        <li>매일 비슷한 시간(예: 밤 잠든 뒤)에 재면 추세를 보기 좋아요.</li>
        <li>정상은 보통 분당 15~30회입니다.</li>
      </ul>
    </details>`;

  document.getElementById('dur').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || session.state === 'running') return;
    session.duration = Number(b.dataset.v);
    renderMeasure();
  };
  document.getElementById('m-reset').onclick = () => { resetSession(); renderMeasure(); };
  // pointerdown이 click보다 반응이 빨라 빠른 호흡도 놓치지 않는다
  const tapEl = document.getElementById('tap');
  tapEl.addEventListener('pointerdown', (e) => { e.preventDefault(); onTap(); });
  tapEl.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onTap(); } });
  if (session.state === 'running') tick();
}

function onTap() {
  if (session.state === 'idle') {
    session.state = 'running';
    session.startedAt = performance.now();
    session.timer = setInterval(tick, 200);
    document.getElementById('tap-hint').textContent = '숨 쉴 때마다 탭';
  }
  if (session.state !== 'running') return;
  session.taps++;
  navigator.vibrate?.(8);
  const el = document.getElementById('tap');
  document.getElementById('tap-count').textContent = session.taps;
  el.classList.add('pulse');
  setTimeout(() => el.classList.remove('pulse'), 80);
}

function tick() {
  const elapsed = (performance.now() - session.startedAt) / 1000;
  const bar = document.getElementById('tbar');
  const left = document.getElementById('tleft');
  if (bar) bar.style.width = `${Math.min(100, (elapsed / session.duration) * 100)}%`;
  if (left) left.textContent = `${Math.max(0, Math.ceil(session.duration - elapsed))}초`;
  if (elapsed >= session.duration) {
    clearInterval(session.timer);
    session.state = 'done';
    session.bpm = breathsPerMinute(session.taps, session.duration);
    navigator.vibrate?.([60, 60, 60]);
    if (tab === 'measure') renderMeasureResult();
  }
}

function renderMeasureResult() {
  const p = pet();
  const hi = session.bpm >= threshold(p);
  view.innerHTML = `
    <h1>측정 결과</h1>
    <section class="card status ${hi ? 'warn' : 'ok'}">
      <div class="result-num big">${session.bpm}<small style="font-size:18px"> 회/분</small></div>
      <p style="text-align:center">${session.duration}초 동안 ${session.taps}회 · 기준 ${threshold(p)}회 ${hi ? '<b>이상</b>' : '미만'}</p>
    </section>
    <div class="card">
      <label>측정할 때 상태</label>
      <div class="seg" id="r-state">
        <button data-v="sleep" class="on">😴 자는 중</button>
        <button data-v="rest">🛋 쉬는 중</button>
      </div>
      <label for="r-note">메모 (선택)</label>
      <input id="r-note" type="text" maxlength="80" placeholder="예: 저녁 약 먹고 1시간 뒤">
    </div>
    <div class="row">
      <button class="btn" id="r-discard">버리기</button>
      <button class="btn primary" id="r-save">저장</button>
    </div>`;
  bindSeg('r-state');
  document.getElementById('r-discard').onclick = () => { resetSession(); renderMeasure(); };
  document.getElementById('r-save').onclick = () => {
    data.records.push({
      id: uid(), petId: p.id, at: Date.now(), bpm: session.bpm, taps: session.taps, seconds: session.duration,
      state: document.querySelector('#r-state .on').dataset.v,
      note: document.getElementById('r-note').value.trim(),
    });
    persist();
    resetSession();
    toast('저장했어요');
    go('home');
  };
}

// ---------- 화면: 투약 ----------
function renderMeds() {
  const p = pet();
  const meds = data.meds.filter((m) => m.petId === p.id);
  const doses = dosesForDay(meds);
  const takenToday = data.taken[p.id]?.[today()] || {};
  view.innerHTML = `
    <h1>투약 체크</h1>
    <section class="card">
      <h2>오늘 (${fmtDay(today())})</h2>
      ${doses.length
        ? doses.map((d) => `<button class="dose ${takenToday[d.slot] ? 'done' : ''}" data-slot="${esc(d.slot)}">
            <span class="check">${takenToday[d.slot] ? '✓' : ''}</span><span class="t">${esc(d.time)}</span>
            <span class="grow">${esc(d.name)} <span class="muted small">${esc(d.dose)}</span></span></button>`).join('')
        : '<p class="muted">아래에서 약을 등록하세요.</p>'}
    </section>
    <section class="card">
      <h2>등록된 약</h2>
      ${meds.length ? `<ul class="list">${meds.map((m) => `
        <li><span class="grow"><b>${esc(m.name)}</b> <span class="muted small">${esc(m.dose)}</span><br>
          <span class="muted small">${m.times.map(esc).join(' · ')}</span></span>
          <button class="x-btn" data-del="${esc(m.id)}" aria-label="${esc(m.name)} 삭제">✕</button></li>`).join('')}</ul>`
        : '<p class="muted">아직 없어요.</p>'}
    </section>
    <section class="card">
      <h2>약 추가</h2>
      <label for="md-name">약 이름</label>
      <input id="md-name" type="text" maxlength="30" list="med-suggest" placeholder="예: 피모벤단">
      <datalist id="med-suggest">
        <option value="피모벤단"><option value="푸로세마이드 (이뇨제)"><option value="토르세마이드 (이뇨제)">
        <option value="스피로노락톤"><option value="에날라프릴"><option value="베나제프릴"><option value="실데나필">
      </datalist>
      <label for="md-dose">용량 (선택)</label>
      <input id="md-dose" type="text" maxlength="30" placeholder="예: 1/2정">
      <label>먹이는 시간</label>
      <div class="times" id="md-times"><input type="time" value="08:00"><input type="time" value="20:00"></div>
      <div class="row" style="margin-top:8px">
        <button class="btn" id="md-add-time">+ 시간 추가</button>
        <button class="btn primary" id="md-save">등록</button>
      </div>
    </section>`;

  view.querySelectorAll('.dose').forEach((b) => (b.onclick = () => { toggleDose(b.dataset.slot); renderMeds(); }));
  view.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => {
    if (!confirm('이 약을 삭제할까요? 지난 복용 기록은 리포트에서 빠집니다.')) return;
    data.meds = data.meds.filter((m) => m.id !== b.dataset.del);
    persist();
    renderMeds();
  }));
  document.getElementById('md-add-time').onclick = () => {
    const box = document.getElementById('md-times');
    if (box.children.length >= 4) return toast('하루 최대 4회까지 등록할 수 있어요.');
    const i = document.createElement('input');
    i.type = 'time';
    i.value = '12:00';
    box.append(i);
  };
  document.getElementById('md-save').onclick = () => {
    const name = document.getElementById('md-name').value.trim();
    const times = [...new Set([...document.querySelectorAll('#md-times input')].map((i) => i.value).filter(Boolean))].sort();
    if (!name) return toast('약 이름을 입력해 주세요.');
    if (!times.length) return toast('먹이는 시간을 하나 이상 넣어 주세요.');
    data.meds.push({ id: uid(), petId: p.id, createdAt: Date.now(), name, dose: document.getElementById('md-dose').value.trim(), times });
    persist();
    toast('등록했어요');
    renderMeds();
  };
}

// ---------- 화면: 증상 기록 ----------
function renderLog() {
  const p = pet();
  const symptoms = data.symptoms.filter((s) => s.petId === p.id).sort((a, b) => b.at - a.at).slice(0, 20);
  const recs = petRecords(p).slice(0, 20);
  view.innerHTML = `
    <h1>증상 기록</h1>
    <section class="card">
      <h2>오늘 보인 증상</h2>
      <div class="chips" id="sx">${SYMPTOMS.map((s) => `<button class="chip" data-id="${s.id}">${s.label}</button>`).join('')}</div>
      <label for="sx-note">메모</label>
      <textarea id="sx-note" maxlength="300" placeholder="예: 새벽에 마른기침 3번, 산책 10분 만에 앉음"></textarea>
      <div class="spacer"></div>
      <button class="btn primary block" id="sx-save">기록하기</button>
    </section>
    <section class="card">
      <h2>최근 증상</h2>
      ${symptoms.length ? `<ul class="list">${symptoms.map((s) => `
        <li><span class="grow"><span class="muted small">${fmtTime(s.at)}</span><br>
          ${s.tags.map((t) => `<span class="pill">${esc(symptomLabel(t))}</span>`).join(' ')} ${esc(s.note)}</span>
          <button class="x-btn" data-delsx="${esc(s.id)}" aria-label="삭제">✕</button></li>`).join('')}</ul>`
        : '<p class="muted">아직 없어요.</p>'}
    </section>
    <section class="card">
      <h2>최근 호흡수 측정</h2>
      ${recs.length ? `<ul class="list">${recs.map((r) => `
        <li><span class="grow">${fmtTime(r.at)} <span class="muted small">${r.state === 'rest' ? '쉬는 중' : '자는 중'}${r.note ? ` · ${esc(r.note)}` : ''}</span></span>
          <span class="pill ${r.bpm >= threshold(p) ? 'hi' : ''}">${r.bpm}회</span>
          <button class="x-btn" data-delrec="${esc(r.id)}" aria-label="삭제">✕</button></li>`).join('')}</ul>`
        : '<p class="muted">아직 없어요.</p>'}
    </section>`;

  document.getElementById('sx').onclick = (e) => e.target.closest('.chip')?.classList.toggle('on');
  document.getElementById('sx-save').onclick = () => {
    const tags = [...document.querySelectorAll('#sx .chip.on')].map((c) => c.dataset.id);
    const note = document.getElementById('sx-note').value.trim();
    if (!tags.length && !note) return toast('증상을 고르거나 메모를 적어 주세요.');
    data.symptoms.push({ id: uid(), petId: p.id, at: Date.now(), tags, note });
    persist();
    toast('기록했어요');
    renderLog();
  };
  view.querySelectorAll('[data-delsx]').forEach((b) => (b.onclick = () => {
    if (!confirm('이 기록을 삭제할까요?')) return;
    data.symptoms = data.symptoms.filter((s) => s.id !== b.dataset.delsx);
    persist();
    renderLog();
  }));
  view.querySelectorAll('[data-delrec]').forEach((b) => (b.onclick = () => {
    if (!confirm('이 측정 기록을 삭제할까요?')) return;
    data.records = data.records.filter((r) => r.id !== b.dataset.delrec);
    persist();
    renderLog();
  }));
}

// ---------- 화면: 진료 리포트 ----------
let reportDays = 30;
function renderReport() {
  const p = pet();
  const r = buildReport(p, data, today(), reportDays);
  const meds = data.meds.filter((m) => m.petId === p.id);
  const sx = Object.entries(r.symptomCounts).sort((a, b) => b[1] - a[1]);
  view.innerHTML = `
    <div class="seg no-print" id="rd">
      <button data-v="14" class="${reportDays === 14 ? 'on' : ''}">14일</button>
      <button data-v="30" class="${reportDays === 30 ? 'on' : ''}">30일</button>
      <button data-v="90" class="${reportDays === 90 ? 'on' : ''}">90일</button>
    </div>
    <div class="spacer"></div>
    <section class="card">
      <h1 style="margin-top:0">${esc(p.name)} 진료 리포트</h1>
      <p class="muted small">${p.species === 'cat' ? '고양이' : '강아지'}${p.diagnosis ? ` · ${esc(p.diagnosis)}` : ''} · ${fmtDay(r.from)} ~ ${fmtDay(r.to)} (${reportDays}일) · 경고 기준 ${threshold(p)}회/분</p>
      <div class="kpis">
        <div class="kpi"><span class="muted small">평균 수면 호흡수</span><b>${r.srr ? r.srr.avg : '–'}</b></div>
        <div class="kpi"><span class="muted small">최저 / 최고</span><b>${r.srr ? `${r.srr.min} / ${r.srr.max}` : '–'}</b></div>
        <div class="kpi"><span class="muted small">측정 횟수 (기준 초과)</span><b>${r.srr ? r.srr.count : 0} <small class="muted">(${r.overThreshold})</small></b></div>
        <div class="kpi"><span class="muted small">투약 순응도</span><b>${r.adherence ? `${r.adherence.pct}%` : '–'}</b></div>
      </div>
    </section>
    <section class="card chart">
      <h2>날짜별 평균 수면 호흡수</h2>
      ${r.srr ? chart(r.range, r.daily, threshold(p)) : '<p class="muted">기간 내 측정 기록이 없어요.</p>'}
    </section>
    <section class="card">
      <h2>복용 중인 약</h2>
      ${meds.length ? `<table><tr><th>약</th><th>용량</th><th>시간</th></tr>${meds.map((m) => `<tr><td>${esc(m.name)}</td><td>${esc(m.dose) || '-'}</td><td>${m.times.map(esc).join(', ')}</td></tr>`).join('')}</table>
        ${r.adherence ? `<p class="muted small" style="margin-top:8px">계획 ${r.adherence.planned}회 중 ${r.adherence.done}회 복용 기록</p>` : ''}` : '<p class="muted">등록된 약 없음</p>'}
    </section>
    <section class="card">
      <h2>증상</h2>
      ${sx.length ? `<table><tr><th>증상</th><th>기록 횟수</th></tr>${sx.map(([id, n]) => `<tr><td>${esc(symptomLabel(id))}</td><td>${n}</td></tr>`).join('')}</table>` : '<p class="muted">기록된 증상 없음</p>'}
      ${r.notes.length ? `<h2 style="margin-top:14px">보호자 메모</h2><ul class="list">${r.notes.slice(0, 15).map((n) => `<li><span class="grow"><span class="muted small">${fmtTime(n.at)}</span><br>${esc(n.note)}</span></li>`).join('')}</ul>` : ''}
    </section>
    <button class="btn primary block no-print" id="print">🖨 인쇄 · PDF로 저장</button>
    <p class="disclaimer">보호자가 집에서 직접 측정한 기록입니다. 진단은 수의사의 판단을 따르세요. 심장지킴이에서 만들었습니다.</p>`;
  document.getElementById('rd').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    reportDays = Number(b.dataset.v);
    renderReport();
  };
  document.getElementById('print').onclick = () => window.print();
}

// ---------- 화면: 설정 ----------
function renderSettings() {
  const p = pet();
  view.innerHTML = `
    <h1>설정</h1>
    <section class="card">
      <h2>${esc(p.name)} 정보</h2>
      ${petForm(p)}
      <div class="spacer"></div>
      <button class="btn primary block" id="pf-save">저장</button>
    </section>
    <section class="card">
      <h2>반려동물</h2>
      <ul class="list">${data.pets.map((x) => `<li><span class="grow">${x.species === 'cat' ? '🐱' : '🐶'} ${esc(x.name)}</span>
        ${x.id === p.id ? '<span class="pill">선택됨</span>' : `<button class="btn" data-pick="${esc(x.id)}">선택</button>`}</li>`).join('')}</ul>
      <div class="spacer"></div>
      <button class="btn block" id="add-pet">+ 반려동물 추가</button>
    </section>
    <section class="card">
      <h2>백업</h2>
      <p class="muted small">기록은 이 기기에만 저장돼요. 휴대폰을 바꾸거나 브라우저 데이터를 지우기 전에 백업 파일을 내보내 두세요.</p>
      <div class="row">
        <button class="btn" id="export">내보내기</button>
        <label class="btn" style="margin:0;color:inherit">가져오기<input type="file" id="import" accept="application/json,.json" hidden></label>
      </div>
    </section>
    <section class="card">
      <h2>삭제</h2>
      <button class="btn danger block" id="del-pet">${esc(p.name)} 기록 전체 삭제</button>
    </section>
    <p class="disclaimer">심장지킴이 v0.1 · 이 앱은 의료기기가 아니며 진단·치료를 대신하지 않습니다.</p>`;

  bindSeg('pf-species');
  document.getElementById('pf-save').onclick = () => {
    const v = readPetForm();
    if (!v) return;
    Object.assign(p, v);
    persist();
    toast('저장했어요');
    updateHeader();
  };
  view.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => { data.activePetId = b.dataset.pick; persist(); go('home'); }));
  document.getElementById('add-pet').onclick = renderAddPet;
  document.getElementById('export').onclick = exportBackup;
  document.getElementById('import').onchange = importBackup;
  document.getElementById('del-pet').onclick = () => {
    if (!confirm(`${p.name}의 모든 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    data.pets = data.pets.filter((x) => x.id !== p.id);
    data.records = data.records.filter((x) => x.petId !== p.id);
    data.meds = data.meds.filter((x) => x.petId !== p.id);
    data.symptoms = data.symptoms.filter((x) => x.petId !== p.id);
    delete data.taken[p.id];
    data.activePetId = data.pets[0]?.id ?? null;
    persist();
    go('home');
  };
}

function renderAddPet() {
  view.innerHTML = `
    <h1>반려동물 추가</h1>
    <div class="card">${petForm()}<div class="spacer"></div>
      <div class="row"><button class="btn" id="cancel">취소</button><button class="btn primary" id="pf-save">추가</button></div>
    </div>`;
  bindSeg('pf-species');
  document.getElementById('cancel').onclick = renderSettings;
  document.getElementById('pf-save').onclick = () => {
    const v = readPetForm();
    if (!v) return;
    const np = { id: uid(), ...v, createdAt: Date.now() };
    data.pets.push(np);
    data.activePetId = np.id;
    persist();
    go('home');
  };
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `심장지킴이-백업-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importBackup(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const next = normalizeData(JSON.parse(await file.text()));
    if (!confirm('지금 기록을 백업 파일 내용으로 바꿀까요?')) return;
    data = next;
    persist();
    toast('가져왔어요');
    go('home');
  } catch (err) {
    toast(err.message || '파일을 읽지 못했어요.');
  }
}

// ---------- 라우팅 ----------
function updateHeader() {
  const p = pet();
  const btn = document.getElementById('pet-switch');
  btn.textContent = p ? `${p.species === 'cat' ? '🐱' : '🐶'} ${p.name} ▾` : '심장지킴이';
  document.getElementById('open-settings').hidden = !p;
  document.getElementById('tabbar').hidden = !p;
}

function go(next) {
  if (tab === 'measure' && next !== 'measure' && session.state === 'running') resetSession();
  tab = next;
  if (data.pets.length && !pet()) data.activePetId = data.pets[0].id;
  updateHeader();
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  if (!data.pets.length) return renderOnboarding();
  ({ home: renderHome, measure: renderMeasure, meds: renderMeds, log: renderLog, report: renderReport, settings: renderSettings }[tab] || renderHome)();
  window.scrollTo(0, 0);
}

document.getElementById('tabbar').onclick = (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) go(b.dataset.tab);
};
view.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) go(b.dataset.go);
});
document.getElementById('open-settings').onclick = () => go('settings');
document.getElementById('pet-switch').onclick = () => {
  if (data.pets.length < 2) return go('settings');
  const i = data.pets.findIndex((p) => p.id === pet().id);
  data.activePetId = data.pets[(i + 1) % data.pets.length].id;
  persist();
  toast(`${pet().name} 기록을 보고 있어요`);
  go(tab);
};

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// 디버그/테스트용 진입점
window.__simjang = { reset: () => { data = emptyData(); persist(); go('home'); } };

go('home');
