/**
 * Downscale an image File to a reasonable max dimension and re-encode as JPEG
 * before upload. Phone cameras produce very large (10MP+) photos; loading those
 * at full resolution on the device can exhaust memory and crash the tab. Keeping
 * the stored image small fixes that and speeds up uploads.
 *
 * Falls back to the original file if anything goes wrong, so uploads never break.
 */
export async function resizeImageFile(
  file: File,
  maxSize = 512,
  quality = 0.85
): Promise<File> {
  // Only attempt to resize raster images we can draw to a canvas.
  if (!file.type.startsWith('image/')) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('image load failed'));
      el.src = objectUrl;
    });

    const longest = Math.max(img.width, img.height);
    // Already small enough — keep the original.
    if (longest <= maxSize) return file;

    const scale = maxSize / longest;
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
