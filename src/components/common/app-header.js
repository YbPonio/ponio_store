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
        el.textContent = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
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
          btn.className = 'flex flex-col items-center justify-center flex-1 py-1 px-2 text-slate-900 font-bold transition-all relative';
          const iconSpan = btn.querySelector('.mobile-icon');
          if (iconSpan) iconSpan.className = 'mobile-icon w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xs transition-all';
        } else {
          btn.className = 'flex flex-col items-center justify-center flex-1 py-1 px-2 text-slate-500 font-medium hover:text-slate-800 transition-all relative';
          const iconSpan = btn.querySelector('.mobile-icon');
          if (iconSpan) iconSpan.className = 'mobile-icon w-8 h-8 rounded-full text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-all';
        }
      } else {
        if (isActive) {
          btn.className = 'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white shadow-xs transition-all';
        } else {
          btn.className = 'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all';
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
        <header class="h-14 bg-white border-b border-slate-200/90 px-3 sm:px-6 flex items-center justify-between z-30 shrink-0 select-none">
          <div class="flex items-center">
            <span class="font-black text-base sm:text-lg tracking-tight text-slate-900">PonioStore</span>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium ${
              isPending
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : isRejected
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }">
              <span>${isPending ? ICONS.shield : isRejected ? ICONS.alert : ICONS.lock}</span>
              <span>${isPending ? 'Pending Approval' : isRejected ? 'Access Denied' : 'Authentication Gate'}</span>
            </div>
            ${
              isAuthenticated
                ? `
              <button id="logout-cashier-btn" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="Sign Out">
                ${ICONS.logOut}
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

    this.innerHTML = `
      <header class="h-14 bg-white border-b border-slate-200/90 px-3 sm:px-6 flex items-center justify-between z-30 shrink-0 select-none">
        <div class="flex items-center gap-4 sm:gap-6">
          <div id="header-brand-logo" class="flex items-center cursor-pointer">
            <span class="font-black text-base sm:text-lg tracking-tight text-slate-900 hover:text-slate-700 transition-colors">PonioStore</span>
          </div>

          <nav class="hidden md:flex items-center gap-1">
            <button data-route="/pos" class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all">
              <span class="text-current">${ICONS.pos}</span>
              <span>Register</span>
              <span class="cart-badge-count hidden px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-none">0</span>
            </button>
            <button data-route="/inventory" class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all">
              <span class="text-current">${ICONS.inventory}</span>
              <span>Inventory</span>
            </button>
            <button data-route="/orders" class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all">
              <span class="text-current">${ICONS.orders}</span>
              <span>Sales Orders</span>
            </button>
            ${
              isAdmin
                ? `
            <button data-route="/users" class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all">
              <span class="text-current">${ICONS.users}</span>
              <span>Users</span>
            </button>
            `
                : ''
            }
          </nav>
        </div>

        <div class="flex items-center gap-2 sm:gap-3">
          <div class="flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-medium ${
            isLive
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
              : 'bg-amber-50 text-amber-800 border border-amber-200/80'
          }" title="${isLive ? 'Connected to Cloud Firestore' : 'Running in Local Storage Mode'}">
            <span class="w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
            <span class="hidden xs:inline">${isLive ? 'Cloud Firestore' : 'Local Storage'}</span>
            <span class="xs:hidden">${isLive ? 'Cloud' : 'Local'}</span>
          </div>

          <div class="hidden lg:flex items-center font-mono text-[11px] text-slate-500 bg-slate-100/70 px-2.5 py-1 rounded-lg border border-slate-200/70">
            <span id="header-clock">--:--:-- --</span>
          </div>

          <div class="flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg bg-slate-50 border border-slate-200/80">
            <div class="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-[10px] text-slate-800 shrink-0">
              ${initial}
            </div>
            <div class="text-left leading-tight hidden sm:block pr-1">
              <div id="cashier-name" class="font-semibold text-slate-900 text-[11px] truncate max-w-[120px]">${user.name}</div>
            </div>
            <button id="logout-cashier-btn" class="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer" title="Sign Out">
              ${ICONS.logOut}
            </button>
          </div>
        </div>
      </header>

      <nav id="mobile-bottom-nav" class="flex md:hidden fixed bottom-0 inset-x-0 h-14 bg-white border-t border-slate-200 z-40 items-center justify-around px-1 shadow-xs select-none">
        <button data-route="/pos" class="flex flex-col items-center justify-center flex-1 py-1 px-2 text-slate-900 font-bold transition-all relative cursor-pointer">
          <span class="mobile-icon w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xs transition-all">
            ${ICONS.pos}
          </span>
          <span class="text-[10px] tracking-tight mt-0.5">Register</span>
          <span class="cart-badge-count hidden absolute top-0.5 right-[calc(50%-18px)] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-mono font-bold leading-none shadow-xs">0</span>
        </button>

        <button data-route="/inventory" class="flex flex-col items-center justify-center flex-1 py-1 px-2 text-slate-500 font-medium transition-all relative cursor-pointer">
          <span class="mobile-icon w-8 h-8 rounded-full text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-all">
            ${ICONS.inventory}
          </span>
          <span class="text-[10px] tracking-tight mt-0.5">Inventory</span>
        </button>

        <button data-route="/orders" class="flex flex-col items-center justify-center flex-1 py-1 px-2 text-slate-500 font-medium transition-all relative cursor-pointer">
          <span class="mobile-icon w-8 h-8 rounded-full text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-all">
            ${ICONS.orders}
          </span>
          <span class="text-[10px] tracking-tight mt-0.5">Orders</span>
        </button>

        ${
          isAdmin
            ? `
        <button data-route="/users" class="flex flex-col items-center justify-center flex-1 py-1 px-2 text-slate-500 font-medium transition-all relative cursor-pointer">
          <span class="mobile-icon w-8 h-8 rounded-full text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-all">
            ${ICONS.users}
          </span>
          <span class="text-[10px] tracking-tight mt-0.5">Users</span>
        </button>
        `
            : ''
        }
      </nav>
    `;
  }
}

customElements.define('app-header', AppHeader);
