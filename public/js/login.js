const SUPABASE_URL      = 'https://sjajyvhedybsvspzuuhh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqYWp5dmhlZHlic3ZzcHp1dWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjUzMTIsImV4cCI6MjA5NzQ0MTMxMn0.LdY_mZRycnNzsxyhUAdOXMPJRuKJDePm9ioFyNrdK7A';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Redirect if already logged in ────────────────────────────────────────────
sb.auth.getSession().then(({ data: { session } }) => {
  if (session) redirectByRole(session);
});

async function redirectByRole(session) {
  const { data: profile } = await sb.from('profiles').select('role').eq('id', session.user.id).single();
  window.location.href = profile?.role === 'admin' ? '/admin.html' : '/app.html';
}

// ── View switching ────────────────────────────────────────────────────────────
function showView(view) {
  document.getElementById('view-login').classList.toggle('hidden', view !== 'login');
  document.getElementById('view-register').classList.toggle('hidden', view !== 'register');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideMsg(id) {
  document.getElementById(id).classList.add('hidden');
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  hideMsg('login-error');
  if (!email || !password) return showError('login-error', 'Inserisci email e password.');
  const btn = document.getElementById('login-btn');
  btn.textContent = 'Accesso in corso…';
  btn.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    showError('login-error', error.message === 'Invalid login credentials'
      ? 'Email o password non corretti.' : error.message);
    btn.textContent = 'Accedi';
    btn.disabled = false;
    return;
  }
  await redirectByRole(data.session);
}

// ── Register ──────────────────────────────────────────────────────────────────
async function doRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  hideMsg('register-error');
  hideMsg('register-success');
  if (!name || !email || !password) return showError('register-error', 'Compila tutti i campi.');
  const btn = document.getElementById('reg-btn');
  btn.textContent = 'Creazione in corso…';
  btn.disabled = true;
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
  if (error) {
    showError('register-error', error.message);
    btn.textContent = 'Crea account';
    btn.disabled = false;
    return;
  }
  if (data.session) {
    window.location.href = '/app.html';
  } else {
    const s = document.getElementById('register-success');
    s.textContent = 'Account creato! Controlla la tua email per confermare l\'iscrizione.';
    s.classList.remove('hidden');
    btn.textContent = 'Crea account';
    btn.disabled = false;
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById('link-to-register').addEventListener('click', () => showView('register'));
document.getElementById('link-to-login').addEventListener('click', () => showView('login'));
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('reg-btn').addEventListener('click', doRegister);
document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('reg-password').addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
