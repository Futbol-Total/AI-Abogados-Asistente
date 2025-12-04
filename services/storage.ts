import { SavedCase, User } from '../types';

const DB_NAME = 'JurisAI_DB';
const DB_VERSION = 1;
const STORE_CASES = 'cases';
const STORE_USER = 'user';
const SESSION_KEY = 'jurisai_current_user';

// Helper to open DB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject('Error opening database');

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_CASES)) {
        db.createObjectStore(STORE_CASES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_USER)) {
        db.createObjectStore(STORE_USER, { keyPath: 'username' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
  });
};

export const saveLastSession = (username: string) => {
  localStorage.setItem(SESSION_KEY, username);
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const getLastSession = (): string | null => {
  return localStorage.getItem(SESSION_KEY);
};

export const saveUserToDB = async (user: User): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_USER, 'readwrite');
    const store = tx.objectStore(STORE_USER);
    const request = store.put(user);
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Failed to save user');
  });
};

export const getUserFromDB = async (username?: string): Promise<User | null> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_USER, 'readonly');
    const store = tx.objectStore(STORE_USER);
    
    if (username) {
       const request = store.get(username);
       request.onsuccess = () => resolve(request.result || null);
       request.onerror = () => resolve(null);
    } else {
       // Fallback to get first user if no specific username (legacy)
       const request = store.getAll();
       request.onsuccess = () => {
          const users = request.result;
          resolve(users.length > 0 ? users[0] : null);
       };
       request.onerror = () => resolve(null);
    }
  });
};

export const saveCaseToDB = async (caseData: SavedCase): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CASES, 'readwrite');
    const store = tx.objectStore(STORE_CASES);
    const request = store.put(caseData);
    request.onsuccess = () => resolve();
    request.onerror = (e) => {
        console.error("DB Save Error", e);
        reject('Failed to save case');
    };
  });
};

export const getCasesFromDB = async (username: string): Promise<SavedCase[]> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_CASES, 'readonly');
    const store = tx.objectStore(STORE_CASES);
    const request = store.getAll();
    request.onsuccess = () => {
      const allCases = request.result as SavedCase[];
      // Filter by username
      const userCases = allCases.filter(c => c.username === username);
      // Sort by date desc
      userCases.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(userCases);
    };
    request.onerror = () => resolve([]);
  });
};

export const deleteCaseFromDB = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CASES, 'readwrite');
        const store = tx.objectStore(STORE_CASES);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject('Failed to delete');
    });
};