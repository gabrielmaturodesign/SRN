const SUPABASE_URL      = 'https://sjajyvhedybsvspzuuhh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqYWp5dmhlZHlic3ZzcHp1dWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjUzMTIsImV4cCI6MjA5NzQ0MTMxMn0.LdY_mZRycnNzsxyhUAdOXMPJRuKJDePm9ioFyNrdK7A';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '/'; return; }
  const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if (profile?.role !== 'admin') { window.location.href = '/app.html'; return; }
  document.getElementById('admin-name').textContent  = profile?.name  || session.user.email;
  document.getElementById('admin-email').textContent = session.user.email;
  loadStats();
  loadRecentBookings();
}

async function getToken() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '/'; return null; }
  return session.access_token;
}

async function apiFetch(url, opts = {}) {
  const token = await getToken();
  if (!token) return;
  const res = await fetch(url, {
    ...opts,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) }
  });
  if (res.status === 401) { doLogout(); return; }
  return res;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  const res = await apiFetch('/api/admin/stats');
  const d = await res.json();
  document.getElementById('stat-users').textContent = d.totalUsers;
  document.getElementById('stat-rooms').textContent = d.totalRooms;
  document.getElementById('stat-total').textContent = d.totalBookings;
  document.getElementById('stat-today').textContent = d.todayBookings;
}

// ── Bookings ──────────────────────────────────────────────────────────────────
async function loadRecentBookings() {
  const today = new Date().toISOString().slice(0, 10);
  const res = await apiFetch(`/api/bookings?date_from=${today}&date_to=${today}`);
  const bookings = await res.json();
  const tbody = document.getElementById('recent-bookings-body');
  if (!bookings.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6" style="color:#9ca3af">Nessuna prenotazione oggi</td></tr>`;
    return;
  }
  tbody.innerHTML = bookings.map(b => `<tr>
    <td class="font-medium">${b.title}</td>
    <td><span class="flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full inline-block flex-shrink-0" style="background:${b.room_color}"></span>
      ${b.room_name}</span></td>
    <td style="color:var(--color-text-body)">${b.user_name}</td>
    <td style="color:var(--color-text-body)">${formatDate(b.date)}</td>
    <td style="color:var(--color-text-body)">${b.start_time.substring(0, 5)} – ${b.end_time.substring(0, 5)}</td>
  </tr>`).join('');
}

async function loadAllBookings() {
  const dateFilter = document.getElementById('filter-date').value;
  let url = '/api/bookings';
  if (dateFilter) url += `?date_from=${dateFilter}&date_to=${dateFilter}`;
  const res = await apiFetch(url);
  const bookings = await res.json();
  const tbody = document.getElementById('all-bookings-body');
  if (!bookings.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6" style="color:#9ca3af">Nessuna prenotazione trovata</td></tr>`;
    return;
  }
  tbody.innerHTML = bookings.map(b => `<tr>
    <td class="font-medium">${b.title}</td>
    <td><span class="flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full inline-block flex-shrink-0" style="background:${b.room_color}"></span>
      ${b.room_name}</span></td>
    <td style="color:var(--color-text-body)">${b.user_name}</td>
    <td style="color:var(--color-text-body)">${formatDate(b.date)}</td>
    <td style="color:var(--color-text-body)">${b.start_time.substring(0, 5)} – ${b.end_time.substring(0, 5)}</td>
    <td><button class="text-xs font-medium px-2.5 py-1 rounded-lg" style="color:#dc2626;background:#fef2f2"
      data-action="delete-booking" data-id="${b.id}">Elimina</button></td>
  </tr>`).join('');
}

async function deleteBooking(id) {
  if (!confirm('Eliminare questa prenotazione?')) return;
  const res = await apiFetch(`/api/bookings/${id}`, { method: 'DELETE' });
  if (res.ok) { loadAllBookings(); loadStats(); showToast('Prenotazione eliminata', 'success'); }
  else { const d = await res.json(); showToast(d.error || 'Errore', 'error'); }
}

// ── Users ─────────────────────────────────────────────────────────────────────
async function loadUsers() {
  const res = await apiFetch('/api/admin/users');
  const users = await res.json();
  const tbody = document.getElementById('users-body');
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6" style="color:#9ca3af">Nessun utente trovato</td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(u => `<tr>
    <td class="font-medium">${u.name || '—'}</td>
    <td style="color:var(--color-text-body)">${u.email}</td>
    <td><span class="badge badge-${u.role}">${u.role === 'admin' ? 'Admin' : 'Utente'}</span></td>
    <td style="color:var(--color-text-body)">${new Date(u.created_at).toLocaleDateString('it-IT')}</td>
    <td>${u.role === 'user'
      ? `<button class="text-xs font-medium px-2.5 py-1 rounded-lg" style="color:#92400e;background:#fef3c7"
           data-action="change-role" data-id="${u.id}" data-role="admin">→ Admin</button>`
      : `<button class="text-xs font-medium px-2.5 py-1 rounded-lg" style="color:var(--color-brand);background:var(--color-brand-softer)"
           data-action="change-role" data-id="${u.id}" data-role="user">→ Utente</button>`}
    </td></tr>`).join('');
}

async function changeRole(userId, role) {
  const label = role === 'admin' ? 'promuovere ad Admin' : 'riportare a Utente';
  if (!confirm(`Vuoi ${label} questo utente?`)) return;
  const res = await apiFetch(`/api/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });
  if (res.ok) { loadUsers(); showToast('Ruolo aggiornato', 'success'); }
  else { const d = await res.json(); showToast(d.error || 'Errore', 'error'); }
}

