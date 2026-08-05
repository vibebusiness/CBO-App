import express from 'express';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { fromZonedTime } from 'date-fns-tz';

const ET = 'America/New_York';

// Messaging closes at midnight (ET) at the end of the event's calendar day.
// Returns the UTC Date of that cutoff for a given event start_at.
function eventMessagingCutoff(startAt) {
  const dayET = new Intl.DateTimeFormat('en-CA', {
    timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(startAt)); // e.g. "2026-06-24"
  const next = new Date(`${dayET}T00:00:00`);
  next.setUTCDate(next.getUTCDate() + 1); // next calendar day (string math safe via UTC parts)
  const nextDayET = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  return fromZonedTime(`${nextDayET}T00:00:00`, ET); // midnight ET of the day AFTER the event day
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
function getOpenAI() {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    throw new Error('AI integration not configured');
  }
  return new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
}

app.use(express.json({ limit: '10mb' }));

// Request logger — helps debug routing issues
app.use((req, _res, next) => {
  if (req.path.startsWith('/api')) console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// Create event_images table on startup so images persist in PostgreSQL across deployments
pool.query(`
  CREATE TABLE IF NOT EXISTS event_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data bytea NOT NULL,
    mime_type varchar(64) NOT NULL,
    created_at timestamptz DEFAULT now()
  )
`).catch((e) => console.error('event_images table init failed:', e));

// Add has_networking column to events (idempotent)
pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS has_networking boolean DEFAULT false`)
  .catch((e) => console.error('has_networking column init failed:', e));

// Create networking tables
pool.query(`
  CREATE TABLE IF NOT EXISTS networking_rounds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL,
    round_number int NOT NULL,
    group_size int NOT NULL DEFAULT 5,
    created_at timestamptz DEFAULT now()
  )
`).catch((e) => console.error('networking_rounds table init failed:', e));

pool.query(`
  CREATE TABLE IF NOT EXISTS networking_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id uuid NOT NULL,
    user_id uuid NOT NULL,
    group_label varchar(4) NOT NULL,
    created_at timestamptz DEFAULT now()
  )
`).catch((e) => console.error('networking_assignments table init failed:', e));

// Add tagline column to users
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tagline varchar(120)`)
  .catch((e) => console.error('tagline column init failed:', e));

// user_avatars — headshots stored in PostgreSQL (upserted per user)
pool.query(`
  CREATE TABLE IF NOT EXISTS user_avatars (
    user_id uuid PRIMARY KEY,
    data bytea NOT NULL,
    mime_type varchar(64) NOT NULL,
    updated_at timestamptz DEFAULT now()
  )
`).catch((e) => console.error('user_avatars table init failed:', e));

// Add avatar_url to users
pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url varchar(255)`)
  .catch((e) => console.error('avatar_url column init failed:', e));

// event_conversations — one chat thread per pair of members per event.
// participant_a/participant_b store the pair sorted (a < b) so the unique
// constraint dedupes regardless of who started it.
pool.query(`
  CREATE TABLE IF NOT EXISTS event_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL,
    participant_a uuid NOT NULL,
    participant_b uuid NOT NULL,
    initiator_id uuid NOT NULL,
    a_last_read_at timestamptz DEFAULT now(),
    b_last_read_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    UNIQUE(event_id, participant_a, participant_b)
  )
`).catch((e) => console.error('event_conversations table init failed:', e));

pool.query(`
  CREATE TABLE IF NOT EXISTS event_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    body text NOT NULL,
    sent_at timestamptz DEFAULT now()
  )
`)
  .then(() => pool.query(`CREATE INDEX IF NOT EXISTS idx_event_messages_conv ON event_messages (conversation_id, sent_at)`))
  .catch((e) => console.error('event_messages table/index init failed:', e));

// Create event_feedback table
pool.query(`
  CREATE TABLE IF NOT EXISTS event_feedback (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    enjoyment_rating int NOT NULL,
    event_size_preference varchar(10),
    one_change text,
    additional_feedback text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(event_id, user_id)
  )
`).catch((e) => console.error('event_feedback table init failed:', e));

// Create password_resets table for forgot-password flow
pool.query(`
  CREATE TABLE IF NOT EXISTS password_resets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    token varchar(128) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz DEFAULT now()
  )
