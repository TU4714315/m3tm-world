import { describe, expect, it } from 'vitest';
import {
  NETHERLANDS_PUBLIC_WEBCAMS, EUROPE_PUBLIC_WEBCAMS,
  AMERICAS_PUBLIC_WEBCAMS, REST_PUBLIC_WEBCAMS,
} from './public-webcams.generated';

describe('attributed operator-published public camera catalog', () => {
  const cameras = [
    ...NETHERLANDS_PUBLIC_WEBCAMS, ...EUROPE_PUBLIC_WEBCAMS,
    ...AMERICAS_PUBLIC_WEBCAMS, ...REST_PUBLIC_WEBCAMS,
  ];

  it('ships the complete upstream, unique 300-camera catalog with plausible positions', () => {
    expect(cameras).toHaveLength(300);
    expect(new Set(cameras.map(cam => cam.id)).size).toBe(cameras.length);
    expect(cameras.every(cam => Number.isFinite(cam.lat) && Math.abs(cam.lat) <= 90
      && Number.isFinite(cam.lng) && Math.abs(cam.lng) <= 180)).toBe(true);
  });

  it('credits the operator and retains its public external link', () => {
    expect(cameras.every(cam => cam.source === 'Public Webcam'
      && typeof cam.external_url === 'string'
      && cam.external_url.startsWith('https://'))).toBe(true);
  });

  it('does not fabricate direct video playback for external-only camera entries', () => {
    const links = cameras.filter(cam => !cam.stream_url && !cam.feed_url);
    expect(links.length).toBeGreaterThan(250);
    expect(links.every(cam => cam.external_url?.startsWith('https://'))).toBe(true);
    expect(cameras.filter(cam => cam.stream_url).length).toBe(11);
  });
});
