import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  breathsPerMinute, dayKey, addDays, lastNDays, dailyAverages, stats, assess,
  dosesForDay, adherence, buildReport, emptyData, normalizeData,
} from '../app/js/core.js';

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();

test('breathsPerMinute scales taps to one minute', () => {
  assert.equal(breathsPerMinute(10, 30), 20);
  assert.equal(breathsPerMinute(22, 60), 22);
  assert.equal(breathsPerMinute(7, 15), 28);
  assert.equal(breathsPerMinute(5, 0), 0);
});

test('day helpers', () => {
  assert.equal(dayKey(at(2026, 3, 5)), '2026-03-05');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.deepEqual(lastNDays('2026-01-02', 3), ['2025-12-31', '2026-01-01', '2026-01-02']);
});

test('dailyAverages and stats', () => {
  const recs = [{ at: at(2026, 1, 1, 9), bpm: 20 }, { at: at(2026, 1, 1, 22), bpm: 24 }, { at: at(2026, 1, 2), bpm: 18 }];
  const avgs = dailyAverages(recs);
  assert.equal(avgs.get('2026-01-01'), 22);
  assert.equal(avgs.get('2026-01-02'), 18);
  assert.deepEqual(stats([20, 24, 18]), { count: 3, avg: 21, min: 18, max: 24 });
  assert.equal(stats([]), null);
});

test('assess: none, ok, warn, danger', () => {
  assert.equal(assess([]).level, 'none');
  assert.equal(assess([{ at: 1, bpm: 20 }], 30, '1970-01-01').level, 'ok');
  assert.equal(assess([{ at: 1, bpm: 20 }, { at: 2, bpm: 32 }]).level, 'warn');
  assert.equal(assess([{ at: 1, bpm: 31 }, { at: 2, bpm: 33 }]).level, 'danger');
  // 순서가 섞여 있어도 시간순으로 판단
  assert.equal(assess([{ at: 2, bpm: 20 }, { at: 1, bpm: 33 }], 30, '1970-01-01').level, 'ok');
  // 사용자 지정 기준
  assert.equal(assess([{ at: 1, bpm: 26 }], 25).level, 'warn');
});

test('assess: rising trend below threshold', () => {
  const recs = [];
  for (let d = 1; d <= 7; d++) recs.push({ at: at(2026, 5, d), bpm: 18 });
  recs.push({ at: at(2026, 5, 9), bpm: 24 }, { at: at(2026, 5, 10), bpm: 25 });
  const r = assess(recs, 30, '2026-05-10');
  assert.equal(r.level, 'rising');
  assert.equal(r.baseAvg, 18);
});

test('doses and adherence', () => {
  const meds = [
    { id: 'a', name: '피모벤단', times: ['20:00', '08:00'] },
    { id: 'b', name: '이뇨제', times: ['08:00'] },
    { id: 'c', name: '중단약', times: ['09:00'], active: false },
  ];
  const doses = dosesForDay(meds);
  assert.deepEqual(doses.map((d) => d.slot), ['a@08:00', 'b@08:00', 'a@20:00']);
  const taken = { '2026-01-01': { 'a@08:00': 1, 'b@08:00': 1, 'a@20:00': 1 }, '2026-01-02': { 'a@08:00': 1 } };
  assert.deepEqual(adherence(meds, taken, ['2026-01-01', '2026-01-02']), { planned: 6, done: 4, pct: 67 });
  assert.equal(adherence([], taken, ['2026-01-01']), null);
  // 등록일 이전 날짜는 계획에 넣지 않는다
  const fresh = [{ id: 'a', name: 'x', times: ['08:00'], createdAt: new Date(2026, 0, 2, 7).getTime() }];
  assert.deepEqual(adherence(fresh, taken, ['2026-01-01', '2026-01-02']), { planned: 1, done: 1, pct: 100 });
});

test('buildReport filters by pet and range', () => {
  const data = emptyData();
  const pet = { id: 'p1', name: '콩이', threshold: 30 };
  data.pets.push(pet, { id: 'p2', name: '다른개' });
  data.records.push(
    { petId: 'p1', at: at(2026, 6, 30), bpm: 22 },
    { petId: 'p1', at: at(2026, 6, 29), bpm: 34 },
    { petId: 'p1', at: at(2026, 4, 1), bpm: 50 }, // 범위 밖
    { petId: 'p2', at: at(2026, 6, 30), bpm: 60 }, // 다른 반려동물
  );
  data.symptoms.push({ petId: 'p1', at: at(2026, 6, 30), tags: ['cough'], note: '밤에 기침 2번' });
  const r = buildReport(pet, data, '2026-06-30', 30);
  assert.equal(r.from, '2026-06-01');
  assert.deepEqual(r.srr, { count: 2, avg: 28, min: 22, max: 34 });
  assert.equal(r.overThreshold, 1);
  assert.equal(r.symptomCounts.cough, 1);
  assert.equal(r.notes.length, 1);
});

test('normalizeData rejects junk and fills defaults', () => {
  assert.throws(() => normalizeData(null));
  assert.throws(() => normalizeData({ foo: 1 }));
  const d = normalizeData({ pets: [{ id: 'x' }] });
  assert.deepEqual(d.records, []);
  assert.deepEqual(d.taken, {});
});