`).catch((e) => console.error('password_resets table init failed:', e));

// ── SSE — networking live updates ─────────────────────────────────────────
const networkingSseClients = new Map(); // eventId → Set<res>

function broadcastNetworkingUpdate(eventId, payload) {
  const clients = networkingSseClients.get(eventId);
  if (!clients) return;
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try {
      client.write(msg);
    } catch {
      clients.delete(client);
    }
  }
}

// Prevent a stale SSE socket from crashing the whole server
process.on('uncaughtException', (err) => {
  console.error('[server] uncaughtException (suppressed):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection (suppressed):', reason);
});

// Assign attendees to groups minimising repeat pairings (50-attempt greedy shuffle)
function buildNetworkingGroups(userIds, groupSize, pastAssignments) {
  const pairedBefore = new Set();
  const byGroup = {};
  for (const a of pastAssignments) {
    const key = `${a.round_id}:${a.group_label}`;
    if (!byGroup[key]) byGroup[key] = [];
    byGroup[key].push(a.user_id);
  }
  for (const members of Object.values(byGroup)) {
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++)
        pairedBefore.add([members[i], members[j]].sort().join(':'));
  }
  function score(arr) {
    let s = 0;
    for (let i = 0; i < arr.length; i += groupSize) {
      const g = arr.slice(i, Math.min(i + groupSize, arr.length));
      for (let a = 0; a < g.length; a++)
        for (let b = a + 1; b < g.length; b++)
          if (pairedBefore.has([g[a], g[b]].sort().join(':'))) s++;
    }
    return s;
  }
  let best = [...userIds];
  let bestScore = Infinity;
  for (let t = 0; t < 50; t++) {
    const shuffled = [...userIds].sort(() => Math.random() - 0.5);
    const sc = score(shuffled);
    if (sc < bestScore) { bestScore = sc; best = shuffled; if (sc === 0) break; }
  }
  const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const groups = [];
  for (let i = 0; i < best.length; i += groupSize) {
    groups.push({
      label: LABELS[groups.length] ?? String(groups.length + 1),
      members: best.slice(i, Math.min(i + groupSize, best.length)),
    });
  }
  return groups;
}

// ── GHL email helper ───────────────────────────────────────────────────────

async function sendGhlPasswordResetEmail(toEmail, resetLink) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) {
    console.error('GHL_API_KEY or GHL_LOCATION_ID not set — skipping email send');
    return;
  }

  const GHL = 'https://services.leadconnectorhq.com';
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Version: '2021-04-15',
  };

  // 1. Find existing contact or create one
  let contactId;
  try {
    const searchRes = await fetch(
      `${GHL}/contacts/?locationId=${locationId}&query=${encodeURIComponent(toEmail)}`,
      { headers }
    );
    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error(`GHL contact search failed (${searchRes.status}):`, errText);
      throw new Error('GHL contact search failed');
    }
    const searchData = await searchRes.json();
    const found = (searchData.contacts ?? searchData.data ?? []).find(
      (c) => c.email?.toLowerCase() === toEmail.toLowerCase()
    );
    if (found) {
      contactId = found.id;
    } else {
      const createRes = await fetch(`${GHL}/contacts/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ locationId, email: toEmail }),
      });
      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error(`GHL contact create failed (${createRes.status}):`, errText);
        throw new Error('GHL contact create failed');
      }
      const createData = await createRes.json();
      contactId = createData.contact?.id;
    }
  } catch (e) {
    console.error('GHL contact lookup/create failed:', e);
    throw e;
  }

  if (!contactId) throw new Error('Could not obtain GHL contactId');

  // 2. Send the email via GHL conversations API
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <img src="https://cbo-app.replit.app/cbo-logo.png" alt="Charlotte Business Owners" style="height:48px; margin-bottom:24px;" />
      <h2 style="color:#0f172a; margin-bottom:8px;">Password Reset</h2>
      <p style="color:#475569;">You requested a password reset for your Charlotte Business Owners account. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${resetLink}" style="display:inline-block; margin-top:20px; padding:12px 24px; background:#0f172a; color:#fff; text-decoration:none; border-radius:10px; font-weight:600;">Reset my password</a>
      <p style="margin-top:24px; color:#94a3b8; font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;" />
      <p style="color:#94a3b8; font-size:12px;">Charlotte Business Owners · Charlotte, NC</p>
    </div>
  `;
  const message = `Reset your Charlotte Business Owners password by visiting: ${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`;

  const msgRes = await fetch(`${GHL}/conversations/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'Email',
      contactId,
      locationId,
      subject: 'Charlotte Business Owners Password Reset',
      html,
      message,
    }),
  });

  if (!msgRes.ok) {
    const err = await msgRes.text();
    console.error('GHL message send failed:', err);
    throw new Error('Email delivery failed');
  }
}

