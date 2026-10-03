import { emptyData, normalizeData } from './core.js';

const KEY = 'simjang-jikimi:v1';

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeData(JSON.parse(raw)) : emptyData();
  } catch {
    return emptyData();
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