// ── Rooms ─────────────────────────────────────────────────────────────────────
async function loadRooms() {
  const res = await apiFetch('/api/rooms');
  const rooms = await res.json();
  const grid = document.getElementById('rooms-grid');
  if (!rooms.length) {
    grid.innerHTML = `<div class="col-span-3 card p-12 text-center"><div class="text-3xl mb-2">🏢</div>
      <div class="font-semibold" style="color:var(--color-text-heading)">Nessuna sala</div></div>`;
    return;
  }
  grid.innerHTML = rooms.map(r => `
    <div class="room-card p-5" style="border-left-color:${r.color}">
      <div class="flex items-start justify-between mb-3">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:${r.color}18">
          <svg class="w-5 h-5" style="color:${r.color}" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
        </div>
        <button class="text-xs font-medium px-2.5 py-1 rounded-lg" style="color:var(--color-brand);background:var(--color-brand-softer)"
          data-action="edit-room" data-id="${r.id}" data-name="${escJs(r.name)}"
          data-capacity="${r.capacity}" data-color="${r.color}" data-desc="${escJs(r.description || '')}">Modifica</button>
      </div>
      <div class="font-bold text-sm" style="color:var(--color-text-heading)">${r.name}</div>
      <div class="flex items-center gap-1.5 mt-1.5">
        <svg class="w-3.5 h-3.5" style="color:#9ca3af" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
        <span class="text-xs" style="color:var(--color-text-body)">${r.capacity} posti</span>
      </div>
      ${r.description ? `<div class="text-xs mt-2" style="color:#9ca3af">${r.description}</div>` : ''}
    </div>`).join('');
}

function escJs(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

function openRoomModal(id = '', name = '', capacity = '', color = '#1447e6', desc = '') {
  document.getElementById('room-id').value          = id;
  document.getElementById('room-name').value        = name;
  document.getElementById('room-capacity').value    = capacity;
  document.getElementById('room-color').value       = color;
  document.getElementById('room-description').value = desc;
  document.getElementById('room-modal-title').textContent = id ? 'Modifica Sala' : 'Nuova Sala';
  document.getElementById('room-error').classList.add('hidden');
  document.getElementById('room-modal').classList.remove('hidden');
}
function closeRoomModal() { document.getElementById('room-modal').classList.add('hidden'); }

async function submitRoom() {
  const id          = document.getElementById('room-id').value;
  const name        = document.getElementById('room-name').value.trim();
  const capacity    = parseInt(document.getElementById('room-capacity').value);
  const color       = document.getElementById('room-color').value;
  const description = document.getElementById('room-description').value.trim();
  const errEl = document.getElementById('room-error');
  errEl.classList.add('hidden');
  if (!name || !capacity) {
    errEl.textContent = 'Nome e capienza sono obbligatori';
    errEl.classList.remove('hidden');
    return;
  }
  const btn = document.getElementById('room-submit-btn');
  btn.textContent = 'Salvataggio…';
  btn.disabled = true;
  try {
    const res = id
      ? await apiFetch(`/api/rooms/${id}`, { method: 'PUT',  body: JSON.stringify({ name, capacity, color, description }) })
      : await apiFetch('/api/rooms',        { method: 'POST', body: JSON.stringify({ name, capacity, color, description }) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    closeRoomModal();
    loadRooms();
    showToast(id ? 'Sala aggiornata' : 'Sala creata', 'success');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.textContent = 'Salva';
    btn.disabled = false;
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
const viewLoaders = { bookings: loadAllBookings, users: loadUsers, rooms: loadRooms };

function showView(view) {
  ['dashboard', 'bookings', 'users', 'rooms'].forEach(v => {
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== view);
    const nav = document.getElementById(`nav-${v}`);
    if (v === view) { nav.classList.add('active'); nav.style.color = 'white'; }
    else            { nav.classList.remove('active'); nav.style.color = 'rgba(190,219,255,.75)'; }
  });
  if (viewLoaders[view]) viewLoaders[view]();
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function formatDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showToast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

async function doLogout() { await sb.auth.signOut(); window.location.href = '/'; }

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById('link-all-bookings').addEventListener('click', () => showView('bookings'));
document.getElementById('nav-dashboard').addEventListener('click', () => showView('dashboard'));
document.getElementById('nav-bookings').addEventListener('click',  () => showView('bookings'));
document.getElementById('nav-users').addEventListener('click',     () => showView('users'));
document.getElementById('nav-rooms').addEventListener('click',     () => showView('rooms'));
document.getElementById('btn-logout').addEventListener('click', doLogout);
document.getElementById('btn-new-room').addEventListener('click', () => openRoomModal());
document.getElementById('btn-close-room-modal').addEventListener('click', closeRoomModal);
document.getElementById('btn-cancel-room').addEventListener('click', closeRoomModal);
document.getElementById('room-submit-btn').addEventListener('click', submitRoom);
document.getElementById('filter-date').addEventListener('change', loadAllBookings);

document.getElementById('room-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeRoomModal();
});

// Event delegation for dynamically generated buttons
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id, role, name, capacity, color, desc } = btn.dataset;
  if (action === 'delete-booking') deleteBooking(id);
  if (action === 'change-role')    changeRole(id, role);
  if (action === 'edit-room')      openRoomModal(id, name, capacity, color, desc);
});

init();
