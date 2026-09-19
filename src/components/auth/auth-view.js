import { authService } from '../../services/auth.service.js';
import { ICONS, showToast } from '../../utils/dom.js';

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

    if (tabSignIn) {
      tabSignIn.addEventListener('click', () => this.setMode('signin'));
    }

    if (tabSignUp) {
      tabSignUp.addEventListener('click', () => this.setMode('signup'));
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
            showToast('Authenticated successfully as cashier', 'success');
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
          googleBtn.innerHTML = `<span>${ICONS.google}</span><span>Sign in with Google</span>`;
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
      if (tabSignIn) tabSignIn.className = 'flex-1 py-2 px-3 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-2xs border border-slate-200 transition-all cursor-pointer';
      if (tabSignUp) tabSignUp.className = 'flex-1 py-2 px-3 text-xs font-medium rounded-lg text-slate-500 hover:text-slate-900 transition-all cursor-pointer';
      if (nameField) nameField.classList.add('hidden');
      if (submitBtn) submitBtn.textContent = 'Sign In as Cashier';
    } else {
      if (tabSignIn) tabSignIn.className = 'flex-1 py-2 px-3 text-xs font-medium rounded-lg text-slate-500 hover:text-slate-900 transition-all cursor-pointer';
      if (tabSignUp) tabSignUp.className = 'flex-1 py-2 px-3 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-2xs border border-slate-200 transition-all cursor-pointer';
      if (nameField) nameField.classList.remove('hidden');
      if (submitBtn) submitBtn.textContent = 'Register Account';
    }
  }

  render() {
    this.className = 'w-full h-full flex items-center justify-center bg-slate-50 p-4 select-none overflow-y-auto';
    this.innerHTML = `
      <div class="w-full max-w-sm my-auto">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-black tracking-tight text-slate-900">PonioStore</h1>
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-600">
            <span>${ICONS.lock}</span>
            <span>Secure System Access</span>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 space-y-4">
          <div class="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80">
            <button id="auth-tab-signin" type="button" class="flex-1 py-2 px-3 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-2xs border border-slate-200 transition-all cursor-pointer">
              Sign In
            </button>
            <button id="auth-tab-signup" type="button" class="flex-1 py-2 px-3 text-xs font-medium rounded-lg text-slate-500 hover:text-slate-900 transition-all cursor-pointer">
              Register
            </button>
          </div>

          <div id="auth-error-box" class="hidden p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
            <span class="shrink-0 mt-0.5">${ICONS.alert}</span>
            <span id="auth-error-text">Authentication failed</span>
          </div>

          <form id="auth-form" class="space-y-3.5">
            <div id="name-field-container" class="hidden space-y-1">
              <label for="auth-name" class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Cashier Full Name</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  ${ICONS.user}
                </span>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="e.g. Maria Santos"
                  class="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-300 text-sm sm:text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label for="auth-email" class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Email Address</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  ${ICONS.mail}
                </span>
                <input
                  id="auth-email"
                  type="email"
                  required
                  placeholder="cashier@poniostore.ph"
                  class="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-300 text-sm sm:text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label for="auth-password" class="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Password</label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  ${ICONS.key}
                </span>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minlength="6"
                  placeholder="Enter password (min 6 chars)"
                  class="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-300 text-sm sm:text-xs text-slate-900 focus:outline-none focus:border-slate-800 shadow-2xs font-medium"
                />
              </div>
            </div>

            <button
              id="auth-submit-btn"
              type="submit"
              class="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer mt-1"
            >
              Sign In as Cashier
            </button>
          </form>

          <div class="relative flex items-center justify-center my-3">
            <div class="border-t border-slate-200 w-full"></div>
            <span class="bg-white px-2.5 text-[10px] uppercase font-bold text-slate-400 shrink-0">or</span>
          </div>

          <div>
            <button
              id="auth-google-btn"
              type="button"
              class="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
            >
              <span>${ICONS.google}</span>
              <span>Sign in with Google</span>
            </button>
          </div>
        </div>

        <div class="text-center text-[11px] text-slate-400 mt-4">
          Protected by Firebase Authentication &amp; Firestore Security
        </div>
      </div>
    `;
  }
}

customElements.define('auth-view', AuthView);
