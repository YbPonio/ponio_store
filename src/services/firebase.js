import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  where
} from 'firebase/firestore';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || '',
};

export const isConfigValid = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes('ExampleKey')
);

let app = null;
let db = null;
let auth = null;

if (isConfigValid) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const databaseId = env.VITE_FIREBASE_DATABASE_ID || 'ponio-store';
    try {
      db = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true
      }, databaseId);
    } catch {
      db = getFirestore(app, databaseId);
    }
    auth = getAuth(app);
    console.info('[Firebase] Connected successfully to Cloud Firestore & Auth:', firebaseConfig.projectId);
  } catch (err) {
    console.warn('[Firebase] Initialization error. Falling back to local store.', err);
    db = null;
    auth = null;
  }
} else {
  console.info('[Firebase] No production credentials found. Running in resilient Local Storage Mode.');
}

export {
  app,
  db,
  auth,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  where,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
};

export const INITIAL_SEED_PRODUCTS = [
  {
    id: "prod_1001",
    barcode: "480000000001",
    name: "Barako Ground Coffee 250g",
    category: "Beverages",
    costPrice: 120.00,
    sellingPrice: 185.00,
    stock: 42,
    lowStockThreshold: 10,
    isActive: true,
    createdAt: new Date('2026-09-01T08:00:00Z'),
    updatedAt: new Date('2026-09-01T08:00:00Z'),
  },
  {
    id: "prod_1002",
    barcode: "480000000002",
    name: "Pure Green Tea Leaves 100g",
    category: "Beverages",
    costPrice: 85.00,
    sellingPrice: 140.00,
    stock: 24,
    lowStockThreshold: 8,
    isActive: true,
    createdAt: new Date('2026-09-02T09:30:00Z'),
    updatedAt: new Date('2026-09-02T09:30:00Z'),
  },
  {
    id: "prod_1003",
    barcode: "480000000003",
    name: "Artisan Chocolate Tablea 200g",
    category: "Snacks",
    costPrice: 110.00,
    sellingPrice: 175.00,
    stock: 18,
    lowStockThreshold: 10,
    isActive: true,
    createdAt: new Date('2026-09-03T10:15:00Z'),
    updatedAt: new Date('2026-09-03T10:15:00Z'),
  },
  {
    id: "prod_1004",
    barcode: "480000000004",
    name: "Organic Honey 350ml",
    category: "Groceries",
    costPrice: 190.00,
    sellingPrice: 280.00,
    stock: 7,
    lowStockThreshold: 10,
    isActive: true,
    createdAt: new Date('2026-09-04T11:00:00Z'),
    updatedAt: new Date('2026-09-04T11:00:00Z'),
  },
  {
    id: "prod_1005",
    barcode: "480000000005",
    name: "Crispy Banana Chips 150g",
    category: "Snacks",
    costPrice: 45.00,
    sellingPrice: 75.00,
    stock: 55,
    lowStockThreshold: 15,
    isActive: true,
    createdAt: new Date('2026-09-05T12:00:00Z'),
    updatedAt: new Date('2026-09-05T12:00:00Z'),
  },
  {
    id: "prod_1006",
    barcode: "480000000006",
    name: "Organic Coconut Vinegar 500ml",
    category: "Groceries",
    costPrice: 60.00,
    sellingPrice: 95.00,
    stock: 12,
    lowStockThreshold: 5,
    isActive: true,
    createdAt: new Date('2026-09-06T13:45:00Z'),
    updatedAt: new Date('2026-09-06T13:45:00Z'),
  },
  {
    id: "prod_1007",
    barcode: "480000000007",
    name: "Benguet Arabica Beans 500g",
    category: "Beverages",
    costPrice: 280.00,
    sellingPrice: 420.00,
    stock: 4,
    lowStockThreshold: 10,
    isActive: true,
    createdAt: new Date('2026-09-07T14:10:00Z'),
    updatedAt: new Date('2026-09-07T14:10:00Z'),
  },
  {
    id: "prod_1008",
    barcode: "480000000008",
    name: "Sea Salt Roasted Cashews 120g",
    category: "Snacks",
    costPrice: 95.00,
    sellingPrice: 150.00,
    stock: 0,
    lowStockThreshold: 8,
    isActive: true,
    createdAt: new Date('2026-09-08T15:20:00Z'),
    updatedAt: new Date('2026-09-08T15:20:00Z'),
  }
];
