function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function emailShell({ appUrl, heading, body, buttonLabel, buttonUrl, footer }) {
  const logoUrl = `${appUrl.replace(/\/$/, '')}/cbo-logo.png`;
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <img src="${escapeHtml(logoUrl)}" alt="Charlotte Business Owners" style="height:48px; margin-bottom:24px;" />
      <h2 style="color:#0f172a; margin-bottom:8px;">${escapeHtml(heading)}</h2>
      ${body}
      <a href="${escapeHtml(buttonUrl)}" style="display:inline-block; margin-top:20px; padding:12px 24px; background:#0f172a; color:#fff; text-decoration:none; border-radius:10px; font-weight:600;">${escapeHtml(buttonLabel)}</a>
      <p style="margin-top:24px; color:#94a3b8; font-size:13px;">${footer}</p>
      <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;" />
      <p style="color:#94a3b8; font-size:12px;">Charlotte Business Owners · Charlotte, NC</p>
    </div>
  `;
}

export function buildPasswordResetEmail({ resetLink, appUrl }) {
  return {
    subject: 'Charlotte Business Owners Password Reset',
    html: emailShell({
      appUrl,
      heading: 'Password Reset',
      body: '<p style="color:#475569;">You requested a password reset for your Charlotte Business Owners account. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>',
      buttonLabel: 'Reset my password',
      buttonUrl: resetLink,
      footer: "If you didn't request this, you can safely ignore this email.",
    }),
    message: `Reset your Charlotte Business Owners password by visiting: ${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
  };
}

export function buildAccountSetupEmail({ fullName, eventTitle, setupLink, appUrl }) {
  const name = escapeHtml(fullName?.trim() || 'there');
  const event = escapeHtml(eventTitle);
  return {
    subject: 'Your Charlotte Business Owners account is ready',
    html: emailShell({
      appUrl,
      heading: 'Your account is ready',
      body: `
        <p style="color:#475569;">Hi ${name},</p>
        <p style="color:#475569;">We created your Charlotte Business Owners account and checked you in for <strong>${event}</strong>.</p>
        <p style="color:#475569;">For next time, click below to create your password. Then you can log in, manage your profile, and check yourself in at future events.</p>
      `,
      buttonLabel: 'Create my password',
      buttonUrl: setupLink,
      footer: 'This secure, one-time link expires in 24 hours. If it expires, use Forgot password in the app to request a new link.',
    }),
    message: `Hi ${fullName?.trim() || 'there'},\n\nWe created your Charlotte Business Owners account and checked you in for ${eventTitle}.\n\nCreate your password here: ${setupLink}\n\nThis secure, one-time link expires in 24 hours. If it expires, use Forgot password in the app to request a new link.`,
  };
}

export async function sendGhlEmail(toEmail, email) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) throw new Error('Email service is not configured');

  const ghlBaseUrl = 'https://services.leadconnectorhq.com';
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Version: '2021-04-15',
  };

  const searchRes = await fetch(
    `${ghlBaseUrl}/contacts/?locationId=${locationId}&query=${encodeURIComponent(toEmail)}`,
    { headers, signal: AbortSignal.timeout(10_000) }
  );
  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    console.error(`GHL contact search failed (${searchRes.status}):`, errorText);
    throw new Error('GHL contact search failed');
  }

  const searchData = await searchRes.json();
  const found = (searchData.contacts ?? searchData.data ?? []).find(
    (contact) => contact.email?.toLowerCase() === toEmail.toLowerCase()
  );
  let contactId = found?.id;

  if (!contactId) {
    const createRes = await fetch(`${ghlBaseUrl}/contacts/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ locationId, email: toEmail }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error(`GHL contact create failed (${createRes.status}):`, errorText);
      throw new Error('GHL contact create failed');
    }
    const createData = await createRes.json();
    contactId = createData.contact?.id;
  }

  if (!contactId) throw new Error('Could not obtain GHL contactId');

  const messageRes = await fetch(`${ghlBaseUrl}/conversations/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      type: 'Email',
      contactId,
      locationId,
      subject: email.subject,
      html: email.html,
      message: email.message,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!messageRes.ok) {
    const errorText = await messageRes.text();
    console.error(`GHL message send failed (${messageRes.status}):`, errorText);
    throw new Error('Email delivery failed');
  }
}

export function sendGhlPasswordResetEmail(toEmail, resetLink, appUrl) {
  return sendGhlEmail(toEmail, buildPasswordResetEmail({ resetLink, appUrl }));
}

export function sendGhlAccountSetupEmail(toEmail, details) {
  return sendGhlEmail(toEmail, buildAccountSetupEmail(details));
}
