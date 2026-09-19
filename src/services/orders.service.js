import {
  db,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  query,
  orderBy
} from './firebase.js';
import { generateOrderNumber, generateId } from '../utils/formatters.js';
import { inventoryService } from './inventory.service.js';

const LOCAL_ORDERS_KEY = 'ponio_pos_orders_v1';

class OrdersService {
  constructor() {
    this._initLocalOrders();
  }

  _initLocalOrders() {
    try {
      const stored = localStorage.getItem(LOCAL_ORDERS_KEY);
      if (!stored) {
        localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify([]));
      } else {
        const parsed = JSON.parse(stored);
        const filtered = Array.isArray(parsed)
          ? parsed.filter(o => o.id !== 'ord_80291' && o.orderNumber !== 'ORD-20261012-001')
          : [];
        if (filtered.length !== parsed.length) {
          localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(filtered));
        }
      }
    } catch {
      localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify([]));
    }
  }

  _getLocalOrders() {
    try {
      const data = localStorage.getItem(LOCAL_ORDERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveLocalOrders(orders) {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
  }

  async processCheckout({
    items,
    totalAmount,
    amountTendered,
    change,
    paymentMethod = 'CASH',
    cashierId = 'user_abc123',
    cashierName = 'Maria Santos'
  }) {
    if (!items || items.length === 0) {
      throw new Error('Cart is empty. Cannot process checkout.');
    }

    if (amountTendered < totalAmount) {
      throw new Error('Tendered amount is insufficient.');
    }

    const orderNumber = generateOrderNumber();
    const orderData = {
      orderNumber,
      cashierId,
      cashierName,
      items: items.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice || item.sellingPrice,
        subtotal: item.subtotal || (item.quantity * (item.unitPrice || item.sellingPrice)),
      })),
      totalAmount,
      amountTendered,
      change,
      paymentMethod,
      status: 'COMPLETED',
    };

    if (db) {
      try {
        const orderResult = await runTransaction(db, async (transaction) => {
          const productDocs = [];
          for (const item of items) {
            const productRef = doc(db, 'products', item.productId);
            const productSnap = await transaction.get(productRef);

            if (!productSnap.exists()) {
              throw new Error(`Product "${item.name}" not found in inventory.`);
            }

            const currentStock = productSnap.data().stock || 0;
            if (currentStock < item.quantity) {
              throw new Error(`Insufficient stock for "${item.name}". Available: ${currentStock}, Requested: ${item.quantity}`);
            }

            productDocs.push({
              ref: productRef,
              currentStock,
              requestedQty: item.quantity,
              name: item.name,
              productId: item.productId,
            });
          }

          for (const p of productDocs) {
            const newStock = p.currentStock - p.requestedQty;
            transaction.update(p.ref, {
              stock: newStock,
              updatedAt: serverTimestamp(),
            });
          }

          const newOrderRef = doc(collection(db, 'orders'));
          transaction.set(newOrderRef, {
            ...orderData,
            createdAt: serverTimestamp(),
          });

          return { id: newOrderRef.id, ...orderData, createdAt: new Date() };
        });

        for (const item of items) {
          inventoryService.adjustStock({
            productId: item.productId,
            changeType: 'SALE',
            quantityChanged: -item.quantity,
            reason: `Sale Order #${orderNumber}`,
            userId: cashierId,
          }).catch(err => console.warn('Could not record stock log for sale:', err));
        }

        return orderResult;
      } catch (err) {
        console.warn('[OrdersService] Firestore transaction failed, falling back to local store', err);
        if (err.message.includes('Insufficient stock') || err.message.includes('not found')) {
          throw err;
        }
      }
    }

    const localProducts = inventoryService._getLocalProducts();

    for (const item of items) {
      const prod = localProducts.find(p => p.id === item.productId);
      if (!prod) {
        throw new Error(`Product "${item.name}" not found in inventory.`);
      }
      if (prod.stock < item.quantity) {
        throw new Error(`Insufficient stock for "${item.name}". Available: ${prod.stock}, Requested: ${item.quantity}`);
      }
    }

    for (const item of items) {
      const prod = localProducts.find(p => p.id === item.productId);
      const prevStock = prod.stock;
      prod.stock = Math.max(0, prod.stock - item.quantity);
      prod.updatedAt = new Date();

      inventoryService.adjustStock({
        productId: item.productId,
        changeType: 'SALE',
        quantityChanged: -item.quantity,
        reason: `Sale Order #${orderNumber}`,
        userId: cashierId,
      });
    }
    inventoryService._saveLocalProducts(localProducts);

    const localId = generateId('ord');
    const createdOrder = {
      id: localId,
      ...orderData,
      createdAt: new Date(),
    };

    const orders = this._getLocalOrders();
    orders.unshift(createdOrder);
    this._saveLocalOrders(orders);

    return createdOrder;
  }

  async getOrders() {
    if (db) {
      try {
        const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (err) {
        console.warn('[OrdersService] Error getting orders from Firestore, using local fallback', err);
      }
    }

    return this._getLocalOrders();
  }

  async getOrderById(orderId) {
    if (db) {
      try {
        const docSnap = await getDoc(doc(db, 'orders', orderId));
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() };
        }
      } catch (err) {
        console.warn('[OrdersService] Error getting order by ID from Firestore', err);
      }
    }

    const orders = this._getLocalOrders();
    return orders.find(o => o.id === orderId) || null;
  }
}

export const ordersService = new OrdersService();
