/**
 * FUTFIELD Offline Match Scores & Fixtures IndexedDB Caching Engine
 * Enables users to view recent match scores even when internet connection is interrupted.
 */

const DB_NAME = 'FutfieldOfflineCacheDB';
const DB_VERSION = 1;
const STORE_MATCHES = 'matchScores';
const STORE_FIXTURES = 'fixtures';

export function openOfflineCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_MATCHES)) {
        db.createObjectStore(STORE_MATCHES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FIXTURES)) {
        db.createObjectStore(STORE_FIXTURES, { keyPath: 'id' });
      }
    };
  });
}

export async function saveCachedMatches(matches: any[]): Promise<void> {
  try {
    const db = await openOfflineCacheDB();
    const tx = db.transaction(STORE_MATCHES, 'readwrite');
    const store = tx.objectStore(STORE_MATCHES);
    for (const match of matches) {
      store.put({ ...match, cachedAt: Date.now() });
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[Offline Cache] Failed to save matches to IndexedDB:', err);
  }
}

export async function getCachedMatches(): Promise<any[]> {
  try {
    const db = await openOfflineCacheDB();
    const tx = db.transaction(STORE_MATCHES, 'readonly');
    const store = tx.objectStore(STORE_MATCHES);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[Offline Cache] Failed to get cached matches from IndexedDB:', err);
    return [];
  }
}

export async function saveCachedFixtures(fixtures: any[]): Promise<void> {
  try {
    const db = await openOfflineCacheDB();
    const tx = db.transaction(STORE_FIXTURES, 'readwrite');
    const store = tx.objectStore(STORE_FIXTURES);
    for (const fixture of fixtures) {
      store.put({ ...fixture, cachedAt: Date.now() });
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[Offline Cache] Failed to save fixtures to IndexedDB:', err);
  }
}

export async function getCachedFixtures(): Promise<any[]> {
  try {
    const db = await openOfflineCacheDB();
    const tx = db.transaction(STORE_FIXTURES, 'readonly');
    const store = tx.objectStore(STORE_FIXTURES);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[Offline Cache] Failed to get cached fixtures from IndexedDB:', err);
    return [];
  }
}
