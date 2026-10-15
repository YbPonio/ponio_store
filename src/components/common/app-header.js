import { router } from '../../store/router.js';
import { authService } from '../../services/auth.service.js';
import { isConfigValid, db } from '../../services/firebase.js';
import { cartStore } from '../../store/cart.store.js';
import { ICONS, showToast, confirmDialog } from '../../utils/dom.js';

export class AppHeader extends HTMLElement {
  constructor() {
    super();
    this.unsubscribeRouter = null;
    this.unsubscribeAuth = null;
    this.unsubscribeCart = null;
    this.clockInterval = null;
  }

  connectedCallback() {
    this.render();
    this.bindDomEvents();
    this.setupSubscriptions();
    this.startClock();
  }

  disconnectedCallback() {
    if (this.unsubscribeRouter) this.unsubscribeRouter();
    if (this.unsubscribeAuth) this.unsubscribeAuth();
    if (this.unsubscribeCart) this.unsubscribeCart();
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  startClock() {
    const updateTime = () => {
      const el = this.querySelector('#header-clock');
      if (el) {
        const now = new Date();
        const timePart = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        const datePart = now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        el.textContent = `${timePart} · ${datePart}`;
      }
    };
    updateTime();
    this.clockInterval = setInterval(updateTime, 1000);
  }

  setupSubscriptions() {
    if (this.unsubscribeRouter) this.unsubscribeRouter();
    if (this.unsubscribeAuth) this.unsubscribeAuth();
    if (this.unsubscribeCart) this.unsubscribeCart();

    this.unsubscribeRouter = router.subscribe((route) => {
      this.updateActiveTab(route);
    });

    this.unsubscribeAuth = authService.subscribe(() => {
      this.render();
      this.bindDomEvents();
      this.updateActiveTab(router.getCurrentRoute());
      this.updateCartBadge();
    });

    this.unsubscribeCart = cartStore.subscribe(() => {
      this.updateCartBadge();
    });
  }

  bindDomEvents() {
    this.querySelectorAll('button[data-route]').forEach(btn => {
      btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-route');
        router.navigate(route);
      });
    });

    const brandLogo = this.querySelector('#header-brand-logo');
    if (brandLogo) {
      brandLogo.addEventListener('click', () => {
        router.navigate('/pos');
      });
    }

