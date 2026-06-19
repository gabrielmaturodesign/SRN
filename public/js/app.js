const SUPABASE_URL      = 'https://sjajyvhedybsvspzuuhh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqYWp5dmhlZHlic3ZzcHp1dWhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NjUzMTIsImV4cCI6MjA5NzQ0MTMxMn0.LdY_mZRycnNzsxyhUAdOXMPJRuKJDePm9ioFyNrdK7A';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null, currentProfile = null, rooms = [], calendar;

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '/'; return; }
  currentUser = session.user;
  const { data: profile } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  currentProfile = profile;
  const initials = (profile?.name || currentUser.email).slice(0, 2).toUpperCase();
  document.getElementById('user-avatar').textContent = initials;
  if (profile?.role === 'admin') document.getElementById('nav-admin').classList.remove('hidden');
  await loadRooms();
  initCalendar();
  document.getElementById('b-date').value = new Date().toISOString().slice(0, 10);
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

// ── Rooms ─────────────────────────────────────────────────────────────────────
async function loadRooms() {
  const res = await apiFetch('/api/rooms');
  rooms = await res.json();
  document.getElementById('b-room').innerHTML =
    '<option value="">Seleziona sala…</option>' +
    rooms.map(r => `<option value="${r.id}">${r.name} (${r.capacity} posti)</option>`).join('');
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function initCalendar() {
  calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
    locale: 'it',
    initialView: 'dayGridMonth',
    headerToolbar: false,
    slotMinTime: '07:00:00',
    slotMaxTime: '21:00:00',
    allDaySlot: false,
    height: '100%',
    events: fetchEvents,
    eventClick: info => showEventDetail(info.event),
    dateClick: info => {
      openBookingModal();
      document.getElementById('b-date').value = info.dateStr.substring(0, 10);
    },
    datesSet: info => {
      const d = info.view.currentStart;
      document.getElementById('month-label').textContent =
        d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
         .replace(/^\w/, c => c.toUpperCase());
      updateViewTabs(info.view.type);
    },
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }
  });
  calendar.render();
}

async function fetchEvents(info, success, failure) {
  try {
    const params = new URLSearchParams({
      date_from: info.startStr.substring(0, 10),
      date_to: info.endStr.substring(0, 10)
    });
    const res = await apiFetch(`/api/bookings?${params}`);
    const bookings = await res.json();
    success(bookings.map(b => ({
      id: b.id,
      title: `${b.start_time.substring(0, 5)} ${b.title}`,
      start: `${b.date}T${b.start_time}`,
      end: `${b.date}T${b.end_time}`,
      backgroundColor: b.room_color + '22',
      borderColor: b.room_color,
      textColor: b.room_color,
      extendedProps: { booking: b }
    })));
  } catch (e) { failure(e); }
}

function calNav(action) {
  if (action === 'prev') calendar.prev();
  else if (action === 'next') calendar.next();
  else calendar.today();
}

function setCalView(view) {
  calendar.changeView(view);
  updateViewTabs(view);
}

function updateViewTabs(viewType) {
  const map = { dayGridMonth: 2, timeGridWeek: 1, timeGridDay: 0, listWeek: 3 };
  document.querySelectorAll('.view-tab').forEach((btn, i) => {
    btn.classList.toggle('active', i === (map[viewType] ?? 2));
  });
}

// ── Event detail ──────────────────────────────────────────────────────────────
function showEventDetail(event) {
  const b = event.extendedProps.booking;
  document.getElementById('detail-title').textContent = b.title;
  document.getElementById('detail-body').innerHTML = `
    <div class="detail-row">
      <span class="room-dot" style="background:${b.room_color}"></span>
      <strong>${b.room_name}</strong>
    </div>
    <div class="detail-row">
      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
      ${formatDate(b.date)}
    </div>
    <div class="detail-row">
      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      ${b.start_time.substring(0, 5)} – ${b.end_time.substring(0, 5)}
    </div>
    <div class="detail-row">
      <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
      ${b.user_name}
    </div>
    ${b.notes ? `<div class="detail-notes">${b.notes}</div>` : ''}`;
  const canDelete = currentUser?.id === b.user_id || currentProfile?.role === 'admin';
  document.getElementById('detail-footer').innerHTML = canDelete
    ? `<button class="btn-cancel" data-action="close-detail">Chiudi</button>
       <button class="btn-danger" data-action="delete-booking" data-id="${b.id}">Elimina prenotazione</button>`
    : `<button class="btn-confirm" data-action="close-detail">Chiudi</button>`;
  document.getElementById('detail-modal').classList.remove('hidden');
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.add('hidden');
}

async function deleteBooking(id) {
  if (!confirm('Eliminare questa prenotazione?')) return;
  const res = await apiFetch(`/api/bookings/${id}`, { method: 'DELETE' });
  if (res.ok) {
    closeDetailModal();
    calendar.refetchEvents();
    if (!document.getElementById('view-my-bookings').classList.contains('hidden')) loadMyBookings();
    showToast('Prenotazione eliminata', 'success');
  } else {
    const d = await res.json();
    showToast(d.error || 'Errore', 'error');
  }
}

