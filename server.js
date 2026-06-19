const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sala-riunioni-secret-key-2024';

// Init DB
const db = initDatabase();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth Middleware ───────────────────────────────────────────────────────────

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token mancante' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token non valido' });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accesso riservato agli amministratori' });
  }
  next();
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nome, email e password sono obbligatori' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La password deve essere di almeno 6 caratteri' });
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email già registrata' });

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)'
    ).run(name, email, hash);

    const user = { id: result.lastInsertRowid, name, email, role: 'user' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password sono obbligatori' });
  }

  try {
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row || !bcrypt.compareSync(password, row.password)) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }

    const user = { id: row.id, name: row.name, email: row.email, role: row.role };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ─── Room Routes ──────────────────────────────────────────────────────────────

// GET /api/rooms
app.get('/api/rooms', authenticateToken, (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms WHERE active = 1 ORDER BY name').all();
  res.json(rooms);
});

// POST /api/rooms (admin)
app.post('/api/rooms', authenticateToken, requireAdmin, (req, res) => {
  const { name, capacity, description, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Il nome della sala è obbligatorio' });

  const result = db.prepare(
    'INSERT INTO rooms (name, capacity, description, color) VALUES (?, ?, ?, ?)'
  ).run(name, capacity || 10, description || '', color || '#3B82F6');

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(room);
});

// PUT /api/rooms/:id (admin)
app.put('/api/rooms/:id', authenticateToken, requireAdmin, (req, res) => {
  const { name, capacity, description, color, active } = req.body;
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Sala non trovata' });

  db.prepare(`
    UPDATE rooms SET name = ?, capacity = ?, description = ?, color = ?, active = ?
    WHERE id = ?
  `).run(
    name ?? room.name,
    capacity ?? room.capacity,
    description ?? room.description,
    color ?? room.color,
    active !== undefined ? (active ? 1 : 0) : room.active,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id));
});

// DELETE /api/rooms/:id (admin)
app.delete('/api/rooms/:id', authenticateToken, requireAdmin, (req, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Sala non trovata' });

  // Soft delete
  db.prepare('UPDATE rooms SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Sala disattivata con successo' });
});

// ─── Booking Routes ───────────────────────────────────────────────────────────

// GET /api/bookings?room_id=&date_from=&date_to=
app.get('/api/bookings', authenticateToken, (req, res) => {
  const { room_id, date_from, date_to } = req.query;

  let query = `
    SELECT b.*, u.name as user_name, u.email as user_email,
           r.name as room_name, r.color as room_color
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN rooms r ON b.room_id = r.id
    WHERE 1=1
  `;
  const params = [];

  if (room_id) { query += ' AND b.room_id = ?'; params.push(room_id); }
  if (date_from) { query += ' AND b.date >= ?'; params.push(date_from); }
  if (date_to) { query += ' AND b.date <= ?'; params.push(date_to); }

  query += ' ORDER BY b.date, b.start_time';

  const bookings = db.prepare(query).all(...params);
  res.json(bookings);
});

// GET /api/bookings/mine
app.get('/api/bookings/mine', authenticateToken, (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, r.name as room_name, r.color as room_color
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    WHERE b.user_id = ?
    ORDER BY b.date DESC, b.start_time DESC
  `).all(req.user.id);
  res.json(bookings);
});

// POST /api/bookings
app.post('/api/bookings', authenticateToken, (req, res) => {
  const { room_id, title, date, start_time, end_time, notes } = req.body;

  if (!room_id || !title || !date || !start_time || !end_time) {
    return res.status(400).json({ error: 'Tutti i campi obbligatori devono essere compilati' });
  }
  if (start_time >= end_time) {
    return res.status(400).json({ error: "L'orario di fine deve essere successivo a quello di inizio" });
  }

  // Check room exists and is active
  const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND active = 1').get(room_id);
  if (!room) return res.status(404).json({ error: 'Sala non trovata' });

  // Check for overlapping bookings
  const overlap = db.prepare(`
    SELECT id FROM bookings
    WHERE room_id = ? AND date = ?
    AND NOT (end_time <= ? OR start_time >= ?)
  `).get(room_id, date, start_time, end_time);

  if (overlap) {
    return res.status(409).json({ error: 'La sala è già prenotata in questo orario' });
  }

  const result = db.prepare(`
    INSERT INTO bookings (user_id, room_id, title, date, start_time, end_time, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, room_id, title, date, start_time, end_time, notes || '');

  const booking = db.prepare(`
    SELECT b.*, r.name as room_name, r.color as room_color, u.name as user_name
    FROM bookings b
    JOIN rooms r ON b.room_id = r.id
    JOIN users u ON b.user_id = u.id
    WHERE b.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(booking);
});

// DELETE /api/bookings/:id
app.delete('/api/bookings/:id', authenticateToken, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Prenotazione non trovata' });

  if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Non hai i permessi per eliminare questa prenotazione' });
  }

  db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
  res.json({ message: 'Prenotazione eliminata con successo' });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

// GET /api/admin/users
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
  ).all();
  res.json(users);
});

// PUT /api/admin/users/:id/role
app.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Ruolo non valido' });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ message: 'Ruolo aggiornato' });
});

// GET /api/admin/stats
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalRooms = db.prepare('SELECT COUNT(*) as count FROM rooms WHERE active = 1').get().count;
  const totalBookings = db.prepare('SELECT COUNT(*) as count FROM bookings').get().count;
  const todayBookings = db.prepare(
    "SELECT COUNT(*) as count FROM bookings WHERE date = date('now', 'localtime')"
  ).get().count;

  res.json({ totalUsers, totalRooms, totalBookings, todayBookings });
});

// ─── Catch-all for SPA ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server avviato su http://localhost:${PORT}`);
  console.log(`   Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`   Premi Ctrl+C per fermare\n`);
});
