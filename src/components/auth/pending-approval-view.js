import { authService } from '../../services/auth.service.js';
import { showToast } from '../../utils/dom.js';

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
        showToast('Signed out of system', 'info');
      });
    }
  }

  render() {
    const user = authService.getCurrentUser() || { name: 'User', email: '', status: 'PENDING' };
    const isRejected = user.status === 'REJECTED';

    this.className = 'w-full h-full flex items-center justify-center bg-slate-100/70 p-4 select-none overflow-y-auto';
    this.innerHTML = `
      <div class="w-full max-w-md my-auto">
        <div class="text-center mb-6">
          <div class="inline-flex items-center tracking-tight mb-2">
            <span class="font-black text-2xl text-slate-900">PONIO</span>
            <span class="ml-1 text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white shadow-2xs">STORE</span>
          </div>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
            isRejected
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }">
            <span class="w-2 h-2 rounded-full ${isRejected ? 'bg-rose-500' : 'bg-amber-500'}"></span>
            <span>${isRejected ? 'Account Access Denied' : 'Pending Administrator Approval'}</span>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 text-center">
          <div class="w-12 h-12 rounded-2xl ${
            isRejected ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
          } flex items-center justify-center mx-auto font-black text-xs">
            ${isRejected ? 'DENIED' : 'PENDING'}
          </div>

          <div class="space-y-1.5">
            <h2 class="text-base font-bold text-slate-900">
              ${isRejected ? 'Application Declined' : 'Account Awaiting Activation'}
            </h2>
            <p class="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              ${
                isRejected
                  ? 'Your registration request was declined by the system administrator. Contact your supervisor to resolve your access status.'
                  : 'Your account has been registered. For compliance, an administrator must approve your account and assign a cashier role before you can operate the POS.'
              }
            </p>
          </div>

          <div class="bg-slate-50 rounded-xl border border-slate-200 p-4 text-left space-y-2 text-xs">
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
              <span class="text-slate-900 font-semibold font-mono">${user.role && user.role !== 'NONE' ? user.role : 'No Role (Pending)'}</span>
            </div>
            <div class="flex justify-between items-center pt-2 border-t border-slate-200">
              <span class="text-slate-500 font-medium">Account Status</span>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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
                class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Check Approval Status</span>
              </button>
            `
                : ''
            }

            <button
              id="pending-signout-btn"
              type="button"
              class="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all cursor-pointer"
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
