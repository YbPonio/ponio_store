import { authService } from '../services/auth.service.js';

class Router {
  constructor() {
    this.routes = {
      '/pos': 'pos-view',
      '/inventory': 'inventory-view',
      '/orders': 'orders-view',
      '/users': 'user-management-view',
      '/pending-approval': 'pending-approval-view',
    };
    this.currentRoute = '/pos';
    this.listeners = new Set();
  }

  init() {
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => this.handleRoute());
      if (window.location.hash) {
        const hashPath = window.location.hash.replace(/^#\/?/, '/');
        window.history.replaceState({}, '', hashPath || '/pos');
      }
    }

    authService.subscribe(() => {
      this.handleRoute();
    });

    this.handleRoute();
  }

  handleRoute() {
    if (typeof window === 'undefined') return;

    let path = window.location.pathname || '/pos';
    if (path === '/' || path === '') {
      path = '/pos';
    }

    if (!authService.isAuthenticated()) {
      if (!authService.isInitialized) {
        return;
      }
      this.currentRoute = '/auth';
      if (window.location.pathname !== '/auth') {
        window.history.replaceState({}, '', '/auth');
      }
      this.mountView('auth-view');
      this.notify();
      return;
    }

    const user = authService.getCurrentUser();
    if (!user || user.status === 'PENDING' || user.status === 'REJECTED' || !user.role || user.role === 'NONE') {
      this.currentRoute = '/pending-approval';
      if (window.location.pathname !== '/pending-approval') {
        window.history.replaceState({}, '', '/pending-approval');
      }
      this.mountView('pending-approval-view');
      this.notify();
      return;
    }

    if (path === '/auth' || path === '/pending-approval') {
      path = '/pos';
      window.history.replaceState({}, '', '/pos');
    }

    if (path === '/users' && !authService.isAdmin()) {
      path = '/pos';
      window.history.replaceState({}, '', '/pos');
    }

    if (!this.routes[path]) {
      path = '/pos';
      window.history.replaceState({}, '', '/pos');
    }

    const tagName = this.routes[path] || 'pos-view';
    this.currentRoute = path;
    this.mountView(tagName);
    this.notify();
  }

  mountView(tagName) {
    if (typeof document === 'undefined') return;
    const container = document.getElementById('router-view');
    if (!container) return;

    const currentElem = container.firstElementChild;
    if (currentElem && currentElem.tagName.toLowerCase() === tagName) {
      return;
    }

    container.innerHTML = '';
    const newView = document.createElement(tagName);
    newView.className = 'w-full h-full flex flex-col overflow-hidden';
    container.appendChild(newView);
  }

  navigate(path) {
    if (typeof window === 'undefined') return;
    const cleanPath = path.startsWith('#') ? path.replace(/^#\/?/, '/') : path;
    if (cleanPath === '/users' && !authService.isAdmin()) {
      return;
    }
    if (window.location.pathname !== cleanPath) {
      window.history.pushState({}, '', cleanPath);
    }
    this.handleRoute();
  }

  getCurrentRoute() {
    return this.currentRoute;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.currentRoute);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      cb(this.currentRoute);
    }
  }
}

export const router = new Router();
