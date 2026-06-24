export type VCardContact = {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  business_name?: string | null;
  tagline?: string | null;
  /** Raw base64 (no data: prefix) of a small JPEG headshot to embed. */
  photoBase64?: string | null;
};

function escapeValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  const last = parts.pop() as string;
  return { first: parts.join(' '), last };
}

/**
 * Build a standard vCard 3.0 string from the given contact fields.
 * Missing/empty fields are omitted so the card stays valid with whatever data exists.
 */
export function buildVCard(contact: VCardContact): string {
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

  const fullName = contact.full_name?.trim();
  if (fullName) {
    const { first, last } = splitName(fullName);
    lines.push(`N:${escapeValue(last)};${escapeValue(first)};;;`);
    lines.push(`FN:${escapeValue(fullName)}`);
  }

  const business = contact.business_name?.trim();
  if (business) lines.push(`ORG:${escapeValue(business)}`);

  const tagline = contact.tagline?.trim();
  if (tagline) lines.push(`TITLE:${escapeValue(tagline)}`);

  const phone = contact.phone?.trim();
  if (phone) lines.push(`TEL;TYPE=CELL:${escapeValue(phone)}`);

  const email = contact.email?.trim();
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${escapeValue(email)}`);

  const photo = contact.photoBase64?.trim();
  if (photo) lines.push(`PHOTO;ENCODING=b;TYPE=JPEG:${photo}`);

  lines.push('END:VCARD');
  return lines.join('\n');
}
