import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const { Pool } = pg;
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(express.json());

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

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const count = await pool.query('SELECT COUNT(*) FROM users');
    const role = parseInt(count.rows[0].count) === 0 ? 'admin' : 'member';
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, full_name, business_name, created_at',
      [email.toLowerCase().trim(), hash, role]
    );
    const user = result.rows[0];
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
      'SELECT id, email, role, full_name, business_name, created_at, password_hash FROM users WHERE email = $1',
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
      'SELECT id, email, role, full_name, business_name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/profile', authMiddleware, async (req, res) => {
  const { full_name, business_name } = req.body || {};
  try {
    const result = await pool.query(
      'UPDATE users SET full_name = $1, business_name = $2 WHERE id = $3 RETURNING id, email, role, full_name, business_name, created_at',
      [full_name ?? null, business_name ?? null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/events', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM events WHERE status = 'published' ORDER BY start_at ASC"
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/events', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { title, description, start_at, location, status } = req.body || {};
  if (!title || !start_at) return res.status(400).json({ error: 'Title and start_at required' });
  try {
    const result = await pool.query(
      'INSERT INTO events (title, description, start_at, location, status, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [title, description ?? '', start_at, location ?? '', status ?? 'draft', req.user.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/checkins/:eventId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'INSERT INTO checkins (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
      [req.params.eventId, req.user.id]
    );
    res.json(result.rows[0] ?? { already: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/checkins/:eventId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const result = await pool.query(
      'SELECT c.*, u.email, u.full_name FROM checkins c JOIN users u ON c.user_id = u.id WHERE c.event_id = $1 ORDER BY c.checked_in_at DESC',
      [req.params.eventId]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`API server running on port ${PORT}`));
