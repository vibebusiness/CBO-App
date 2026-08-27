import { beforeAll, describe, expect, it } from 'vitest';

let sanitizeEventDescription;
let verifiedImageMime;

beforeAll(async () => {
  process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_SECRET ||= 'test-secret-with-more-than-thirty-two-characters';
  ({ sanitizeEventDescription, verifiedImageMime } = await import('./http.js'));
});

describe('event content safety', () => {
  it('removes scripts and unsafe URL schemes while preserving rich text', () => {
    const clean = sanitizeEventDescription(
      '<p>Hello <strong>members</strong></p><script>alert(1)</script><a href="javascript:alert(2)">bad</a>',
    );

    expect(clean).toContain('<strong>members</strong>');
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('javascript:');
  });
});

describe('image validation', () => {
  it('recognizes content by file signature instead of trusting the filename', () => {
    expect(verifiedImageMime({ buffer: Buffer.from([0xff, 0xd8, 0xff, ...Array(12).fill(0)]) })).toBe('image/jpeg');
    expect(verifiedImageMime({ buffer: Buffer.from('this is not an image') })).toBeNull();
  });
});