// Serve user avatar headshots
app.get('/avatars/:userId', async (req, res) => {
  try {
    const result = await pool.query('SELECT data, mime_type FROM user_avatars WHERE user_id = $1', [req.params.userId]);
    if (!result.rows.length) return res.status(404).send('Not found');
    const { data, mime_type } = result.rows[0];
    res.setHeader('Content-Type', mime_type);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.send(data);
  } catch (e) {
    console.error('Avatar serve error:', e);
    res.status(500).send('Error');
  }
});

// Serve uploaded images directly from PostgreSQL
app.get('/uploads/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT data, mime_type FROM event_images WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).send('Not found');
    const { data, mime_type } = result.rows[0];
    res.setHeader('Content-Type', mime_type);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(data);
  } catch (e) {
    console.error('Image serve error:', e);
    res.status(500).send('Error');
  }
});

// Multer — memory storage; bytes are written to PostgreSQL in the upload handler
const upload = multer({
  storage: multer.memoryStorage(),
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

app.post('/api/upload', authMiddleware, adminOnly, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    const result = await pool.query(
      'INSERT INTO event_images (data, mime_type) VALUES ($1, $2) RETURNING id',
      [req.file.buffer, req.file.mimetype]
    );
    res.json({ url: `/uploads/${result.rows[0].id}` });
  } catch (e) {
    console.error('Image upload error:', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ── Avatar upload ─────────────────────────────────────────────────────────

app.post('/api/profile/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  try {
    await pool.query(
      `INSERT INTO user_avatars (user_id, data, mime_type, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) DO UPDATE SET data = $2, mime_type = $3, updated_at = NOW()`,
      [req.user.id, req.file.buffer, req.file.mimetype]
    );
    const avatarUrl = `/avatars/${req.user.id}`;
    await pool.query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, req.user.id]);
    res.json({ avatar_url: avatarUrl });
  } catch (e) {
    console.error('Avatar upload error:', e);
    res.status(500).json({ error: 'Upload failed' });
  }
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
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, full_name, business_name, tagline, industry, phone, avatar_url, created_at',
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
      'SELECT id, email, role, full_name, business_name, tagline, industry, phone, avatar_url, created_at, password_hash FROM users WHERE email = $1',
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
      'SELECT id, email, role, full_name, business_name, tagline, industry, phone, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot-password — generate token and send reset email via GHL
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }
  const normalised = email.toLowerCase().trim();
  try {
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [normalised]);
    if (!userRes.rows[0]) {
      console.info(`[forgot-password] no account for ${normalised}`);
      return res.json({ ok: true, exists: false });
    }
    // Account exists — confirm to the client, then dispatch the reset email.
    res.json({ ok: true, exists: true });
    const userId = userRes.rows[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );
    const appUrl = process.env.APP_URL || 'https://cbo-app.replit.app';
    const resetLink = `${appUrl}/reset-password?token=${token}`;
    if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) {
      console.warn('[forgot-password] GHL_API_KEY or GHL_LOCATION_ID missing — reset email NOT sent');
      return;
    }
    await sendGhlPasswordResetEmail(normalised, resetLink);
    console.info(`[forgot-password] reset email dispatched to ${normalised}`);
  } catch (e) {
    console.error('[forgot-password] error:', e);
    if (!res.headersSent) res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET /api/auth/reset-password/validate?token= — check if a reset token is still valid
app.get('/api/auth/reset-password/validate', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ valid: false, error: 'Token required' });
  try {
    const result = await pool.query(
      'SELECT id FROM password_resets WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()',
      [token]
    );
    res.json({ valid: !!result.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ valid: false, error: 'Server error' });
  }
});

// POST /api/auth/reset-password — consume token atomically and update password
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Token and password are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Atomically mark the token as used and return the user_id in one statement
    const resetRes = await client.query(
      `UPDATE password_resets
         SET used_at = NOW()
       WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING user_id`,
      [token]
    );
    if (!resetRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This reset link has expired or already been used.' });
    }
    const { user_id: userId } = resetRes.rows[0];
    const hash = await bcrypt.hash(password, 10);
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userId]);
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ── Profile ───────────────────────────────────────────────────────────────

