import {
  db,
  collection,
  doc,
  getDocs,
  getDoc,
  getDocsFromCache,
  getDocFromCache,
  setDoc,
  updateDoc,
  onSnapshot
} from './firebase.js';

const STORAGE_KEY = 'poniostore_users_db';

const INITIAL_ADMIN = {
  id: 'usr_admin_001',
  email: 'ybponio@gmail.com',
  name: 'Ycker',
  role: 'ADMIN',
  status: 'APPROVED',
  provider: 'password',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  approvedAt: '2026-09-01T00:00:00.000Z',
  approvedBy: 'system',
};

const INITIAL_USERS = [
  INITIAL_ADMIN,
  {
    id: 'usr_admin_002',
    email: 'admin@poniostore.ph',
    name: 'System Administrator',
    role: 'ADMIN',
    status: 'APPROVED',
    provider: 'password',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    approvedAt: '2026-09-01T00:00:00.000Z',
    approvedBy: 'system',
  }
];

class UsersService {
  constructor() {
    this.listeners = new Set();
    this.cachedUsers = null;
    this.initLocalStore();
  }

  initLocalStore() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_USERS));
        } else {
          const list = JSON.parse(stored);
          let modified = false;
          for (const initUser of INITIAL_USERS) {
            if (!list.some(u => u.email === initUser.email)) {
              list.push(initUser);
              modified = true;
            }
          }
          if (modified) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
          }
        }
      }
    } catch (err) {
      console.warn('[UsersService] Local store init error:', err);
    }
  }

  getLocalUsers() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch {
      return INITIAL_USERS;
    }
    return INITIAL_USERS;
  }

  saveLocalUsers(users) {
    this.cachedUsers = users;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
      }
    } catch (err) {
      console.warn('[UsersService] Local save error:', err);
    }
    this.notify();
  }

  async seedAdminInFirestore() {
    if (!db) return false;
    try {
      const docRef = doc(db, 'users', INITIAL_ADMIN.id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, INITIAL_ADMIN);
      } else {
        await setDoc(docRef, INITIAL_ADMIN, { merge: true });
      }
      return true;
    } catch (err) {
      console.warn('[UsersService] Firestore seed admin:', err);
      return false;
    }
  }

  async getUsers(forceRefresh = false) {
    if (!forceRefresh && this.cachedUsers && this.cachedUsers.length > 0) {
      return this.cachedUsers;
    }

    if (db) {
      try {
        const colRef = collection(db, 'users');
        if (!forceRefresh) {
          try {
            const cachedSnap = await getDocsFromCache(colRef);
            if (!cachedSnap.empty) {
              const list = [];
              cachedSnap.forEach(docSnap => {
                list.push({ id: docSnap.id, ...docSnap.data() });
              });
              this.cachedUsers = list;
              return list;
            }
          } catch {}
        }

        const snapshot = await getDocs(colRef);
        if (!snapshot.empty) {
          const list = [];
          snapshot.forEach(docSnap => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          const hasAdmin = list.some(u => u.email === INITIAL_ADMIN.email || u.id === INITIAL_ADMIN.id);
          if (!hasAdmin) {
            await this.seedAdminInFirestore();
            list.unshift(INITIAL_ADMIN);
          }
          this.cachedUsers = list;
          return list;
        } else {
          await this.seedAdminInFirestore();
          this.cachedUsers = [INITIAL_ADMIN];
          return [INITIAL_ADMIN];
        }
      } catch (err) {
        console.warn('[UsersService] Firestore getUsers error:', err);
      }
    }
    return this.getLocalUsers();
  }

  async getUserProfile(uid) {
    if (!uid) return null;

    if (this.cachedUsers) {
      const match = this.cachedUsers.find(u => u.id === uid);
      if (match) return match;
    }

    if (db) {
      try {
        const docRef = doc(db, 'users', uid);
        try {
          const cachedSnap = await getDocFromCache(docRef);
          if (cachedSnap.exists()) {
            return { id: cachedSnap.id, ...cachedSnap.data() };
          }
        } catch {}

        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() };
        }
      } catch (err) {
        console.warn('[UsersService] Firestore getUserProfile error:', err);
      }
    }

    const localUsers = this.getLocalUsers();
    return localUsers.find(u => u.id === uid) || null;
  }

  async syncUserProfile(firebaseUser, defaultName = '') {
    if (!firebaseUser || !firebaseUser.id) {
      return null;
    }

    const uid = firebaseUser.id;
    const existing = await this.getUserProfile(uid);
    if (existing) {
      return existing;
    }

    const email = (firebaseUser.email || '').toLowerCase().trim();
    const isAdminDefault = email === 'admin@poniostore.ph' || email === 'ybponio@gmail.com';

    const newProfile = {
      id: uid,
      email: email,
      name: defaultName || firebaseUser.name || (email ? email.split('@')[0] : 'Staff Member'),
      role: isAdminDefault ? 'ADMIN' : 'NONE',
      status: isAdminDefault ? 'APPROVED' : 'PENDING',
      provider: firebaseUser.provider || 'password',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvedAt: isAdminDefault ? new Date().toISOString() : null,
      approvedBy: isAdminDefault ? 'system' : null,
    };

    if (db) {
      try {
        await setDoc(doc(db, 'users', uid), newProfile);
      } catch (err) {
        console.warn('[UsersService] Failed to save profile to Firestore:', err);
      }
    }

    const localList = this.getLocalUsers();
    const filtered = localList.filter(u => u.id !== uid);
    filtered.push(newProfile);
    this.saveLocalUsers(filtered);

    return newProfile;
  }

  async approveUser(uid, adminId = 'admin', assignedRole = 'CASHIER') {
    const now = new Date().toISOString();
    const existing = await this.getUserProfile(uid);
    const roleToAssign = assignedRole || (existing?.role && existing.role !== 'NONE' ? existing.role : 'CASHIER');

    const updates = {
      status: 'APPROVED',
      role: roleToAssign,
      approvedBy: adminId,
      approvedAt: now,
      updatedAt: now,
    };

    if (db) {
      try {
        await updateDoc(doc(db, 'users', uid), updates);
      } catch (err) {
        console.warn('[UsersService] Firestore approveUser error:', err);
      }
    }

    const localUsers = this.getLocalUsers();
    const userIndex = localUsers.findIndex(u => u.id === uid);
    if (userIndex !== -1) {
      localUsers[userIndex] = { ...localUsers[userIndex], ...updates };
      this.saveLocalUsers(localUsers);
      return localUsers[userIndex];
    }
    return null;
  }

  async rejectUser(uid, adminId = 'admin') {
    const now = new Date().toISOString();
    const updates = {
      status: 'REJECTED',
      approvedBy: adminId,
      approvedAt: now,
      updatedAt: now,
    };

    if (db) {
      try {
        await updateDoc(doc(db, 'users', uid), updates);
      } catch (err) {
        console.warn('[UsersService] Firestore rejectUser error:', err);
      }
    }

    const localUsers = this.getLocalUsers();
    const userIndex = localUsers.findIndex(u => u.id === uid);
    if (userIndex !== -1) {
      localUsers[userIndex] = { ...localUsers[userIndex], ...updates };
      this.saveLocalUsers(localUsers);
      return localUsers[userIndex];
    }
    return null;
  }

  async updateUserRole(uid, newRole) {
    const validRoles = ['ADMIN', 'MANAGER', 'CASHIER', 'NONE'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role. Valid options: ${validRoles.join(', ')}`);
    }

    const now = new Date().toISOString();
    const updates = {
      role: newRole,
      updatedAt: now,
    };

    if (db) {
      try {
        await updateDoc(doc(db, 'users', uid), updates);
      } catch (err) {
        console.warn('[UsersService] Firestore updateUserRole error:', err);
      }
    }

    const localUsers = this.getLocalUsers();
    const userIndex = localUsers.findIndex(u => u.id === uid);
    if (userIndex !== -1) {
      localUsers[userIndex] = { ...localUsers[userIndex], ...updates };
      this.saveLocalUsers(localUsers);
      return localUsers[userIndex];
    }
    return null;
  }

  subscribeUsers(callback) {
    this.listeners.add(callback);
    this.getUsers().then(users => callback(users));

    if (db) {
      try {
        const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
          const list = [];
          snapshot.forEach(docSnap => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          callback(list.length > 0 ? list : this.getLocalUsers());
        }, (err) => {
          console.warn('[UsersService] onSnapshot error, falling back to local users store:', err);
          callback(this.getLocalUsers());
        });
        return () => {
          unsub();
          this.listeners.delete(callback);
        };
      } catch (err) {
        console.warn('[UsersService] Firestore subscribe error:', err);
      }
    }

    return () => this.listeners.delete(callback);
  }

  notify() {
    const currentList = this.getLocalUsers();
    for (const cb of this.listeners) {
      cb(currentList);
    }
  }
}

export const usersService = new UsersService();
