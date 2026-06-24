---
name: vCard QR with embedded photo
description: Constraints for embedding a profile photo into a QR-encoded vCard so the code stays scannable
---

# Embedding a photo in a QR-encoded vCard

Profile page renders a contact QR (vCard) via the `qrcode` npm lib. Members asked
to embed their avatar (PHOTO field) so scanning saves the picture too.

**Rule:** A QR code only holds ~2–3 KB and must scan from a phone screen, so a
full-size avatar will NOT fit. Downscale aggressively before embedding.

**How to apply (in `src/lib/vcard.ts` + `ContactQR` in `src/pages/Profile.tsx`):**
- Downscale avatar via canvas to ~88px max, JPEG quality ~0.6 → raw base64.
- Embed as `PHOTO;ENCODING=b;TYPE=JPEG:<base64>` (vCard 3.0, single line works on
  iOS/Android).
- Use QR error-correction level `L` when a photo is present (more data capacity),
  `M` when not.
- Always keep a fallback: if `QRCode.toDataURL` rejects with the photo, regenerate
  a photo-less vCard so the code is never broken/unscannable.

**Why:** Without downscaling + EC level L + the fallback, the encoder throws on
large payloads or produces a code too dense for phone cameras to read.
