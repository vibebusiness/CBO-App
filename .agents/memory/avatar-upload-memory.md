---
name: Avatar/image uploads must be downscaled client-side
description: Why raw image uploads blank the page on mobile, and the rule to prevent it
---

# Raw image uploads OOM-crash mobile tabs

Uploading a profile photo (notably from a phone camera) was blanking the page
to white and requiring a manual refresh.

**Root cause:** the backend stores and serves the *raw, full-resolution*
uploaded image (no server-side resize). After upload, the client loaded that
large (10MP+) image into memory multiple times — the avatar `<img>` plus the
QR-code canvas processing — which exhausts memory and crashes the browser tab
on mobile. A tab OOM shows as a blank white screen and is NOT catchable by a
React ErrorBoundary.

**Rule:** always downscale images client-side *before* upload (canvas →
`toBlob` JPEG, max ~512px for avatars). Keep a safe fallback to the original
file only for already-small/non-image files so uploads never break.

**Why:** the stored asset is reused everywhere it's displayed/processed, so an
oversized original multiplies memory cost across every consumer, not just the
upload. Bounding it at the source fixes the whole chain.

**How to apply:** for any new image-upload surface, route the File through the
shared client resize helper first. Server-side byte caps (multer) are
defense-in-depth, not a substitute — an 8MB JPEG can still be 12MP and crash a
phone.