// ── My bookings ───────────────────────────────────────────────────────────────
async function loadMyBookings() {
  const res = await apiFetch('/api/bookings/mine');
  const bookings = await res.json();
  const container = document.getElementById('bookings-list');
  if (!bookings.length) {
    container.innerHTML = `<div class="empty-state"><div>📅</div><p>Nessuna prenotazione ancora</p></div>`;
    return;
  }
  const today  = new Date().toISOString().slice(0, 10);
  const future = bookings.filter(b => b.date >= today);
  const past   = bookings.filter(b => b.date < today);
  let html = '';
  if (future.length) html += `<div class="section-label">Prossime</div>` + future.map(bookingItem).join('');
  if (past.length)   html += `<div class="section-label">Passate</div>`  + past.map(b => bookingItem(b, false)).join('');
  container.innerHTML = html;
}

function bookingItem(b, canDelete = true) {
  return `<div class="booking-item" style="border-left-color:${b.room_color}">
    <div class="booking-info">
      <div class="booking-title">${b.title}</div>
      <div class="booking-meta">
        <span><span class="room-dot" style="background:${b.room_color}"></span>${b.room_name}</span>
        <span>${formatDate(b.date)}</span>
        <span>${b.start_time.substring(0, 5)} – ${b.end_time.substring(0, 5)}</span>
      </div>
      ${b.notes ? `<div class="booking-notes">${b.notes}</div>` : ''}
    </div>
    ${canDelete
      ? `<button class="delete-btn" data-action="delete-booking" data-id="${b.id}" aria-label="Elimina">
           <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
         </button>`
      : ''}
  </div>`;
}

// ── Booking modal ─────────────────────────────────────────────────────────────
function openBookingModal() {
  document.getElementById('booking-error').classList.add('hidden');
  document.getElementById('booking-modal').classList.remove('hidden');
}
function closeBookingModal() {
  document.getElementById('booking-modal').classList.add('hidden');
}

async function submitBooking() {
  const title      = document.getElementById('b-title').value.trim();
  const room_id    = document.getElementById('b-room').value;
  const date       = document.getElementById('b-date').value;
  const start_time = document.getElementById('b-start').value;
  const end_time   = document.getElementById('b-end').value;
  const notes      = document.getElementById('b-notes').value.trim();
  const errEl      = document.getElementById('booking-error');
  errEl.classList.add('hidden');
  if (!title || !room_id || !date || !start_time || !end_time) {
    errEl.textContent = 'Compila tutti i campi obbligatori.';
    errEl.classList.remove('hidden');
    return;
  }
  const btn = document.getElementById('submit-btn');
  btn.textContent = 'Prenotazione in corso…';
  btn.disabled = true;
  try {
    const res = await apiFetch('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ room_id: parseInt(room_id), title, date, start_time, end_time, notes })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    closeBookingModal();
    calendar.refetchEvents();
    if (!document.getElementById('view-my-bookings').classList.contains('hidden')) loadMyBookings();
    showToast('Prenotazione creata! 🎉', 'success');
    document.getElementById('b-title').value = '';
    document.getElementById('b-notes').value = '';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.textContent = 'Prenota';
    btn.disabled = false;
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────
function showView(view) {
  const isCalendar = view === 'calendar';
  document.getElementById('view-calendar').classList.toggle('hidden', !isCalendar);
  document.getElementById('view-my-bookings').classList.toggle('hidden', isCalendar);
  document.getElementById('topbar-left').classList.toggle('hidden', !isCalendar);
  document.getElementById('view-tabs').classList.toggle('hidden', !isCalendar);
  document.getElementById('nav-calendar').classList.toggle('active', isCalendar);
  document.getElementById('nav-bookings').classList.toggle('active', !isCalendar);
  if (!isCalendar) loadMyBookings();
  else setTimeout(() => calendar.updateSize(), 50);
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function formatDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' });
}

function showToast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

async function doLogout() {
  await sb.auth.signOut();
  window.location.href = '/';
}

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById('btn-prev').addEventListener('click', () => calNav('prev'));
document.getElementById('btn-next').addEventListener('click', () => calNav('next'));
document.getElementById('btn-today').addEventListener('click', () => calNav('today'));
document.getElementById('btn-new-booking').addEventListener('click', openBookingModal);
document.getElementById('btn-logout').addEventListener('click', doLogout);
document.getElementById('nav-calendar').addEventListener('click', () => showView('calendar'));
document.getElementById('nav-bookings').addEventListener('click', () => showView('my-bookings'));
document.getElementById('nav-admin').addEventListener('click', () => { window.location.href = '/admin.html'; });
document.getElementById('submit-btn').addEventListener('click', submitBooking);
document.getElementById('close-booking-modal').addEventListener('click', closeBookingModal);
document.getElementById('cancel-booking-btn').addEventListener('click', closeBookingModal);
document.getElementById('close-detail-modal').addEventListener('click', closeDetailModal);

// View tab buttons
document.querySelectorAll('.view-tab').forEach(btn => {
  btn.addEventListener('click', () => setCalView(btn.dataset.calView));
});

// Overlay click to close
document.getElementById('booking-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeBookingModal();
});
document.getElementById('detail-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDetailModal();
});

// Event delegation for dynamically generated buttons
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (action === 'delete-booking') deleteBooking(id);
  if (action === 'close-detail') closeDetailModal();
});

init();