app.patch('/api/profile', authMiddleware, async (req, res) => {
  const { full_name, business_name, tagline, industry, phone } = req.body || {};
  if (!full_name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const result = await pool.query(
      `UPDATE users SET full_name = $1, business_name = $2, tagline = $3, industry = $4, phone = $5
       WHERE id = $6
       RETURNING id, email, role, full_name, business_name, tagline, industry, phone, avatar_url, created_at`,
      [full_name.trim(), business_name ?? null, tagline ? tagline.slice(0, 120) : null, industry ?? null, phone ?? null, req.user.id]
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
  const { title, description, start_at, end_at, location_name, location_address, status, image_url, has_raffle, has_networking } = req.body || {};
  if (!title || !start_at) return res.status(400).json({ error: 'Title and start time required' });
  try {
    const result = await pool.query(
      `INSERT INTO events (title, description, start_at, end_at, location_name, location_address, status, image_url, has_raffle, has_networking, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [title, description ?? '', start_at, end_at ?? null, location_name ?? '', location_address ?? '', status ?? 'draft', image_url ?? null, has_raffle ?? false, has_networking ?? false, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.patch('/api/events/:id', authMiddleware, adminOnly, async (req, res) => {
  const { title, description, start_at, end_at, location_name, location_address, status, image_url, has_raffle, has_networking } = req.body || {};
  try {
    const result = await pool.query(
      `UPDATE events SET title = $1, description = $2, start_at = $3, end_at = $4,
       location_name = $5, location_address = $6, status = $7, image_url = $8,
       has_raffle = $9, has_networking = $10
       WHERE id = $11 RETURNING *`,
      [title, description, start_at, end_at ?? null, location_name, location_address, status, image_url ?? null, has_raffle ?? false, has_networking ?? false, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Event not found' });
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Raffle ─────────────────────────────────────────────────────────────────

app.get('/api/events/:id/raffle/participants', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.email, u.full_name
       FROM checkins c JOIN users u ON c.user_id = u.id
       WHERE c.event_id = $1
         AND c.user_id NOT IN (
           SELECT user_id FROM raffle_winners WHERE event_id = $1
         )
       ORDER BY c.checked_in_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/events/:id/raffle/winners', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rw.*, u.email, u.full_name
       FROM raffle_winners rw JOIN users u ON rw.user_id = u.id
       WHERE rw.event_id = $1
       ORDER BY rw.won_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/events/:id/raffle/winner', authMiddleware, adminOnly, async (req, res) => {
  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  try {
    const result = await pool.query(
      `INSERT INTO raffle_winners (event_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (event_id, user_id) DO NOTHING
       RETURNING *`,
      [req.params.id, user_id]
    );
    res.json(result.rows[0] ?? { already_won: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Networking Rounds ─────────────────────────────────────────────────────

// SSE stream: members subscribe here; admin running a round pushes an update
app.get('/api/events/:id/networking/stream', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).end();
  try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).end(); }
  const eventId = req.params.id;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write('data: {"connected":true}\n\n');
  if (!networkingSseClients.has(eventId)) networkingSseClients.set(eventId, new Set());
  networkingSseClients.get(eventId).add(res);
  const cleanup = () => { networkingSseClients.get(eventId)?.delete(res); };
  req.on('close', cleanup);
  res.on('error', cleanup);
  res.socket?.on('error', cleanup);
});

// Admin: run a new networking round
app.post('/api/events/:id/networking/round', authMiddleware, adminOnly, async (req, res) => {
  const groupSize = Math.max(2, Math.min(20, parseInt(req.body?.group_size) || 5));
  const eventId = req.params.id;
  try {
    const checkinRes = await pool.query('SELECT user_id FROM checkins WHERE event_id = $1', [eventId]);
    const userIds = checkinRes.rows.map((r) => r.user_id);
    if (userIds.length < 2) return res.status(400).json({ error: 'Need at least 2 checked-in attendees to form groups' });

    const pastRes = await pool.query(
      `SELECT na.round_id, na.user_id, na.group_label
       FROM networking_assignments na
       JOIN networking_rounds nr ON na.round_id = nr.id
       WHERE nr.event_id = $1`,
      [eventId]
    );
    const countRes = await pool.query('SELECT COUNT(*) FROM networking_rounds WHERE event_id = $1', [eventId]);
    const roundNumber = parseInt(countRes.rows[0].count) + 1;

    const groups = buildNetworkingGroups(userIds, groupSize, pastRes.rows);

    const client = await pool.connect();
    let roundId;
    try {
      await client.query('BEGIN');
      const roundRes = await client.query(
        'INSERT INTO networking_rounds (event_id, round_number, group_size) VALUES ($1, $2, $3) RETURNING id',
        [eventId, roundNumber, groupSize]
      );
      roundId = roundRes.rows[0].id;
      for (const group of groups) {
        for (const userId of group.members) {
          await client.query(
            'INSERT INTO networking_assignments (round_id, user_id, group_label) VALUES ($1, $2, $3)',
            [roundId, userId, group.label]
          );
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    broadcastNetworkingUpdate(eventId, { round: roundNumber });
    res.json({ round_number: roundNumber, group_count: groups.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: all rounds with full group membership
app.get('/api/events/:id/networking/rounds', authMiddleware, adminOnly, async (req, res) => {
  try {
    const roundsRes = await pool.query(
      'SELECT * FROM networking_rounds WHERE event_id = $1 ORDER BY round_number ASC',
      [req.params.id]
    );
    if (roundsRes.rows.length === 0) return res.json([]);

    const roundIds = roundsRes.rows.map((r) => r.id);
    const assignRes = await pool.query(
      `SELECT na.round_id, na.group_label, na.user_id, u.full_name, u.email
       FROM networking_assignments na
       JOIN users u ON na.user_id = u.id
       WHERE na.round_id = ANY($1)
       ORDER BY na.group_label ASC, u.full_name ASC`,
      [roundIds]
    );
    const byRound = {};
    for (const a of assignRes.rows) {
      if (!byRound[a.round_id]) byRound[a.round_id] = {};
      if (!byRound[a.round_id][a.group_label]) byRound[a.round_id][a.group_label] = [];
      byRound[a.round_id][a.group_label].push({ user_id: a.user_id, full_name: a.full_name, email: a.email });
    }
    const result = roundsRes.rows.map((r) => ({
      ...r,
      groups: Object.entries(byRound[r.id] || {})
        .map(([label, members]) => ({ label, members }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    }));
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: reset all rounds for an event (erase all history)
app.delete('/api/events/:id/networking/reset', authMiddleware, adminOnly, async (req, res) => {
  try {
    const roundsRes = await pool.query(
      'SELECT id FROM networking_rounds WHERE event_id = $1',
      [req.params.id]
    );
    if (roundsRes.rows.length > 0) {
      const roundIds = roundsRes.rows.map((r) => r.id);
      await pool.query('DELETE FROM networking_assignments WHERE round_id = ANY($1)', [roundIds]);
      await pool.query('DELETE FROM networking_rounds WHERE event_id = $1', [req.params.id]);
    }
    broadcastNetworkingUpdate(req.params.id, { reset: true });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Member: their group assignment in the latest round
app.get('/api/events/:id/networking/current', authMiddleware, async (req, res) => {
  try {
    const roundRes = await pool.query(
      'SELECT * FROM networking_rounds WHERE event_id = $1 ORDER BY round_number DESC LIMIT 1',
      [req.params.id]
    );
    if (!roundRes.rows[0]) return res.json(null);
    const round = roundRes.rows[0];

    const assignRes = await pool.query(
      'SELECT group_label FROM networking_assignments WHERE round_id = $1 AND user_id = $2',
      [round.id, req.user.id]
    );
    if (!assignRes.rows[0]) return res.json(null);
    const groupLabel = assignRes.rows[0].group_label;

    const membersRes = await pool.query(
      `SELECT na.user_id, u.full_name
       FROM networking_assignments na
       JOIN users u ON na.user_id = u.id
       WHERE na.round_id = $1 AND na.group_label = $2
       ORDER BY u.full_name ASC`,
      [round.id, groupLabel]
    );
    res.json({
      round_number: round.round_number,
      group_label: groupLabel,
      group_size: round.group_size,
      members: membersRes.rows
        .filter((m) => m.user_id !== req.user.id)
        .map((m) => ({ user_id: m.user_id, full_name: m.full_name })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Attendee Directory ────────────────────────────────────────────────────

app.get('/api/events/:id/attendees', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.full_name, u.industry, u.business_name, u.tagline, u.avatar_url
       FROM checkins c
       JOIN users u ON c.user_id = u.id
       WHERE c.event_id = $1
       ORDER BY u.full_name ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Event Feedback ────────────────────────────────────────────────────────

app.get('/api/events/:id/my-feedback', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM event_feedback WHERE event_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json(result.rows[0] ?? null);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/events/:id/feedback', authMiddleware, async (req, res) => {
  const { enjoyment_rating, event_size_preference, one_change, additional_feedback } = req.body;
  const rating = parseInt(enjoyment_rating, 10);
  if (!rating || rating < 1 || rating > 10) {
    return res.status(400).json({ error: 'Rating must be between 1 and 10' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO event_feedback (event_id, user_id, enjoyment_rating, event_size_preference, one_change, additional_feedback)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (event_id, user_id) DO UPDATE SET
         enjoyment_rating = EXCLUDED.enjoyment_rating,
         event_size_preference = EXCLUDED.event_size_preference,
         one_change = EXCLUDED.one_change,
         additional_feedback = EXCLUDED.additional_feedback
       RETURNING *`,
      [req.params.id, req.user.id, rating, event_size_preference || null, one_change || null, additional_feedback || null]
    );
    res.json(result.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/events/:id/feedback', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ef.*, u.full_name, u.email, u.business_name
       FROM event_feedback ef
       JOIN users u ON ef.user_id = u.id
       WHERE ef.event_id = $1
       ORDER BY ef.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
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

// ── Connect at Event: conversations & messages ────────────────────────────

// Helper: load an event and confirm messaging is still open (before ET midnight
// of the event day). Returns { event, closed }.
async function loadEventForMessaging(eventId) {
  const r = await pool.query('SELECT id, start_at FROM events WHERE id = $1', [eventId]);
  const event = r.rows[0];
  if (!event) return { event: null, closed: true };
  const closed = new Date() >= eventMessagingCutoff(event.start_at);
  return { event, closed };
}

// Both members must be checked into the event to message each other there.
async function bothCheckedIn(eventId, userA, userB) {
  const r = await pool.query(
    'SELECT user_id FROM checkins WHERE event_id = $1 AND user_id = ANY($2)',
    [eventId, [userA, userB]]
  );
  const ids = new Set(r.rows.map((row) => row.user_id));
  return ids.has(userA) && ids.has(userB);
}

// Start or fetch a conversation with a recipient for an event.
app.post('/api/events/:eventId/conversations', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const recipientId = req.body.recipientId;
    if (!recipientId) return res.status(400).json({ error: 'recipientId required' });
    if (recipientId === me) return res.status(400).json({ error: "You can't message yourself" });

    const { event, closed } = await loadEventForMessaging(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (closed) return res.status(403).json({ error: 'Messaging is closed for this event' });
    if (!(await bothCheckedIn(req.params.eventId, me, recipientId))) {
      return res.status(403).json({ error: 'Both members must be checked in to connect' });
    }

    const [a, b] = me < recipientId ? [me, recipientId] : [recipientId, me];
    const result = await pool.query(
      `INSERT INTO event_conversations (event_id, participant_a, participant_b, initiator_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id, participant_a, participant_b) DO UPDATE SET event_id = EXCLUDED.event_id
       RETURNING id`,
      [req.params.eventId, a, b, me]
    );
    res.json({ id: result.rows[0].id });
  } catch (e) {
    console.error('start conversation error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// List the caller's conversations for an event, with the other person, latest
// message snippet and unread count.
app.get('/api/events/:eventId/conversations', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const result = await pool.query(
      `SELECT
         c.id,
         CASE WHEN c.participant_a = $2 THEN c.participant_b ELSE c.participant_a END AS other_id,
         u.full_name AS other_name,
         u.business_name AS other_business,
         u.avatar_url AS other_avatar,
         (SELECT body FROM event_messages m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC LIMIT 1) AS last_body,
         (SELECT sent_at FROM event_messages m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC LIMIT 1) AS last_at,
         (SELECT COUNT(*) FROM event_messages m
            WHERE m.conversation_id = c.id
              AND m.sender_id <> $2
              AND m.sent_at > CASE WHEN c.participant_a = $2 THEN c.a_last_read_at ELSE c.b_last_read_at END
         )::int AS unread
       FROM event_conversations c
       JOIN users u ON u.id = (CASE WHEN c.participant_a = $2 THEN c.participant_b ELSE c.participant_a END)
       WHERE c.event_id = $1 AND (c.participant_a = $2 OR c.participant_b = $2)
       ORDER BY last_at DESC NULLS LAST, c.created_at DESC`,
      [req.params.eventId, me]
    );
    res.json(result.rows);
  } catch (e) {
    console.error('list conversations error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Fetch message history for a conversation (marks it read for the caller).
app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const convRes = await pool.query('SELECT * FROM event_conversations WHERE id = $1', [req.params.id]);
    const conv = convRes.rows[0];
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (conv.participant_a !== me && conv.participant_b !== me) {
      return res.status(403).json({ error: 'Not your conversation' });
    }

    const msgs = await pool.query(
      `SELECT id, sender_id, body, sent_at FROM event_messages
       WHERE conversation_id = $1 ORDER BY sent_at ASC LIMIT 200`,
      [req.params.id]
    );

    // Mark read only up to the newest message we actually returned, so a message
    // arriving after this SELECT isn't silently marked read (never advances backwards).
    const col = conv.participant_a === me ? 'a_last_read_at' : 'b_last_read_at';
    if (msgs.rows.length > 0) {
      const lastSentAt = msgs.rows[msgs.rows.length - 1].sent_at;
      await pool.query(
        `UPDATE event_conversations SET ${col} = GREATEST(${col}, $2) WHERE id = $1`,
        [req.params.id, lastSentAt]
      );
    }

    const { closed } = await loadEventForMessaging(conv.event_id);
    res.json({ messages: msgs.rows, closed });
  } catch (e) {
    console.error('get messages error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a message in a conversation.
app.post('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const body = (req.body.body ?? '').toString().trim();
    if (!body) return res.status(400).json({ error: 'Message cannot be empty' });
    if (body.length > 2000) return res.status(400).json({ error: 'Message is too long' });

    const convRes = await pool.query('SELECT * FROM event_conversations WHERE id = $1', [req.params.id]);
    const conv = convRes.rows[0];
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (conv.participant_a !== me && conv.participant_b !== me) {
      return res.status(403).json({ error: 'Not your conversation' });
    }

    const { closed } = await loadEventForMessaging(conv.event_id);
    if (closed) return res.status(403).json({ error: 'Messaging is closed for this event' });

    const inserted = await pool.query(
      `INSERT INTO event_messages (conversation_id, sender_id, body)
       VALUES ($1, $2, $3) RETURNING id, sender_id, body, sent_at`,
      [req.params.id, me, body]
    );
    // Sending also counts as having read everything up to now on your side.
    const col = conv.participant_a === me ? 'a_last_read_at' : 'b_last_read_at';
    await pool.query(`UPDATE event_conversations SET ${col} = now() WHERE id = $1`, [req.params.id]);

    res.json(inserted.rows[0]);
  } catch (e) {
    console.error('send message error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI-drafted icebreaker for a recipient. Fails soft — returns an empty draft
// rather than an error so the sender can always write their own.
app.post('/api/events/:eventId/connections/ai-draft', authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const recipientId = req.body.recipientId;
    if (!recipientId) return res.status(400).json({ error: 'recipientId required' });

    const { closed } = await loadEventForMessaging(req.params.eventId);
    if (closed) return res.status(403).json({ error: 'Messaging is closed for this event' });
    if (!(await bothCheckedIn(req.params.eventId, me, recipientId))) {
      return res.status(403).json({ error: 'Both members must be checked in to connect' });
    }

    const rows = await pool.query(
      'SELECT id, full_name, business_name, tagline, industry FROM users WHERE id = ANY($1)',
      [[me, recipientId]]
    );
    const mine = rows.rows.find(r => r.id === me);
    const them = rows.rows.find(r => r.id === recipientId);
    if (!them) return res.status(404).json({ error: 'Recipient not found' });

    try {
      const systemPrompt = `You are helping a member of Charlotte Business Owners (CBO), a business networking group, write a short, warm opening message to another member they want to connect with at an event. Write a friendly, genuine icebreaker of 2-3 sentences in the FIRST PERSON as the sender. Reference the recipient's business or industry naturally. Keep it conversational and human — no sales pitch, no cheesy lines. Respond ONLY with valid JSON: {"draft": "<the message>"}`;
      const userPrompt = `ME (sender):
Name: ${mine?.full_name || 'A member'} | Business: ${mine?.business_name || 'N/A'} | Industry: ${mine?.industry || 'N/A'} | What I do: ${mine?.tagline || 'N/A'}

THEM (recipient):
Name: ${them.full_name || 'A member'} | Business: ${them.business_name || 'N/A'} | Industry: ${them.industry || 'N/A'} | What they do: ${them.tagline || 'N/A'}`;

      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-5.4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 300,
      });
      const raw = completion.choices[0]?.message?.content ?? '';
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
      const parsed = JSON.parse(jsonStr);
      return res.json({ draft: (parsed.draft || '').toString().trim() });
    } catch (aiErr) {
      console.error('ai-draft generation failed (returning empty draft):', aiErr);
      return res.json({ draft: '' });
    }
  } catch (e) {
    console.error('ai-draft error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── AI Match ──────────────────────────────────────────────────────────────

app.post('/api/events/:id/ai-match', authMiddleware, async (req, res) => {
  try {
    const me = req.user;

    // Fetch current user's full profile
    const meRes = await pool.query(
      'SELECT full_name, business_name, tagline, industry FROM users WHERE id = $1',
      [me.id]
    );
    const myProfile = meRes.rows[0];
    if (!myProfile) return res.status(404).json({ error: 'Profile not found' });

    // IDs already shown to this user in this session
    const excludeIds = Array.isArray(req.body.excludeIds) ? req.body.excludeIds : [];

    // Fetch all other checked-in attendees, excluding already-seen ones
    const attendeesRes = await pool.query(
      `SELECT u.id, u.full_name, u.business_name, u.tagline, u.industry
       FROM checkins c
       JOIN users u ON c.user_id = u.id
       WHERE c.event_id = $1 AND c.user_id != $2`,
      [req.params.id, me.id]
    );

    // Filter out anyone already shown, then shuffle the remainder
    const attendees = attendeesRes.rows
      .filter(a => !excludeIds.includes(a.id))
      .map(a => ({ a, sort: Math.random() }))
      .sort((x, y) => x.sort - y.sort)
      .map(({ a }) => a);

    if (attendees.length === 0) {
      return res.status(400).json({ error: "You've been matched with everyone here! Go meet them all." });
    }

    const attendeeList = attendees.map((a, i) =>
      `[${i + 1}] Name: ${a.full_name || 'Unknown'} | Business: ${a.business_name || 'N/A'} | Industry: ${a.industry || 'N/A'} | What they do: ${a.tagline || 'N/A'}`
    ).join('\n');

    const systemPrompt = `You are a strategic networking assistant for a business owners networking group called Charlotte Business Owners (CBO). Your job is to review a member's profile and the numbered list of other attendees at their event, then identify a great strategic partner for them and craft a warm, slightly funny ice-breaking opening line.

Rules:
- Pick exactly ONE person who would be a valuable strategic partner (referral source, complementary service, potential collaboration, or client relationship). Vary your choice — don't always pick the most "obvious" match.
- Return their list number as "matchIndex" — this MUST be a number between 1 and ${attendees.length} (inclusive). Do NOT return a number outside that range.
- Give a brief, specific reason (1-2 sentences) explaining WHY they are a good match.
- Write a single ice-breaking opening line the user can say OUT LOUD to go meet this person. Make it warm, conversational, and slightly funny — a light joke or playful observation that relates to what this person does. It should make them smile, not groan. No cheesy puns. No sales pitch. Just something a real, personable human would actually say.
- Respond ONLY with valid JSON: {"matchIndex": <integer 1 to ${attendees.length}>, "reason": "<string>", "icebreaker": "<string>"}`;

    const userPrompt = `MY PROFILE:
Name: ${myProfile.full_name || 'Unknown'}
Business: ${myProfile.business_name || 'N/A'}
Industry: ${myProfile.industry || 'N/A'}
What I do: ${myProfile.tagline || 'N/A'}

OTHER ATTENDEES:
${attendeeList}`;

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-5.4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: 512,
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    console.log('[AI match] raw response:', raw.slice(0, 300));

    // Extract JSON — handle plain JSON or ```json ... ``` fenced blocks
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw.trim();
    if (!jsonStr) return res.status(500).json({ error: 'AI returned an empty response — try again' });

    const parsed = JSON.parse(jsonStr);
    let idx = (parseInt(parsed.matchIndex, 10) || 1) - 1;
    if (idx < 0 || idx >= attendees.length) idx = 0; // clamp to first attendee rather than error

    const match = attendees[idx];
    res.json({
      match: {
        id: match.id,
        full_name: match.full_name,
        business_name: match.business_name,
        tagline: match.tagline,
        industry: match.industry,
      },
      reason: parsed.reason,
      icebreaker: parsed.icebreaker,
    });
  } catch (e) {
    console.error('AI match error:', e);
    res.status(500).json({ error: 'Something went wrong — try again in a moment' });
  }
});

// Serve the built frontend if dist/ exists (production deployment)
const distPath = [
  path.join(__dirname, '../dist/client'),
  path.join(__dirname, '../dist'),
].find((candidate) => fs.existsSync(path.join(candidate, 'index.html')));

if (distPath) {
  app.use(express.static(distPath));
  // SPA fallback — must use app.use so path-to-regexp wildcard issues are avoided
  app.use((_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`API server running on port ${PORT}`));
