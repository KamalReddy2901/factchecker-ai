import type { HistoryItem, ApiKeys } from './types';

const HISTORY_KEY = 'factcheck_history';
const API_KEYS_KEY = 'api_keys';
const USAGE_KEY = 'daily_usage';

interface DailyUsage {
  date: string;
  count: number;
}

export async function getApiKeys(): Promise<ApiKeys | null> {
  const result = await chrome.storage.local.get(API_KEYS_KEY);
  return result[API_KEYS_KEY] ?? null;
}

export async function setApiKeys(keys: ApiKeys): Promise<void> {
  await chrome.storage.local.set({ [API_KEYS_KEY]: keys });
}

export async function getGeminiKey(): Promise<string | null> {
  const keys = await getApiKeys();
  return keys?.gemini ?? null;
}

export async function getHistory(): Promise<HistoryItem[]> {
  const result = await chrome.storage.local.get(HISTORY_KEY);
  return result[HISTORY_KEY] ?? [];
}

export async function addToHistory(item: HistoryItem): Promise<void> {
  const history = await getHistory();
  const updated = [item, ...history].slice(0, 100);
  await chrome.storage.local.set({ [HISTORY_KEY]: updated });
}

export async function deleteFromHistory(id: string): Promise<void> {
  const history = await getHistory();
  await chrome.storage.local.set({
    [HISTORY_KEY]: history.filter((h) => h.id !== id),
  });
}

export async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
}

export async function incrementUsage(): Promise<number> {
  const today = new Date().toDateString();
  const result = await chrome.storage.local.get(USAGE_KEY);
  const usage: DailyUsage = result[USAGE_KEY] ?? { date: today, count: 0 };
  const newUsage =
    usage.date === today
      ? { date: today, count: usage.count + 1 }
      : { date: today, count: 1 };
  await chrome.storage.local.set({ [USAGE_KEY]: newUsage });
  return newUsage.count;
}

export async function getDailyUsage(): Promise<number> {
  const today = new Date().toDateString();
  const result = await chrome.storage.local.get(USAGE_KEY);
  const usage: DailyUsage = result[USAGE_KEY] ?? { date: today, count: 0 };
  return usage.date === today ? usage.count : 0;
}