    const logoutBtn = this.querySelector('#logout-cashier-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        const confirmed = await confirmDialog({
          title: 'Sign Out',
          message: 'Are you sure you want to sign out of the POS system?',
          confirmText: 'Sign Out',
          cancelText: 'Cancel',
          isDestructive: true,
        });
        if (confirmed) {
          await authService.signOutUser();
          showToast('Signed out of POS system', 'info');
        }
      });
    }
  }

  updateCartBadge() {
    const count = cartStore.getTotalCount();
    const badgeEls = this.querySelectorAll('.cart-badge-count');
    badgeEls.forEach(el => {
      el.textContent = count;
      el.classList.toggle('hidden', count === 0);
    });
  }

  updateActiveTab(currentRoute) {
    this.querySelectorAll('button[data-route]').forEach(btn => {
      const route = btn.getAttribute('data-route');
      const isActive = currentRoute === route;
      const isMobileNav = btn.closest('#mobile-bottom-nav');

      if (isMobileNav) {
        if (isActive) {
          btn.className = 'flex flex-col items-center justify-center flex-1 py-1 px-2 text-emerald-700 font-bold transition-all relative';
          const iconSpan = btn.querySelector('.mobile-icon');
          if (iconSpan) iconSpan.className = 'mobile-icon w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs transition-all';
        } else {
          btn.className = 'flex flex-col items-center justify-center flex-1 py-1 px-2 text-slate-500 font-medium hover:text-slate-800 transition-all relative';
          const iconSpan = btn.querySelector('.mobile-icon');
          if (iconSpan) iconSpan.className = 'mobile-icon w-8 h-8 rounded-xl text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-all';
        }
      } else {
        const shortcutTag = btn.querySelector('.nav-shortcut');
        if (isActive) {
          btn.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white shadow-xs transition-all cursor-pointer';
          if (shortcutTag) shortcutTag.className = 'nav-shortcut text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700';
        } else {
          btn.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer';
          if (shortcutTag) shortcutTag.className = 'nav-shortcut text-[10px] font-mono px-1 py-0.2 rounded bg-slate-100 text-slate-500 border border-slate-200';
        }
      }
    });
  }

  render() {
    const isLive = isConfigValid && Boolean(db);
    const user = authService.getCurrentUser();
    const isAuthenticated = authService.isAuthenticated();
    const isPending = user?.status === 'PENDING' || !user?.role || user?.role === 'NONE';
    const isRejected = user?.status === 'REJECTED';
    const isAdmin = authService.isAdmin();

    if (!isAuthenticated || isPending || isRejected) {
      this.innerHTML = `
        <header class="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between z-30 shrink-0 select-none shadow-xs">
          <div class="flex items-center gap-2">
            <div class="flex items-center tracking-tight">
              <span class="font-black text-lg text-slate-900">PONIO</span>
              <span class="ml-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-600 text-white">STORE</span>
            </div>
            <span class="hidden sm:inline-block text-[11px] font-mono font-medium text-slate-400 pl-2 border-l border-slate-200">RetailCore POS</span>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
              isPending
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : isRejected
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }">
              <span class="w-2 h-2 rounded-full ${isPending ? 'bg-amber-500' : isRejected ? 'bg-rose-500' : 'bg-slate-500'}"></span>
              <span>${isPending ? 'Pending Approval' : isRejected ? 'Access Denied' : 'Authentication Gate'}</span>
            </div>
            ${
              isAuthenticated
                ? `
              <button id="logout-cashier-btn" class="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer" title="Sign Out">
                Sign Out
              </button>
            `
                : ''
            }
          </div>
        </header>
      `;
      return;
    }

    const initial = (user.name || 'C').charAt(0).toUpperCase();
    const roleLabel = user.role || 'CASHIER';

    this.innerHTML = `
      <header class="h-14 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between z-30 shrink-0 select-none shadow-xs">
        <div class="flex items-center gap-4 sm:gap-6">
          <div id="header-brand-logo" class="flex items-center cursor-pointer group">
            <div class="flex items-center tracking-tight">
              <span class="font-black text-lg text-slate-900 group-hover:text-slate-700 transition-colors">PONIO</span>
              <span class="ml-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-2xs">STORE</span>
            </div>
            <span class="hidden lg:inline-block text-[11px] font-mono text-slate-400 pl-2.5 ml-2.5 border-l border-slate-200">RetailCore v2.4</span>
          </div>

          <nav class="hidden md:flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/90 gap-1">
            <button data-route="/pos" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all">
              <span>Register</span>
              <span class="nav-shortcut text-[10px] font-mono px-1 py-0.2 rounded bg-slate-200 text-slate-600">F4</span>
              <span class="cart-badge-count hidden px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-bold font-mono leading-none">0</span>
            </button>
            <button data-route="/inventory" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white transition-all">
              <span>Inventory</span>
              <span class="nav-shortcut text-[10px] font-mono px-1 py-0.2 rounded bg-slate-200 text-slate-600">F8</span>
            </button>
            <button data-route="/orders" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white transition-all">
              <span>Orders</span>
            </button>
            ${
              isAdmin
                ? `
            <button data-route="/users" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white transition-all">
              <span>Users</span>
            </button>
            `
                : ''
            }
          </nav>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
            isLive
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }" title="${isLive ? 'Active cloud database connection' : 'Local storage demo mode'}">
            <span class="w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
            <span class="hidden sm:inline">${isLive ? 'Cloud Database' : 'Local Storage Mode'}</span>
            <span class="sm:hidden">${isLive ? 'Cloud' : 'Local'}</span>
          </div>

          <div class="hidden xl:flex items-center font-mono text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 tabular-nums">
            <span id="header-clock">--:--:-- --</span>
          </div>

          <div class="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div class="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
              ${initial}
            </div>
            <div class="text-left leading-tight hidden sm:block pr-1">
              <div class="flex items-center gap-1.5">
                <span id="cashier-name" class="font-bold text-slate-900 text-xs truncate max-w-[110px]">${user.name}</span>
                <span class="text-[9px] font-mono font-bold uppercase px-1 py-0.2 rounded ${isAdmin ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}">${roleLabel}</span>
              </div>
            </div>
            <button id="logout-cashier-btn" class="px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer" title="Sign Out">
              Exit
            </button>
          </div>
        </div>
      </header>

      <nav id="mobile-bottom-nav" class="flex md:hidden fixed bottom-0 inset-x-0 h-14 bg-white border-t border-slate-200 z-40 items-center justify-around px-1 shadow-lg select-none">
        <button data-route="/pos" class="flex flex-col items-center justify-center flex-1 py-1 px-2 text-slate-900 font-bold transition-all relative cursor-pointer">
          <span class="text-xs font-bold tracking-tight">Register</span>
          <span class="cart-badge-count hidden absolute top-1 right-[calc(50%-22px)] px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9px] font-mono font-bold leading-none">0</span>
        </button>

        <button data-route="/inventory" class="flex flex-col items-center justify-center flex-1 py-1 px-2 text-slate-500 font-medium transition-all relative cursor-pointer">
          <span class="text-xs font-semibold tracking-tight">Inventory</span>
        </button>

        <button data-route="/orders" class="flex flex-col items-center justify-center flex-1 py-1 px-2 text-slate-500 font-medium transition-all relative cursor-pointer">
          <span class="text-xs font-semibold tracking-tight">Orders</span>
        </button>

        ${
          isAdmin
            ? `
        <button data-route="/users" class="flex flex-col items-center justify-center flex-1 py-1 px-2 text-slate-500 font-medium transition-all relative cursor-pointer">
          <span class="text-xs font-semibold tracking-tight">Users</span>
        </button>
        `
            : ''
        }
      </nav>
    `;
  }
}

customElements.define('app-header', AppHeader);
