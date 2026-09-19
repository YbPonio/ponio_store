import {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from './firebase.js';
import { usersService } from './users.service.js';

class AuthService {
  constructor() {
    this.currentUser = this.getSavedSessionUser();
    this.isInitialized = !auth;
    this.listeners = new Set();
    this.init();
  }

  async init() {
    if (auth && typeof onAuthStateChanged === 'function') {
      try {
        const timeoutId = setTimeout(() => {
          if (!this.isInitialized) {
            this.isInitialized = true;
            this.notify();
          }
        }, 1500);

        onAuthStateChanged(auth, async (firebaseUser) => {
          clearTimeout(timeoutId);
          if (firebaseUser) {
            const rawUser = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Cashier'),
              email: firebaseUser.email || '',
              provider: firebaseUser.providerData?.[0]?.providerId || 'password',
              isAnonymous: firebaseUser.isAnonymous,
            };
            await usersService.seedAdminInFirestore();
            const profile = await usersService.syncUserProfile(rawUser);
            this.currentUser = {
              ...rawUser,
              name: profile?.name || rawUser.name,
              role: profile?.role || 'CASHIER',
              status: profile?.status || 'PENDING',
            };
            this.saveSessionUser(this.currentUser);
          } else {
            const savedSession = this.getSavedSessionUser();
            this.currentUser = savedSession || null;
            if (this.currentUser) {
              await this.refreshCurrentUserProfile();
            }
          }
          this.isInitialized = true;
          this.notify();
        });
        return;
      } catch (err) {
        console.warn('[AuthService] onAuthStateChanged error:', err);
      }
    }

    const savedSession = this.getSavedSessionUser();
    this.currentUser = savedSession || null;
    if (this.currentUser) {
      await this.refreshCurrentUserProfile();
    }
    this.isInitialized = true;
    this.notify();
  }

  getSavedSessionUser() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('poniostore_session_user');
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  saveSessionUser(user) {
    try {
      if (typeof localStorage !== 'undefined') {
        if (user) {
          localStorage.setItem('poniostore_session_user', JSON.stringify(user));
        } else {
          localStorage.removeItem('poniostore_session_user');
        }
      }
    } catch (err) {
      console.warn('[AuthService] Storage error:', err);
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return Boolean(this.currentUser);
  }

  isApproved() {
    return Boolean(this.currentUser && this.currentUser.status === 'APPROVED');
  }

  isAdmin() {
    return Boolean(this.currentUser && String(this.currentUser.role).toUpperCase() === 'ADMIN');
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.currentUser, this.isInitialized);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      cb(this.currentUser, this.isInitialized);
    }
  }

  async refreshCurrentUserProfile() {
    if (!this.currentUser || !this.currentUser.id) {
      return null;
    }
    const profile = await usersService.getUserProfile(this.currentUser.id);
    if (profile) {
      this.currentUser = {
        ...this.currentUser,
        name: profile.name || this.currentUser.name,
        role: profile.role || this.currentUser.role,
        status: profile.status || this.currentUser.status,
      };
      this.saveSessionUser(this.currentUser);
      this.notify();
    }
    return this.currentUser;
  }

  async signInWithEmail(email, password) {
    if (!email || !password) {
      throw new Error('Please enter both email and password.');
    }

    if (auth) {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      const rawUser = {
        id: user.uid,
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        provider: 'password',
        isAnonymous: user.isAnonymous,
      };
      const profile = await usersService.syncUserProfile(rawUser);
      this.currentUser = {
        ...rawUser,
        name: profile?.name || rawUser.name,
        role: profile?.role || 'CASHIER',
        status: profile?.status || 'PENDING',
      };
      this.saveSessionUser(this.currentUser);
      this.notify();
      return this.currentUser;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingProfile = (await usersService.getUsers()).find(u => (u.email || '').toLowerCase() === normalizedEmail);
    const rawUser = {
      id: existingProfile ? existingProfile.id : `usr_${Math.floor(1000 + Math.random() * 9000)}`,
      name: existingProfile ? existingProfile.name : email.split('@')[0],
      email: normalizedEmail,
      provider: 'local',
      isAnonymous: false,
    };
    const profile = await usersService.syncUserProfile(rawUser, rawUser.name);
    this.currentUser = {
      ...rawUser,
      name: profile?.name || rawUser.name,
      role: profile?.role || 'CASHIER',
      status: profile?.status || 'PENDING',
    };
    this.saveSessionUser(this.currentUser);
    this.notify();
    return this.currentUser;
  }

  async signUpWithEmail(email, password, displayName = '') {
    if (!email || !password) {
      throw new Error('Please provide both email and password.');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const name = displayName.trim() || email.split('@')[0];

    if (auth) {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      if (displayName && typeof updateProfile === 'function') {
        try {
          await updateProfile(user, { displayName: name });
        } catch (err) {
          console.warn('[AuthService] Failed to set displayName:', err);
        }
      }
      const rawUser = {
        id: user.uid,
        name: name,
        email: user.email,
        provider: 'password',
        isAnonymous: user.isAnonymous,
      };
      const profile = await usersService.syncUserProfile(rawUser, name);
      this.currentUser = {
        ...rawUser,
        name: profile?.name || name,
        role: profile?.role || 'CASHIER',
        status: profile?.status || 'PENDING',
      };
      this.saveSessionUser(this.currentUser);
      this.notify();
      return this.currentUser;
    }

    const rawUser = {
      id: `usr_${Math.floor(1000 + Math.random() * 9000)}`,
      name: name,
      email: email.trim(),
      provider: 'local',
      isAnonymous: false,
    };
    const profile = await usersService.syncUserProfile(rawUser, name);
    this.currentUser = {
      ...rawUser,
      name: profile?.name || name,
      role: profile?.role || 'CASHIER',
      status: profile?.status || 'PENDING',
    };
    this.saveSessionUser(this.currentUser);
    this.notify();
    return this.currentUser;
  }

  async signInWithGoogle() {
    if (auth && typeof signInWithPopup === 'function' && typeof GoogleAuthProvider === 'function') {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const rawUser = {
        id: user.uid,
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'Staff Member'),
        email: user.email || '',
        provider: 'google.com',
        isAnonymous: user.isAnonymous,
      };
      const profile = await usersService.syncUserProfile(rawUser);
      this.currentUser = {
        ...rawUser,
        name: profile?.name || rawUser.name,
        role: profile?.role || 'CASHIER',
        status: profile?.status || 'PENDING',
      };
      this.saveSessionUser(this.currentUser);
      this.notify();
      return this.currentUser;
    }

    throw new Error('Google sign-in requires an active Firebase Authentication connection.');
  }

  async signOutUser() {
    if (auth && typeof signOut === 'function') {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn('[AuthService] signOut error:', err);
      }
    }
    this.currentUser = null;
    this.saveSessionUser(null);
    this.notify();
  }

  switchUser(name) {
    if (this.currentUser) {
      this.currentUser.name = name;
      this.saveSessionUser(this.currentUser);
      this.notify();
    }
    return this.currentUser;
  }
}

export const authService = new AuthService();
