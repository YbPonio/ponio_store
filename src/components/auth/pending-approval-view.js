import { authService } from '../../services/auth.service.js';
import { ICONS, showToast } from '../../utils/dom.js';

export class PendingApprovalView extends HTMLElement {
  constructor() {
    super();
    this.isChecking = false;
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  setupListeners() {
    const checkBtn = this.querySelector('#check-status-btn');
    const signOutBtn = this.querySelector('#pending-signout-btn');

    if (checkBtn) {
      checkBtn.addEventListener('click', async () => {
        if (this.isChecking) return;
        this.isChecking = true;
        checkBtn.disabled = true;
        checkBtn.textContent = 'Checking Status...';

        try {
          const user = await authService.refreshCurrentUserProfile();
          if (user && user.status === 'APPROVED') {
            showToast('Account has been approved! Redirecting...', 'success');
          } else if (user && user.status === 'REJECTED') {
            showToast('Account registration was declined.', 'error');
            this.render();
            this.setupListeners();
          } else {
            showToast('Account is still pending administrator review.', 'info');
          }
        } catch (err) {
          console.error('Status check error:', err);
          showToast('Failed to check approval status.', 'error');
        } finally {
          this.isChecking = false;
          if (checkBtn) {
            checkBtn.disabled = false;
            checkBtn.textContent = 'Check Approval Status';
          }
        }
      });
    }

    if (signOutBtn) {
      signOutBtn.addEventListener('click', async () => {
        await authService.signOutUser();
        showToast('Signed out', 'info');
      });
    }
  }

  render() {
    const user = authService.getCurrentUser() || { name: 'User', email: '', status: 'PENDING' };
    const isRejected = user.status === 'REJECTED';

    this.className = 'w-full h-full flex items-center justify-center bg-slate-50 p-4 select-none overflow-y-auto';
    this.innerHTML = `
      <div class="w-full max-w-md my-auto">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-black tracking-tight text-slate-900 mb-2">PonioStore</h1>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isRejected
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }">
            <span>${isRejected ? ICONS.alert : ICONS.lock}</span>
            <span>${isRejected ? 'Account Access Denied' : 'Pending Administrator Approval'}</span>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5 text-center">
          <div class="w-12 h-12 rounded-2xl ${
            isRejected ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
          } flex items-center justify-center mx-auto">
            ${isRejected ? ICONS.x : ICONS.shield}
          </div>

          <div class="space-y-1.5">
            <h2 class="text-base font-bold text-slate-900">
              ${isRejected ? 'Application Declined' : 'Account Awaiting Activation'}
            </h2>
            <p class="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              ${
                isRejected
                  ? 'Your registration request was declined by the administrator. Contact your supervisor if you believe this is an error.'
                  : 'Your account has been registered successfully. For security compliance, an administrator must review and approve your account before you can operate the POS system.'
              }
            </p>
          </div>

          <div class="bg-slate-50 rounded-xl border border-slate-200/80 p-4 text-left space-y-2 text-xs">
            <div class="flex justify-between items-center">
              <span class="text-slate-500 font-medium">Full Name</span>
              <span class="text-slate-900 font-bold">${user.name}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500 font-medium">Email Address</span>
              <span class="text-slate-900 font-mono text-[11px] font-semibold">${user.email || 'N/A'}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500 font-medium">Assigned Role</span>
              <span class="text-slate-900 font-semibold">${user.role && user.role !== 'NONE' ? user.role : 'No Role (Pending)'}</span>
            </div>
            <div class="flex justify-between items-center pt-1 border-t border-slate-200">
              <span class="text-slate-500 font-medium">Account Status</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isRejected
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-amber-100 text-amber-800'
              }">${user.status || 'PENDING'}</span>
            </div>
          </div>

          <div class="space-y-2 pt-1">
            ${
              !isRejected
                ? `
              <button
                id="check-status-btn"
                type="button"
                class="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>${ICONS.refresh}</span>
                <span>Check Approval Status</span>
              </button>
            `
                : ''
            }

            <button
              id="pending-signout-btn"
              type="button"
              class="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div class="text-center text-[11px] text-slate-400 mt-4">
          PonioStore Security Protocol - Access Restricted
        </div>
      </div>
    `;
  }
}

customElements.define('pending-approval-view', PendingApprovalView);
