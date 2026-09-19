import {
  db,
  collection,
  doc,
  getDocs,
  getDocsFromCache,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  INITIAL_SEED_PRODUCTS
} from './firebase.js';
import { generateId } from '../utils/formatters.js';

const LOCAL_PRODUCTS_KEY = 'ponio_pos_products_v1';
const LOCAL_LOGS_KEY = 'ponio_pos_stock_logs_v1';

class InventoryService {
  constructor() {
    this.subscribers = new Set();
    this.unsubscribeFirestore = null;
    this.cachedProducts = null;

    if (!db) {
      this._initLocalStorage();
    }
  }

  _initLocalStorage() {
    const existing = localStorage.getItem(LOCAL_PRODUCTS_KEY);
    if (!existing) {
      localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(INITIAL_SEED_PRODUCTS));
    }
    const existingLogs = localStorage.getItem(LOCAL_LOGS_KEY);
    if (!existingLogs) {
      const initialLogs = [
        {
          id: "log_5501",
          productId: "prod_1001",
          changeType: "RESTOCK",
          quantityChanged: 20,
          previousStock: 22,
          newStock: 42,
          reason: "Supplier Delivery Batch #48",
          userId: "user_abc123",
          timestamp: new Date('2026-09-10T14:30:00Z'),
        }
      ];
      localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(initialLogs));
    }
  }

  _getLocalProducts() {
    try {
      const data = localStorage.getItem(LOCAL_PRODUCTS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveLocalProducts(products) {
    this.cachedProducts = products;
    localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(products));
    this._notifySubscribers(products);
  }

  _getLocalLogs() {
    try {
      const data = localStorage.getItem(LOCAL_LOGS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveLocalLogs(logs) {
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(logs));
  }

  _notifySubscribers(products) {
    for (const cb of this.subscribers) {
      cb(products);
    }
  }

  subscribeProducts(callback) {
    this.subscribers.add(callback);

    if (this.cachedProducts && this.cachedProducts.length > 0) {
      callback(this.cachedProducts);
    }

    if (db) {
      try {
        const q = query(collection(db, 'products'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const products = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          this.cachedProducts = products;
          this._saveLocalProducts(products);
          callback(products);
        }, (err) => {
          console.error('[InventoryService] Firestore snapshot error, falling back to local cache', err);
          callback(this._getLocalProducts());
        });
        return () => {
          this.subscribers.delete(callback);
          unsubscribe();
        };
      } catch (err) {
        console.warn('[InventoryService] Could not establish Firestore listener, using local store', err);
      }
    }

    callback(this._getLocalProducts());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  async getProducts(forceRefresh = false) {
    if (!forceRefresh && this.cachedProducts && this.cachedProducts.length > 0) {
      return this.cachedProducts;
    }

    if (db) {
      try {
        const q = query(collection(db, 'products'), orderBy('name'));
        if (!forceRefresh) {
          try {
            const cachedSnap = await getDocsFromCache(q);
            if (!cachedSnap.empty) {
              const products = cachedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
              this.cachedProducts = products;
              return products;
            }
          } catch {}
        }

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const products = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          this.cachedProducts = products;
          return products;
        }
        await this._seedFirestore();
        const seededSnapshot = await getDocs(q);
        const products = seededSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        this.cachedProducts = products;
        return products;
      } catch (err) {
        console.warn('[InventoryService] Error getting products from Firestore. Using local fallback.', err);
      }
    }
    return this._getLocalProducts();
  }

  async _seedFirestore() {
    if (!db) return;
    try {
      for (const item of INITIAL_SEED_PRODUCTS) {
        const { id, ...data } = item;
        await setDoc(doc(db, 'products', id), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      console.info('[InventoryService] Seeded Firestore with initial product catalog.');
    } catch (e) {
      console.error('[InventoryService] Failed seeding Firestore:', e);
    }
  }

  async addProduct(data) {
    const rawBarcode = data.barcode !== undefined && data.barcode !== null ? String(data.barcode).trim() : null;
    const rawCost = data.costPrice !== undefined && data.costPrice !== null && data.costPrice !== '' ? Number(data.costPrice) : null;
    const product = {
      barcode: rawBarcode ? rawBarcode : null,
      name: String(data.name || '').trim(),
      category: String(data.category || 'General').trim(),
      costPrice: rawCost !== null && !isNaN(rawCost) ? rawCost : null,
      sellingPrice: Number(data.sellingPrice) || 0,
      stock: Number(data.stock) || 0,
      lowStockThreshold: Number(data.lowStockThreshold) || 10,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      imageUrl: data.imageUrl ? String(data.imageUrl).trim() : '',
    };

    if (db) {
      try {
        const docRef = await addDoc(collection(db, 'products'), {
          ...product,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { id: docRef.id, ...product };
      } catch (err) {
        console.warn('[InventoryService] addProduct failed on Firestore, saving locally', err);
      }
    }

    const localId = generateId('prod');
    const newProduct = {
      id: localId,
      ...product,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const products = this._getLocalProducts();
    products.push(newProduct);
    this._saveLocalProducts(products);
    return newProduct;
  }

  async updateProduct(id, updates) {
    const cleanUpdates = { ...updates, updatedAt: new Date() };

    if ('barcode' in updates) {
      const rawBarcode = updates.barcode !== undefined && updates.barcode !== null ? String(updates.barcode).trim() : null;
      cleanUpdates.barcode = rawBarcode ? rawBarcode : null;
    }

    if ('costPrice' in updates) {
      const rawCost = updates.costPrice !== undefined && updates.costPrice !== null && updates.costPrice !== '' ? Number(updates.costPrice) : null;
      cleanUpdates.costPrice = rawCost !== null && !isNaN(rawCost) ? rawCost : null;
    }

    if (db) {
      try {
        const docRef = doc(db, 'products', id);
        await updateDoc(docRef, {
          ...cleanUpdates,
          updatedAt: serverTimestamp(),
        });
        return { id, ...cleanUpdates };
      } catch (err) {
        console.warn('[InventoryService] updateProduct failed on Firestore, updating locally', err);
      }
    }

    const products = this._getLocalProducts();
    const index = products.findIndex(p => p.id === id || (p.barcode && p.barcode === id));
    if (index !== -1) {
      products[index] = { ...products[index], ...cleanUpdates };
      this._saveLocalProducts(products);
      return products[index];
    }
    throw new Error(`Product not found: ${id}`);
  }

  async deleteProduct(id) {
    if (db) {
      try {
        await deleteDoc(doc(db, 'products', id));
        return true;
      } catch (err) {
        console.warn('[InventoryService] deleteProduct failed on Firestore, deleting locally', err);
      }
    }

    const products = this._getLocalProducts().filter(p => p.id !== id);
    this._saveLocalProducts(products);
    return true;
  }

  async adjustStock({ productId, changeType, quantityChanged, reason, userId }) {
    let previousStock = 0;
    let newStock = 0;

    const products = this._getLocalProducts();
    const product = products.find(p => p.id === productId);
    if (product) {
      previousStock = product.stock;
      newStock = Math.max(0, previousStock + quantityChanged);
    }

    const logEntry = {
      productId,
      changeType,
      quantityChanged,
      previousStock,
      newStock,
      reason: reason || `Manual stock adjustment (${changeType})`,
      userId: userId || 'user_cashier',
      timestamp: new Date(),
    };

    if (db) {
      try {
        const productRef = doc(db, 'products', productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const currentData = productSnap.data();
          previousStock = currentData.stock || 0;
          newStock = Math.max(0, previousStock + quantityChanged);
          logEntry.previousStock = previousStock;
          logEntry.newStock = newStock;

          await updateDoc(productRef, {
            stock: newStock,
            updatedAt: serverTimestamp(),
          });

          await addDoc(collection(db, 'stock_logs'), {
            ...logEntry,
            timestamp: serverTimestamp(),
          });
          return { previousStock, newStock, log: logEntry };
        }
      } catch (err) {
        console.warn('[InventoryService] adjustStock Firestore error, running local update', err);
      }
    }

    if (product) {
      product.stock = newStock;
      product.updatedAt = new Date();
      this._saveLocalProducts(products);

      const logs = this._getLocalLogs();
      const logId = generateId('log');
      logs.unshift({ id: logId, ...logEntry });
      this._saveLocalLogs(logs);
    }

    return { previousStock, newStock, log: logEntry };
  }

  async getStockLogs(productId = null) {
    if (db) {
      try {
        let q = query(collection(db, 'stock_logs'), orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        if (productId) {
          return logs.filter(l => l.productId === productId);
        }
        return logs;
      } catch (err) {
        console.warn('[InventoryService] Error getting stock logs from Firestore, using local logs', err);
      }
    }

    const logs = this._getLocalLogs();
    if (productId) {
      return logs.filter(l => l.productId === productId);
    }
    return logs;
  }
}

export const inventoryService = new InventoryService();
