import test from 'node:test';
import assert from 'node:assert/strict';
import samples from './image-fixtures.json' with { type: 'json' };
import { IMAGE_ACCEPT, MAX_UPLOAD_BYTES, MAX_UPLOAD_PIXELS, rasterType, imageData } from '../src/image-upload.js';

test('all five formats are identified from actual bytes, not a filename or MIME', () => {
  assert.equal(Object.keys(samples).length, 5);
  for (const sample of Object.values(samples)) assert.equal(rasterType(new Uint8Array(Buffer.from(sample.base64, 'base64'))), sample.mime);
  assert.equal(MAX_UPLOAD_PIXELS, 16000000);
});
test('SVG, unsupported formats, empty data and disguised files are not accepted', () => {
  for (const bytes of [[], [1,2,3], Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), Buffer.from('not a PNG'), Buffer.from('BM000000000000'), Buffer.from('II*\0')]) {
    assert.equal(rasterType(new Uint8Array(bytes)), null);
  }
  assert.ok(!IMAGE_ACCEPT.includes('image/*'));
  assert.ok(!IMAGE_ACCEPT.includes('svg'));
  assert.ok(!IMAGE_ACCEPT.includes('heic'));
  for (const sample of Object.values(samples)) assert.ok(IMAGE_ACCEPT.includes(sample.mime));
});
test('AVIF is recognized by a compatible brand as well as its major brand', () => {
  const bytes = new Uint8Array(24);
  new DataView(bytes.buffer).setUint32(0, 24);
  bytes.set(Buffer.from('ftypmif1'), 4);
  bytes.set(Buffer.from('mif1avif'), 16);
  assert.equal(rasterType(bytes), 'image/avif');
  bytes.set(Buffer.from('heic'), 20);
  assert.equal(rasterType(bytes), null);
});
test('size and raster policy reject before any decoder or canvas is needed', async () => {
  await assert.rejects(imageData(new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], 'huge.png')), /imageFileSize/);
  await assert.rejects(imageData(new File(['<svg/>'], 'fake.png', { type: 'image/png' })), /imageType/);
  await assert.rejects(imageData(new File([], 'empty.jpg', { type: 'image/jpeg' })), /imageType/);
});
