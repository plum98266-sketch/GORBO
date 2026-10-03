// 순수 로직: DOM·저장소에 의존하지 않아 node:test로 검증한다.

export const DEFAULT_THRESHOLD = 30; // 분당 호흡수 경고 기준 (수면 시)
export const SYMPTOMS = [
  { id: 'cough', label: '기침' },
  { id: 'appetite', label: '식욕 저하' },
  { id: 'lethargy', label: '무기력' },
  { id: 'dyspnea', label: '숨참·헐떡임' },
  { id: 'syncope', label: '실신·주저앉음' },
  { id: 'restless', label: '밤에 안절부절' },
];

/** 탭 횟수와 측정 시간(초)으로 분당 호흡수를 계산한다. */
export function breathsPerMinute(taps, seconds) {
  if (!(seconds > 0) || taps < 0) return 0;
  return Math.round((taps * 60) / seconds);
}

/** Date 또는 타임스탬프를 로컬 기준 'YYYY-MM-DD'로 변환한다. */
export function dayKey(input) {
  const d = new Date(input);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** 기준일(포함)부터 거꾸로 n일의 dayKey 목록, 오래된 날짜가 앞에 온다. */
export function lastNDays(endKey, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(endKey, -i));
  return out;
}

/** 측정 기록을 날짜별 평균으로 묶는다. */
export function dailyAverages(records) {
  const byDay = new Map();
  for (const r of records) {
    const k = dayKey(r.at);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(r.bpm);
  }
  const out = new Map();
  for (const [k, vals] of byDay) {
    out.set(k, Math.round(vals.reduce((a, b) => a + b, 0) / vals.length));
  }
  return out;
}

