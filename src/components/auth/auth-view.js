import { authService } from '../../services/auth.service.js';
import { showToast } from '../../utils/dom.js';

export class AuthView extends HTMLElement {
  constructor() {
    super();
    this.mode = 'signin';
    this.isSubmitting = false;
  }

  connectedCallback() {
    this.render();
    this.setupListeners();
  }

  setupListeners() {
    const tabSignIn = this.querySelector('#auth-tab-signin');
    const tabSignUp = this.querySelector('#auth-tab-signup');
    const form = this.querySelector('#auth-form');
    const googleBtn = this.querySelector('#auth-google-btn');
    const demoFillBtn = this.querySelector('#auth-demo-fill-btn');

    if (tabSignIn) {
      tabSignIn.addEventListener('click', () => this.setMode('signin'));
    }

    if (tabSignUp) {
      tabSignUp.addEventListener('click', () => this.setMode('signup'));
    }

    if (demoFillBtn) {
      demoFillBtn.addEventListener('click', () => {
        const emailInput = this.querySelector('#auth-email');
        const passInput = this.querySelector('#auth-password');
        if (emailInput && passInput) {
          emailInput.value = 'admin@poniostore.ph';
          passInput.value = 'password123';
          showToast('Prefilled demo cashier credentials', 'info');
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (this.isSubmitting) return;

        const email = this.querySelector('#auth-email').value.trim();
        const password = this.querySelector('#auth-password').value;
        const nameInput = this.querySelector('#auth-name');
        const displayName = nameInput ? nameInput.value.trim() : '';

        const submitBtn = this.querySelector('#auth-submit-btn');
        const errorBox = this.querySelector('#auth-error-box');
        const errorText = this.querySelector('#auth-error-text');

        if (errorBox) errorBox.classList.add('hidden');
        this.isSubmitting = true;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = this.mode === 'signin' ? 'Authenticating...' : 'Registering...';
        }

        try {
          if (this.mode === 'signin') {
            await authService.signInWithEmail(email, password);
            showToast('Authenticated as cashier', 'success');
          } else {
            await authService.signUpWithEmail(email, password, displayName);
            showToast('Account registered successfully', 'success');
          }
        } catch (err) {
          console.error('Auth error:', err);
          let message = err.message || 'Authentication failed.';
          if (message.includes('auth/invalid-credential') || message.includes('auth/wrong-password')) {
            message = 'Invalid email or password.';
          } else if (message.includes('auth/email-already-in-use')) {
            message = 'An account with this email already exists.';
          } else if (message.includes('auth/weak-password')) {
            message = 'Password must be at least 6 characters.';
          } else if (message.includes('auth/invalid-email')) {
            message = 'Please provide a valid email address.';
          }
          if (errorText) errorText.textContent = message;
          if (errorBox) errorBox.classList.remove('hidden');
          showToast(message, 'error');
        } finally {
          this.isSubmitting = false;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = this.mode === 'signin' ? 'Sign In as Cashier' : 'Register Account';
          }
        }
      });
    }

    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        try {
          googleBtn.disabled = true;
          googleBtn.textContent = 'Connecting Google...';
          await authService.signInWithGoogle();
          showToast('Signed in with Google', 'success');
        } catch (err) {
          console.error('Google sign in error:', err);
          showToast(err.message || 'Google sign-in failed.', 'error');
          googleBtn.disabled = false;
          googleBtn.textContent = 'Sign in with Google';
        }
      });
    }
  }

  setMode(mode) {
    this.mode = mode;
    const tabSignIn = this.querySelector('#auth-tab-signin');
    const tabSignUp = this.querySelector('#auth-tab-signup');
    const nameField = this.querySelector('#name-field-container');
    const submitBtn = this.querySelector('#auth-submit-btn');
    const errorBox = this.querySelector('#auth-error-box');

    if (errorBox) errorBox.classList.add('hidden');

    if (mode === 'signin') {
      if (tabSignIn) tabSignIn.className = 'flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-slate-900 text-white shadow-xs transition-all cursor-pointer';
      if (tabSignUp) tabSignUp.className = 'flex-1 py-2 px-3 text-xs font-semibold rounded-xl text-slate-500 hover:text-slate-900 transition-all cursor-pointer';
      if (nameField) nameField.classList.add('hidden');
      if (submitBtn) submitBtn.textContent = 'Sign In as Cashier';
    } else {
      if (tabSignIn) tabSignIn.className = 'flex-1 py-2 px-3 text-xs font-semibold rounded-xl text-slate-500 hover:text-slate-900 transition-all cursor-pointer';
      if (tabSignUp) tabSignUp.className = 'flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-slate-900 text-white shadow-xs transition-all cursor-pointer';
      if (nameField) nameField.classList.remove('hidden');
      if (submitBtn) submitBtn.textContent = 'Register Account';
    }
  }

  render() {
    this.className = 'w-full h-full flex items-center justify-center bg-slate-100/70 p-4 select-none overflow-y-auto';
    this.innerHTML = `
      <div class="w-full max-w-sm my-auto">
        <div class="text-center mb-6">
          <div class="inline-flex items-center tracking-tight mb-2">
            <span class="font-black text-2xl text-slate-900">PONIO</span>
            <span class="ml-1 text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-600 text-white shadow-2xs">STORE</span>
          </div>
          <div class="text-xs font-medium text-slate-500">RetailCore Point of Sale System</div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div class="flex items-center p-1 rounded-2xl bg-slate-100 border border-slate-200">
            <button id="auth-tab-signin" type="button" class="flex-1 py-2 px-3 text-xs font-bold rounded-xl bg-slate-900 text-white shadow-xs transition-all cursor-pointer">
              Sign In
            </button>
            <button id="auth-tab-signup" type="button" class="flex-1 py-2 px-3 text-xs font-semibold rounded-xl text-slate-500 hover:text-slate-900 transition-all cursor-pointer">
              Register
            </button>
          </div>

          <div id="auth-error-box" class="hidden p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            <span id="auth-error-text">Authentication failed</span>
          </div>

          <form id="auth-form" class="space-y-3.5">
            <div id="name-field-container" class="hidden space-y-1.5">
              <label for="auth-name" class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Cashier Full Name *</label>
              <input
                id="auth-name"
                type="text"
                placeholder="e.g. Maria Santos"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-semibold"
              />
            </div>

            <div class="space-y-1.5">
              <label for="auth-email" class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Email Address *</label>
              <input
                id="auth-email"
                type="email"
                required
                placeholder="cashier@poniostore.ph"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-medium"
              />
            </div>

            <div class="space-y-1.5">
              <label for="auth-password" class="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Password *</label>
              <input
                id="auth-password"
                type="password"
                required
                minlength="6"
                placeholder="Enter password (min 6 characters)"
                class="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-2xs font-medium"
              />
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              class="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer mt-1"
            >
              Sign In as Cashier
            </button>
          </form>

          <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span class="text-slate-400">Need quick testing?</span>
            <button id="auth-demo-fill-btn" type="button" class="text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer">
              Use Demo Credentials
            </button>
          </div>

          <div class="relative flex items-center justify-center pt-1">
            <div class="border-t border-slate-200 w-full"></div>
            <span class="bg-white px-2.5 text-[10px] uppercase font-bold text-slate-400 shrink-0">or</span>
          </div>

          <div>
            <button
              id="auth-google-btn"
              type="button"
              class="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
            >
              <span>Sign in with Google</span>
            </button>
          </div>
        </div>

        <div class="text-center text-[11px] text-slate-400 mt-5">
          Dual Engine: Cloud Firestore and Local Storage Fallback
        </div>
      </div>
    `;
  }
}

customElements.define('auth-view', AuthView);
