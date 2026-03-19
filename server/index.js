import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(express.json({ limit: '10mb' }));

// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Multer — save to /uploads with original extension
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomBytes(12).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

// ── Image upload ──────────────────────────────────────────────────────────

app.post('/api/upload', authMiddleware, adminOnly, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ── Auth ──────────────────────────────────────────────────────────────────

app.post('/api/auth/signup', async (req, res) => {
  const { email, password, inviteToken } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    let role = 'member';
    let tokenRow = null;
    const count = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(count.rows[0].count) === 0) {
      role = 'admin';
    } else if (inviteToken) {
      const tkRes = await pool.query(
        'SELECT * FROM invite_tokens WHERE token = $1 AND used_by IS NULL',
        [inviteToken]
      );
      if (tkRes.rows[0]) { role = 'admin'; tokenRow = tkRes.rows[0]; }
    }
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, full_name, business_name, industry, phone, created_at',
      [email.toLowerCase().trim(), hash, role]
    );
    const user = result.rows[0];
    if (tokenRow) {
      await pool.query('UPDATE invite_tokens SET used_by = $1, used_at = NOW() WHERE id = $2', [user.id, tokenRow.id]);
    }
    res.json({ token: makeToken(user), user });
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ error: 'An account with that email already exists' });
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await pool.query(
      'SELECT id, email, role, full_name, business_name, industry, phone, created_at, password_hash FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const { password_hash: _, ...safeUser } = user;
    res.json({ token: makeToken(safeUser), user: safeUser });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, full_name, business_name, industry, phone, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Profile ───────────────────────────────────────────────────────────────

app.patch('/api/profile', authMiddleware, async (req, res) => {
  const { full_name, business_name, industry, phone } = req.body || {};
  if (!full_name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = await pool.query(
      `UPDATE users SET full_name = $1, business_name = $2, industry = $3, phone = $4
       WHERE id = $5
       RETURNING id, email, role, full_name, business_name, industry, phone, created_at`,
      [full_name.trim(), business_name ?? null, industry ?? null, phone ?? null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Events ────────────────────────────────────────────────────────────────

app.get('/api/events', authMiddleware, async (req, res) => {
  try {
    const { all } = req.query;
    const query = req.user.role === 'admin' && all === 'true'
      ? 'SELECT * FROM events ORDER BY start_at ASC'
      : "SELECT * FROM events WHERE status = 'published' ORDER BY start_at ASC";
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/events/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/events', authMiddleware, adminOnly, async (req, res) => {
  const { title, description, start_at, end_at, location_name, location_address, status, image_url } = req.body || {};
  if (!title || !start_at) return res.status(400).json({ error: 'Title and start time required' });
  try {
    const result = await pool.query(
      `INSERT INTO events (title, description, start_at, end_at, location_name, location_address, status, image_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title, description ?? '', start_at, end_at ?? null, location_name ?? '', location_address ?? '', status ?? 'draft', image_url ?? null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/events/:id', authMiddleware, adminOnly, async (req, res) => {
  const { title, description, start_at, end_at, location_name, location_address, status, image_url } = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE events SET title = $1, description = $2, start_at = $3, end_at = $4,
       location_name = $5, location_address = $6, status = $7, image_url = $8
       WHERE id = $9 RETURNING *`,
      [title, description, start_at, end_at ?? null, location_name, location_address, status, image_url ?? null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/events/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM checkins WHERE event_id = $1', [req.params.id]);
    await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Check-ins ─────────────────────────────────────────────────────────────

app.get('/api/events/:id/checkins', authMiddleware, async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? `SELECT c.*, u.email, u.full_name FROM checkins c JOIN users u ON c.user_id = u.id WHERE c.event_id = $1 ORDER BY c.checked_in_at DESC`
      : `SELECT * FROM checkins WHERE event_id = $1 AND user_id = $2`;
    const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/events/:id/checkins', authMiddleware, async (req, res) => {
  try {
    const eventRes = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    const event = eventRes.rows[0];
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const now = new Date();
    const start = new Date(event.start_at);
    const windowOpen = new Date(start.getTime() - 2 * 60 * 60 * 1000);
    const windowClose = new Date(start.getTime() + 6 * 60 * 60 * 1000);

    if (now < windowOpen) {
      const minutesUntil = Math.ceil((windowOpen - now) / 60000);
      return res.status(400).json({ error: `Check-in opens ${minutesUntil} minutes before the event starts` });
    }
    if (now > windowClose) {
      return res.status(400).json({ error: 'Check-in is closed for this event' });
    }

    const result = await pool.query(
      'INSERT INTO checkins (event_id, user_id) VALUES ($1, $2) ON CONFLICT (event_id, user_id) DO NOTHING RETURNING *',
      [req.params.id, req.user.id]
    );
    res.json(result.rows[0] ?? { already_checked_in: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/events/:eventId/checkins/:userId', authMiddleware, adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM checkins WHERE event_id = $1 AND user_id = $2', [req.params.eventId, req.params.userId]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Admin Invite Tokens ───────────────────────────────────────────────────

app.post('/api/admin/invite', authMiddleware, adminOnly, async (req, res) => {
  try {
    const token = crypto.randomBytes(16).toString('hex');
    await pool.query('INSERT INTO invite_tokens (token, created_by) VALUES ($1, $2)', [token, req.user.id]);
    res.json({ token, link: `/signup?invite=${token}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/invite/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ valid: false });
  try {
    const result = await pool.query('SELECT * FROM invite_tokens WHERE token = $1 AND used_by IS NULL', [token]);
    res.json({ valid: !!result.rows[0] });
  } catch {
    res.status(500).json({ valid: false });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`API server running on port ${PORT}`));