export function stats(values) {
  if (!values.length) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    count: values.length,
    avg: Math.round(sum / values.length),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/**
 * 경고 단계 판단.
 * - danger: 최근 측정이 기준 이상이고, 이전 측정도 기준 이상 (2회 연속)
 * - warn:   최근 측정 1회만 기준 이상
 * - rising: 최근 3일 평균이 그 전 7일 평균보다 20% 이상 높음
 * - ok / none
 */
export function assess(records, threshold = DEFAULT_THRESHOLD, todayKey = dayKey(Date.now())) {
  if (!records.length) return { level: 'none' };
  const sorted = [...records].sort((a, b) => a.at - b.at);
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  if (last.bpm >= threshold) {
    if (prev && prev.bpm >= threshold) return { level: 'danger', last };
    return { level: 'warn', last };
  }
  const avgs = dailyAverages(sorted);
  const recent = lastNDays(todayKey, 3).map((k) => avgs.get(k)).filter((v) => v != null);
  const base = lastNDays(addDays(todayKey, -3), 7).map((k) => avgs.get(k)).filter((v) => v != null);
  if (recent.length >= 2 && base.length >= 3) {
    const r = recent.reduce((a, b) => a + b, 0) / recent.length;
    const b = base.reduce((a, c) => a + c, 0) / base.length;
    if (r >= b * 1.2) return { level: 'rising', last, recentAvg: Math.round(r), baseAvg: Math.round(b) };
  }
  return { level: 'ok', last };
}

/** 특정 날짜에 복용해야 하는 회차 목록: [{medId, name, time, slot}] */
export function dosesForDay(meds) {
  const out = [];
  for (const m of meds) {
    if (m.active === false) continue;
    for (const time of m.times) out.push({ medId: m.id, name: m.name, dose: m.dose || '', time, slot: `${m.id}@${time}` });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * 기간 동안 투약 순응도. taken: { 'YYYY-MM-DD': { slot: timestamp } }
 * 약을 등록한 날(createdAt) 이전은 계획에서 뺀다.
 */
export function adherence(meds, taken, days) {
  let planned = 0;
  let done = 0;
  for (const m of meds) {
    if (m.active === false) continue;
    const since = m.createdAt ? dayKey(m.createdAt) : '';
    for (const k of days) {
      if (k < since) continue;
      for (const time of m.times) {
        planned++;
        if (taken[k]?.[`${m.id}@${time}`]) done++;
      }
    }
  }
  if (!planned) return null;
  return { planned, done, pct: Math.round((done / planned) * 100) };
}

/** 진료용 리포트 데이터 묶음 */
export function buildReport(pet, data, endKey, days = 30) {
  const range = lastNDays(endKey, days);
  const inRange = new Set(range);
  const recs = data.records.filter((r) => r.petId === pet.id && inRange.has(dayKey(r.at)));
  const threshold = pet.threshold || DEFAULT_THRESHOLD;
  const symptomCounts = {};
  for (const s of data.symptoms.filter((s) => s.petId === pet.id && inRange.has(dayKey(s.at)))) {
    for (const id of s.tags) symptomCounts[id] = (symptomCounts[id] || 0) + 1;
  }
  const meds = data.meds.filter((m) => m.petId === pet.id);
  return {
    from: range[0],
    to: endKey,
    srr: stats(recs.map((r) => r.bpm)),
    overThreshold: recs.filter((r) => r.bpm >= threshold).length,
    daily: dailyAverages(recs),
    range,
    adherence: adherence(meds, data.taken[pet.id] || {}, range),
    symptomCounts,
    notes: data.symptoms
      .filter((s) => s.petId === pet.id && inRange.has(dayKey(s.at)) && s.note)
      .sort((a, b) => b.at - a.at),
  };
}

export function emptyData() {
  return { version: 1, pets: [], records: [], meds: [], taken: {}, symptoms: [], activePetId: null, activeDays: [], reportViews: 0 };
}

/** 앱을 연 날을 기록한다(중복 없이, 최근 400일까지). 바뀌었으면 true. */
export function markActiveDay(data, key) {
  if (data.activeDays.includes(key)) return false;
  data.activeDays.push(key);
  data.activeDays.sort();
  if (data.activeDays.length > 400) data.activeDays.splice(0, data.activeDays.length - 400);
  return true;
}

/**
 * 베타 검증용 익명 사용 요약. 이름·메모 같은 개인 내용은 담지 않는다.
 * retained7: 첫 사용 후 7~13일 사이에 다시 연 적이 있는가 (7일 리텐션)
 */
export function usageSummary(data, todayKey) {
  const days = data.activeDays;
  const first = days[0] || todayKey;
  const sinceDays = Math.round((Date.parse(todayKey) - Date.parse(first)) / 864e5);
  const w7 = new Set(lastNDays(todayKey, 7));
  const d7 = addDays(first, 7);
  const d13 = addDays(first, 13);
  return {
    firstUse: first,
    sinceDays,
    activeDays: days.length,
    activeLast7: days.filter((k) => w7.has(k)).length,
    retained7: sinceDays >= 7 ? days.some((k) => k >= d7 && k <= d13) : null,
    pets: data.pets.length,
    species: [...new Set(data.pets.map((p) => p.species || 'dog'))].join('+') || '-',
    records: data.records.length,
    meds: data.meds.length,
    symptoms: data.symptoms.length,
    reportViews: data.reportViews || 0,
  };
}

/** 가져온 백업을 검증·정규화한다. 잘못된 형식이면 예외를 던진다. */
export function normalizeData(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.pets)) throw new Error('올바른 백업 파일이 아닙니다.');
  const base = emptyData();
  return {
    ...base,
    ...raw,
    records: Array.isArray(raw.records) ? raw.records : [],
    meds: Array.isArray(raw.meds) ? raw.meds : [],
    symptoms: Array.isArray(raw.symptoms) ? raw.symptoms : [],
    taken: raw.taken && typeof raw.taken === 'object' ? raw.taken : {},
    activeDays: Array.isArray(raw.activeDays) ? raw.activeDays.filter((k) => typeof k === 'string') : [],
    reportViews: Number(raw.reportViews) || 0,
  };
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
