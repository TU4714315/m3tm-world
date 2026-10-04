import { describe, expect, it } from 'vitest';
import { imageType, isAllowedCameraUrl } from './route';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), Buffer.alloc(8)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);

describe('camera proxy image signatures', () => {
  it('recovers actual JPEG, PNG, WebP and GIF regardless of upstream MIME', () => {
    expect(imageType(jpeg)).toBe('image/jpeg');
    expect(imageType(png)).toBe('image/png');
    expect(imageType(webp)).toBe('image/webp');
    expect(imageType(Buffer.from('GIF89a0000'))).toBe('image/gif');
  });
  it('rejects HTML and unknown payloads masquerading as camera frames', () => {
    expect(imageType(Buffer.from('<html>oops</html>'))).toBeNull();
    expect(imageType(Buffer.from('not an image'))).toBeNull();
  });
});

describe('camera destination allowlist', () => {
  it('preserves existing camera sources and Selangor HTTP snapshot support', () => {
    expect(isAllowedCameraUrl(new URL('http://infobanjirjps.selangor.gov.my/InfoBanjir.WebAdmin/CCTV_Image/14.jpg'))).toBe(true);
    expect(isAllowedCameraUrl(new URL('https://cdn.skylinewebcams.com/cam.jpg'))).toBe(true);
    expect(isAllowedCameraUrl(new URL('https://cctv-ss01.thb.gov.tw/1.jpg'))).toBe(true);
  });
  it('rejects redirects to unexpected hosts, internal addresses, ports and credentials', () => {
    for (const path of [
      'http://127.0.0.1/latest/meta-data/',
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost/',
      'https://cdn.skylinewebcams.com.attacker.test/x',
      'http://infobanjirjps.selangor.gov.my:3000/x',
      'https://user:password@cdn.skylinewebcams.com/x',
    ]) expect(isAllowedCameraUrl(new URL(path))).toBe(false);
  });
});
