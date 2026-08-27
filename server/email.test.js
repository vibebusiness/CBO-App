import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAccountSetupEmail, buildPasswordResetEmail, sendGhlEmail } from './email.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('email templates', () => {
  it('builds an account setup email with the event and one-time setup link', () => {
    const email = buildAccountSetupEmail({
      fullName: 'Pat <Yang>',
      eventTitle: 'CBO & Friends',
      setupLink: 'https://example.com/reset-password?token=abc&setup=1',
      appUrl: 'https://example.com',
    });

    expect(email.subject).toBe('Your Charlotte Business Owners account is ready');
    expect(email.html).toContain('Pat &lt;Yang&gt;');
    expect(email.html).toContain('CBO &amp; Friends');
    expect(email.html).toContain('Create my password');
    expect(email.html).toContain('token=abc&amp;setup=1');
    expect(email.message).toContain('token=abc&setup=1');
  });

  it('keeps the existing one-hour password reset instructions', () => {
    const email = buildPasswordResetEmail({
      resetLink: 'https://example.com/reset-password?token=abc',
      appUrl: 'https://example.com',
    });

    expect(email.subject).toContain('Password Reset');
    expect(email.html).toContain('expires in <strong>1 hour</strong>');
    expect(email.message).toContain('expires in 1 hour');
  });

  it('sends the rendered email to an existing GHL contact', async () => {
    vi.stubEnv('GHL_API_KEY', 'test-key');
    vi.stubEnv('GHL_LOCATION_ID', 'test-location');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ contacts: [{ id: 'contact-1', email: 'member@example.com' }] })))
      .mockResolvedValueOnce(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await sendGhlEmail('member@example.com', {
      subject: 'Account ready',
      html: '<p>Welcome</p>',
      message: 'Welcome',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, sendOptions] = fetchMock.mock.calls[1];
    expect(JSON.parse(sendOptions.body)).toMatchObject({
      type: 'Email',
      contactId: 'contact-1',
      locationId: 'test-location',
      subject: 'Account ready',
    });
  });
});
