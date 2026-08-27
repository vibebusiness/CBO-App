import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import sanitizeHtml from 'sanitize-html';
import { config } from './config.js';

export const SESSION_COOKIE = 'cbo_session';
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;

export function requestContext(req, res, next) {
  req.id = req.get('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  const started = performance.now();
  res.on('finish', () => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) return;
    console.info(JSON.stringify({
      level: 'info',
      event: 'http_request',
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(performance.now() - started),
    }));
  });
  next();
}

export const parseCookies = cookieParser();

export function makeToken(user) {
  return jwt.sign({ id: user.id }, config.jwtSecret, {
    expiresIn: '30d',
    issuer: 'cbo-events',
    audience: 'cbo-app',
  });
}

export function setSession(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
  });
}

function requestToken(req) {
  const bearer = req.get('authorization');
  if (bearer?.startsWith('Bearer ')) return bearer.slice(7);
  return req.cookies?.[SESSION_COOKIE] || null;
}

export function createAuthMiddleware(pool) {
  return async function authMiddleware(req, res, next) {
    const token = requestToken(req);
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
      let claims;
      try {
        claims = jwt.verify(token, config.jwtSecret, {
          issuer: 'cbo-events',
          audience: 'cbo-app',
        });
      } catch {
        // Accept the previous first-party token shape during the cookie migration.
        claims = jwt.verify(token, config.jwtSecret);
      }
      const result = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [claims.id]);
      if (!result.rows[0]) return res.status(401).json({ error: 'Unauthorized' });
      if (req.get('authorization') && !req.cookies?.[SESSION_COOKIE]) setSession(res, token);
      req.user = result.rows[0];
      return next();
    } catch {
      clearSession(res);
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
  };
}

export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  return next();
}

export function sameOriginForCookieRequests(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (!req.cookies?.[SESSION_COOKIE] || req.get('authorization')) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  try {
    if (new URL(origin).host === req.get('host')) return next();
  } catch {
    // Invalid origins are rejected below.
  }
  return res.status(403).json({ error: 'Invalid request origin' });
}

export function sanitizeEventDescription(value) {
  return sanitizeHtml(typeof value === 'string' ? value : '', {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
      'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'a', 'code', 'pre', 'hr',
    ],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: 'a',
        attribs: { ...attributes, rel: 'noopener noreferrer', target: '_blank' },
      }),
    },
  });
}

export function normalizeEvent(event) {
  return event ? { ...event, description: sanitizeEventDescription(event.description) } : event;
}

export function verifiedImageMime(file) {
  const bytes = file?.buffer;
  if (!bytes || bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
