const express = require('express');
const cookieParser = require('cookie-parser');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── AUTH (DB yok, env'den tek kullanıcı) ─────────────────
const AUTH_USER = process.env.DEVLOG_USER || 'admin';
const AUTH_PASS = process.env.DEVLOG_PASSWORD || 'admin';
const COOKIE_NAME = 'devlog_token';
const tokens = new Set();

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function authMiddleware(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (token && tokens.has(token)) return next();
  res.status(401).json({ error: 'Oturum gerekli.' });
}

// ─── DB SETUP ─────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'devlog.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    project   TEXT    NOT NULL,
    date      TEXT    NOT NULL,
    start     TEXT,
    end       TEXT,
    minutes   INTEGER NOT NULL,
    desc      TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_date    ON entries(date);
  CREATE INDEX IF NOT EXISTS idx_project ON entries(project);
`);

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── AUTH ROUTES (korumasız) ───────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password, rememberMe } = req.body || {};
  if (username !== AUTH_USER || password !== AUTH_PASS) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }
  const token = createToken();
  tokens.add(token);
  const opts = { httpOnly: true, sameSite: 'lax', path: '/' };
  if (rememberMe) opts.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 gün
  res.cookie(COOKIE_NAME, token, opts);
  res.json({ ok: true });
});

app.get('/api/auth/check', (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (token && tokens.has(token)) return res.json({ ok: true });
  res.status(401).json({ error: 'Oturum gerekli.' });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (token) tokens.delete(token);
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

// ─── API ROUTES (auth gerekli) ─────────────────────────────
app.use('/api/entries', authMiddleware);
app.use('/api/projects', authMiddleware);

// GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD&project=...
app.get('/api/entries', (req, res) => {
  const { from, to, project } = req.query;
  let query = 'SELECT * FROM entries WHERE 1=1';
  const params = [];

  if (from)    { query += ' AND date >= ?'; params.push(from); }
  if (to)      { query += ' AND date <= ?'; params.push(to); }
  if (project) { query += ' AND project LIKE ?'; params.push(`%${project}%`); }

  query += ' ORDER BY date DESC, created_at DESC';

  try {
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/projects  — distinct project names for autocomplete
app.get('/api/projects', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT project FROM entries ORDER BY project').all();
  res.json(rows.map(r => r.project));
});

// POST /api/entries
app.post('/api/entries', (req, res) => {
  const { project, date, start, end, minutes, desc } = req.body;
  if (!project || !date || !minutes) {
    return res.status(400).json({ error: 'project, date ve minutes zorunludur.' });
  }
  const stmt = db.prepare(
    'INSERT INTO entries (project, date, start, end, minutes, desc) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(project.trim(), date, start || null, end || null, Number(minutes), desc || null);
  const row  = db.prepare('SELECT * FROM entries WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

// DELETE /api/entries/:id
app.delete('/api/entries/:id', (req, res) => {
  const info = db.prepare('DELETE FROM entries WHERE id = ?').run(Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Kayıt bulunamadı.' });
  res.json({ ok: true });
});

// ─── START ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`DevLog running on http://localhost:${PORT}`);
  console.log(`DB: ${path.join(DATA_DIR, 'devlog.db')}`);
});
