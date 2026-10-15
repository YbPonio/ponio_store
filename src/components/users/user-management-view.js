import { usersService } from '../../services/users.service.js';
import { authService } from '../../services/auth.service.js';
import { showToast, escapeHtml, confirmDialog } from '../../utils/dom.js';

export class UserManagementView extends HTMLElement {
  constructor() {
    super();
    this.users = [];
    this.filterStatus = 'ALL';
    this.searchQuery = '';
    this.unsubscribeUsers = null;
  }

  connectedCallback() {
    if (!authService.isAdmin()) {
      this.renderAccessDenied();
      return;
    }
    this.render();
    this.setupListeners();
    this.unsubscribeUsers = usersService.subscribeUsers((usersList) => {
      this.users = usersList;
      this.updateUserList();
      this.updateSummaryCounters();
    });
  }

  renderAccessDenied() {
    this.className = 'w-full h-full flex flex-col items-center justify-center bg-slate-100/70 p-6';
    this.innerHTML = `
      <div class="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
        <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3 font-bold text-xs border border-rose-200">
          LOCK
        </div>
        <h2 class="text-base font-black text-slate-900">Administrator Access Required</h2>
        <p class="text-xs text-slate-500 mt-1 mb-5 leading-relaxed">You do not have permission to view or manage user accounts. Only users with the ADMIN role can access staff administration.</p>
        <button id="return-pos-btn" class="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer shadow-xs">
          Return to Register
        </button>
      </div>
    `;
    const btn = this.querySelector('#return-pos-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        import('../../store/router.js').then(({ router }) => router.navigate('/pos'));
      });
    }
  }

  disconnectedCallback() {
    if (this.unsubscribeUsers) {
      this.unsubscribeUsers();
    }
  }

  setupListeners() {
    const searchInput = this.querySelector('#users-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.updateUserList();
      });
    }

    const filterTabs = this.querySelectorAll('.user-status-tab');
    filterTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        this.filterStatus = tab.getAttribute('data-status');
        filterTabs.forEach((t) => {
          const isSelected = t === tab;
          t.className = isSelected
            ? 'user-status-tab px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white shadow-xs cursor-pointer transition-all'
            : 'user-status-tab px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-all';
        });
        this.updateUserList();
      });
    });

    const refreshBtn = this.querySelector('#users-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        this.users = await usersService.getUsers();
        this.updateUserList();
        this.updateSummaryCounters();
        showToast('Users list refreshed', 'info');
        refreshBtn.disabled = false;
      });
    }
  }

  attachRowActionListeners() {
    this.querySelectorAll('.btn-approve-user').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uid = btn.getAttribute('data-uid');
        const name = btn.getAttribute('data-name');
        const roleSelect = this.querySelector(`select[data-uid="${uid}"]`);
        const chosenRole = roleSelect && roleSelect.value !== 'NONE' ? roleSelect.value : 'CASHIER';

        try {
          btn.disabled = true;
          btn.textContent = 'Approving...';
          await usersService.approveUser(uid, chosenRole);
          showToast(`Account approved for ${name} as ${chosenRole}`, 'success');
        } catch (err) {
          console.error('Approval error:', err);
          showToast(err.message || 'Failed to approve user.', 'error');
          btn.disabled = false;
          btn.textContent = 'Approve';
        }
      });
    });

    this.querySelectorAll('.btn-reject-user').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uid = btn.getAttribute('data-uid');
        const name = btn.getAttribute('data-name');

        const confirmed = await confirmDialog({
          title: 'Revoke User Access',
          message: `Are you sure you want to revoke access for ${name}? They will be blocked from accessing the POS.`,
          confirmText: 'Revoke Access',
          cancelText: 'Cancel',
          isDestructive: true,
        });

        if (!confirmed) return;

        try {
          btn.disabled = true;
          btn.textContent = 'Revoking...';
          await usersService.rejectUser(uid, 'Revoked by admin');
          showToast(`Access revoked for ${name}`, 'info');
        } catch (err) {
          console.error('Revoke error:', err);
          showToast(err.message || 'Failed to revoke user.', 'error');
          btn.disabled = false;
          btn.textContent = 'Revoke';
        }
      });
    });

    this.querySelectorAll('.select-user-role').forEach((select) => {
      select.addEventListener('change', async () => {
        const uid = select.getAttribute('data-uid');
        const newRole = select.value;
        try {
          select.disabled = true;
          await usersService.updateUserRole(uid, newRole);
          showToast(`Role updated to ${newRole}`, 'success');
        } catch (err) {
          console.error('Role update error:', err);
          showToast(err.message || 'Failed to update role.', 'error');
        } finally {
          select.disabled = false;
        }
      });
    });
  }

  getFilteredUsers() {
    return this.users.filter((user) => {
      const matchesStatus =
        this.filterStatus === 'ALL' || (user.status || 'PENDING') === this.filterStatus;

      const q = this.searchQuery;
      const matchesSearch =
        !q ||
        (user.name && user.name.toLowerCase().includes(q)) ||
        (user.email && user.email.toLowerCase().includes(q)) ||
        (user.role && user.role.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }

  updateSummaryCounters() {
    const total = this.users.length;
    const pending = this.users.filter((u) => (u.status || 'PENDING') === 'PENDING').length;
    const approved = this.users.filter((u) => u.status === 'APPROVED').length;
    const admins = this.users.filter((u) => u.role === 'ADMIN').length;

    const elTotal = this.querySelector('#count-total-users');
    const elPending = this.querySelector('#count-pending-users');
    const elApproved = this.querySelector('#count-approved-users');
    const elAdmins = this.querySelector('#count-admin-users');

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elApproved) elApproved.textContent = approved;
    if (elAdmins) elAdmins.textContent = admins;
  }

  updateUserList() {
    const listContainer = this.querySelector('#users-table-body');
    const emptyState = this.querySelector('#users-empty-state');
    if (!listContainer) return;

    const filtered = this.getFilteredUsers();

    if (filtered.length === 0) {
      listContainer.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    listContainer.innerHTML = filtered
      .map((user, idx) => {
        const initial = (user.name || 'U').charAt(0).toUpperCase();
        const status = user.status || 'PENDING';
        const role = user.role || 'CASHIER';

        const statusBadgeClasses = {
          PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
          APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
        };

        const isCurrentUserAdmin = user.email === 'admin@poniostore.ph' || user.email === 'ybponio@gmail.com' || user.id === 'usr_admin_001';

        const createdDate = user.createdAt
          ? new Date(user.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'N/A';

        return `
          <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}">
            <td class="py-3 px-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  ${initial}
                </div>
                <div class="leading-tight">
                  <div class="font-bold text-slate-900 text-xs">${escapeHtml(user.name)}</div>
                  <div class="text-[11px] font-mono text-slate-500">${escapeHtml(user.email || 'No email')}</div>
                </div>
              </div>
            </td>

            <td class="py-3 px-4 text-xs">
              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-slate-600 bg-slate-100 border border-slate-200">
                ${user.provider === 'google.com' ? 'Google Auth' : 'Password Auth'}
              </span>
            </td>

            <td class="py-3 px-4">
              <select
                data-uid="${user.id}"
                class="select-user-role text-xs font-bold rounded-xl bg-white border border-slate-300 py-1 px-2.5 text-slate-800 focus:outline-none focus:border-emerald-600 shadow-2xs cursor-pointer"
                ${isCurrentUserAdmin ? 'disabled' : ''}
              >
                <option value="CASHIER" ${role === 'CASHIER' ? 'selected' : ''}>Cashier</option>
                <option value="ADMIN" ${role === 'ADMIN' ? 'selected' : ''}>Admin</option>
              </select>
            </td>

            <td class="py-3 px-4 text-xs">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadgeClasses[status] || statusBadgeClasses.PENDING}">
                <span class="w-1.5 h-1.5 rounded-full ${status === 'APPROVED' ? 'bg-emerald-500' : status === 'REJECTED' ? 'bg-rose-500' : 'bg-amber-500'}"></span>
                <span>${status}</span>
              </span>
            </td>

            <td class="py-3 px-4 text-xs font-mono text-slate-500 tabular-nums">
              ${createdDate}
            </td>

            <td class="py-3 px-4 text-right">
              <div class="flex items-center justify-end gap-1.5">
                ${
                  status === 'PENDING'
                    ? `
                  <button
                    data-uid="${user.id}"
                    data-name="${escapeHtml(user.name)}"
                    class="btn-approve-user px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
                  >
                    Approve
                  </button>
                  <button
                    data-uid="${user.id}"
                    data-name="${escapeHtml(user.name)}"
                    class="btn-reject-user px-3 py-1 rounded-xl border border-slate-300 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-bold text-xs transition-all cursor-pointer"
                  >
                    Reject
                  </button>
                `
                    : status === 'APPROVED'
                    ? `
                  <button
                    data-uid="${user.id}"
                    data-name="${escapeHtml(user.name)}"
                    class="btn-reject-user px-3 py-1 rounded-xl border border-slate-300 hover:bg-rose-50 hover:text-rose-700 text-slate-600 font-bold text-xs transition-all cursor-pointer"
                    ${isCurrentUserAdmin ? 'disabled title="Cannot reject primary administrator"' : ''}
                  >
                    Revoke
                  </button>
                `
                    : `
                  <button
                    data-uid="${user.id}"
                    data-name="${escapeHtml(user.name)}"
                    class="btn-approve-user px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
                  >
                    Re-approve
                  </button>
                `
                }
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    this.attachRowActionListeners();
  }

  render() {
    this.className = 'w-full h-full flex flex-col bg-slate-100/60 overflow-hidden';
    this.innerHTML = `
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-7xl mx-auto w-full pb-20 md:pb-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Staff &amp; Access Control</h1>
            <p class="text-xs text-slate-500 mt-0.5">Approve incoming registrations, manage cashier permissions, and assign roles</p>
          </div>

          <div class="flex items-center gap-2">
            <button
              id="users-refresh-btn"
              type="button"
              class="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>Refresh Staff</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Staff</div>
            <div id="count-total-users" class="text-2xl font-black font-mono text-slate-900 mt-2 tabular-nums">0</div>
            <div class="text-[11px] text-slate-500 mt-1">Registered accounts</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-2xs">
            <div class="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pending Approval</div>
            <div id="count-pending-users" class="text-2xl font-black font-mono text-amber-700 mt-2 tabular-nums">0</div>
            <div class="text-[11px] text-amber-600 mt-1">Awaiting verification</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
            <div class="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Approved Staff</div>
            <div id="count-approved-users" class="text-2xl font-black font-mono text-emerald-700 mt-2 tabular-nums">0</div>
            <div class="text-[11px] text-emerald-600 mt-1">Active cashier licenses</div>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Administrators</div>
            <div id="count-admin-users" class="text-2xl font-black font-mono text-slate-900 mt-2 tabular-nums">0</div>
            <div class="text-[11px] text-slate-500 mt-1">Admin authority</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div class="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button data-status="ALL" class="user-status-tab px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white shadow-xs cursor-pointer transition-all">
                All
              </button>
              <button data-status="PENDING" class="user-status-tab px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-all">
                Pending
              </button>
              <button data-status="APPROVED" class="user-status-tab px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-all">
                Approved
              </button>
              <button data-status="REJECTED" class="user-status-tab px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-all">
                Rejected
              </button>
            </div>

            <div class="relative min-w-[220px] sm:min-w-[280px]">
              <input
                id="users-search-input"
                type="text"
                placeholder="Search staff by name or email..."
                class="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-medium"
              />
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50 text-[11px] uppercase font-bold tracking-wider text-slate-500">
                  <th class="py-3 px-4">Staff Member</th>
                  <th class="py-3 px-4">Auth Method</th>
                  <th class="py-3 px-4">Assigned Role</th>
                  <th class="py-3 px-4">Approval Status</th>
                  <th class="py-3 px-4">Registered Date</th>
                  <th class="py-3 px-4 text-right">Access Actions</th>
                </tr>
              </thead>
              <tbody id="users-table-body">
              </tbody>
            </table>
          </div>

          <div id="users-empty-state" class="hidden py-16 text-center text-slate-400 text-xs space-y-2">
            <div class="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 font-bold flex items-center justify-center mx-auto">
              0
            </div>
            <div class="font-bold text-slate-700">No staff accounts found</div>
            <div class="text-slate-500">Try adjusting your search criteria or status filter.</div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('user-management-view', UserManagementView);
