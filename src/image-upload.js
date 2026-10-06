export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif,.png,.jpg,.jpeg,.webp,.gif,.avif';
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_UPLOAD_PIXELS = 16000000;

// Inspect bytes, not just the filename or an unreliable/empty drag-and-drop MIME type.
export function rasterType(bytes) {
  const text = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((byte, i) => bytes[i] === byte)) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(text(0, 6))) return 'image/gif';
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 16 && text(4, 8) === 'ftyp') {
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    for (let i = 8; i + 4 <= Math.min(size, bytes.length); i += 4) {
      if (i !== 12 && ['avif', 'avis'].includes(text(i, i + 4))) return 'image/avif';
    }
  }
  return null;
}

export async function imageData(file) {
  if (!file || file.size > MAX_UPLOAD_BYTES) throw new Error('imageFileSize');
  const type = rasterType(new Uint8Array(await file.slice(0, 128).arrayBuffer()));
  if (!type) throw new Error('imageType');
  const url = URL.createObjectURL(new Blob([file], { type }));
  try {
    const image = new Image(); image.src = url;
    try { await image.decode(); } catch { throw new Error('imageDecode'); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > MAX_UPLOAD_PIXELS) throw new Error('imageSize');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 128 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('imageDecode');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // A self-contained static raster also strips animation, metadata and external references.
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}
