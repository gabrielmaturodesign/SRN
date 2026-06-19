const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'bookings.db');

function initDatabase() {
  const db = new DatabaseSync(DB_PATH);

  // Enable WAL mode for better performance and foreign key support
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 10,
      description TEXT,
      color TEXT NOT NULL DEFAULT '#3B82F6',
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );
  `);

  // Seed admin user if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@example.com');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)
    `).run('Amministratore', 'admin@example.com', hash, 'admin');

    // Seed sample rooms
    const insertRoom = db.prepare(
      'INSERT INTO rooms (name, capacity, description, color) VALUES (?, ?, ?, ?)'
    );
    insertRoom.run('Sala Blu', 10, 'Sala principale con proiettore e lavagna', '#3B82F6');
    insertRoom.run('Sala Verde', 6, 'Sala piccola per team meeting', '#10B981');
    insertRoom.run('Sala Rossa', 20, 'Sala conferenze grande per presentazioni', '#EF4444');
    insertRoom.run('Sala Gialla', 4, 'Sala colloqui e 1:1', '#F59E0B');

    console.log('✅ Database inizializzato con dati di esempio');
    console.log('   Admin: admin@example.com / admin123');
  }

  return db;
}

module.exports = { initDatabase };
