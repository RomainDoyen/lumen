/**
 * Brouillon Pack WordPress — IndexedDB (images + métadonnées).
 */
const WP_DRAFT_DB = 'lumen-wp-pack';
const WP_DRAFT_STORE = 'draft';
const WP_DRAFT_KEY = 'current';

class WpPackDraftStore {
  static openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB indisponible'));
        return;
      }
      const req = indexedDB.open(WP_DRAFT_DB, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(WP_DRAFT_STORE)) {
          db.createObjectStore(WP_DRAFT_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  static async save(draft) {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WP_DRAFT_STORE, 'readwrite');
      tx.objectStore(WP_DRAFT_STORE).put(draft, WP_DRAFT_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  static async load() {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WP_DRAFT_STORE, 'readonly');
      const req = tx.objectStore(WP_DRAFT_STORE).get(WP_DRAFT_KEY);
      req.onsuccess = () => {
        db.close();
        resolve(req.result || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  }

  static async clear() {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WP_DRAFT_STORE, 'readwrite');
      tx.objectStore(WP_DRAFT_STORE).delete(WP_DRAFT_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }
}

window.WpPackDraftStore = WpPackDraftStore;
