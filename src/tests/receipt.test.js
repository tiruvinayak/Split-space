// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { initialData } from '../data/demo';
import { attachReceipt, getStoredReceiptBytes, removeReceipt } from '../utils/workspace';
import { MAX_RECEIPT_FILE_BYTES, readReceiptDataUrl, validateReceiptFile } from '../utils/receipt';

describe('local receipt files', () => {
  it('accepts supported image and PDF files and rejects unsupported types', () => {
    expect(validateReceiptFile(new File(['png'], 'meal.png', { type: 'image/png' }))).toBe(true);
    expect(validateReceiptFile(new File(['pdf'], 'invoice.pdf', { type: 'application/pdf' }))).toBe(true);
    expect(() => validateReceiptFile(new File(['svg'], 'unsafe.svg', { type: 'image/svg+xml' }))).toThrow(/JPEG, PNG/);
  });

  it('enforces per-file and total Local Storage size limits, allowing receipt replacement', () => {
    const oversized = new File([new Uint8Array(MAX_RECEIPT_FILE_BYTES + 1)], 'large.png', { type: 'image/png' });
    expect(() => validateReceiptFile(oversized)).toThrow(/1 MB/);
    const file = new File([new Uint8Array(700 * 1024)], 'new.png', { type: 'image/png' });
    expect(() => validateReceiptFile(file, 1200 * 1024)).toThrow(/storage is full/);
    expect(validateReceiptFile(file, 1200 * 1024, 700 * 1024)).toBe(true);
  });

  it('reads selected files into a local data URL for preview and persistence', async () => {
    const file = new File(['local receipt bytes'], 'receipt.pdf', { type: 'application/pdf' });
    const receipt = await readReceiptDataUrl(file);
    expect(receipt).toMatchObject({ name: 'receipt.pdf', type: 'application/pdf', size: file.size });
    expect(receipt.dataUrl).toMatch(/^data:application\/pdf;base64,/);
  });

  it('attaches, replaces and removes a receipt from an expense record', () => {
    const state = JSON.parse(JSON.stringify(initialData));
    const original = { name: 'first.png', type: 'image/png', size: 120, dataUrl: 'data:image/png;base64,first' };
    const replacement = { name: 'second.pdf', type: 'application/pdf', size: 200, dataUrl: 'data:application/pdf;base64,second' };
    const attached = attachReceipt(state, 'e1', original);
    expect(getStoredReceiptBytes(attached.expenses)).toBe(120);
    const replaced = attachReceipt(attached, 'e1', replacement);
    expect(replaced.expenses.find((item) => item.id === 'e1').receipt.name).toBe('second.pdf');
    expect(getStoredReceiptBytes(replaced.expenses)).toBe(200);
    const removed = removeReceipt(replaced, 'e1');
    expect(removed.expenses.find((item) => item.id === 'e1')).not.toHaveProperty('receipt');
    expect(getStoredReceiptBytes(removed.expenses)).toBe(0);
  });
});
