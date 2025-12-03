import { QueryHistoryItem } from '../types';

const STORAGE_KEY = 'psql-buddy-history';

export const getHistory = (): QueryHistoryItem[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load history", e);
    return [];
  }
};

export const addToHistory = (item: Omit<QueryHistoryItem, 'id' | 'timestamp'>) => {
  try {
    const history = getHistory();
    const newItem: QueryHistoryItem = {
      ...item,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    
    // Keep only last 50 items
    const updated = [newItem, ...history].slice(0, 50);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return newItem;
  } catch (e) {
    console.error("Failed to save history", e);
  }
};

export const clearHistory = () => {
  localStorage.removeItem(STORAGE_KEY);
};