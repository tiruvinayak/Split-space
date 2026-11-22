export const MAX_RECEIPT_FILE_BYTES = 1024 * 1024;
export const MAX_TOTAL_RECEIPT_BYTES = 1536 * 1024;
export const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

export function validateReceiptFile(file, storedBytes = 0, replacingBytes = 0) {
  if (!file) throw new Error('Choose a receipt file first.');
  if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP, GIF or PDF receipt.');
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error('The selected receipt is empty or invalid.');
  if (file.size > MAX_RECEIPT_FILE_BYTES) throw new Error('Each receipt must be 1 MB or smaller.');
  const retainedBytes = Math.max(0, storedBytes - replacingBytes);
  if (retainedBytes + file.size > MAX_TOTAL_RECEIPT_BYTES) throw new Error('Receipt storage is full. Remove another receipt before adding this file.');
  return true;
}

export function readReceiptDataUrl(file, Reader = globalThis.FileReader) {
  if (typeof Reader !== 'function') return Promise.reject(new Error('Receipt preview is unavailable in this browser.'));
  return new Promise((resolve, reject) => {
    const reader = new Reader();
    reader.onerror = () => reject(new Error('The receipt could not be read. Please choose the file again.'));
    reader.onabort = () => reject(new Error('Receipt reading was cancelled.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.startsWith(`data:${file.type};base64,`)) {
        reject(new Error('This receipt could not be previewed.'));
        return;
      }
      resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  });
}
