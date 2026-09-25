export function buildAntimeridianSafeLine(
  originLng: number,
  originLat: number,
  targetLng: number,
  targetLat: number,
): GeoJSON.LineString | GeoJSON.MultiLineString {
  const normalizeLongitude = (lng: number) => {
    const wrapped = ((lng + 180) % 360 + 360) % 360 - 180;
    return wrapped === -180 && lng > 0 ? 180 : wrapped;
  };

  const origin = normalizeLongitude(originLng);
  const target = normalizeLongitude(targetLng);
  const delta = target - origin;

  if (Math.abs(delta) <= 180) {
    return { type: 'LineString', coordinates: [[origin, originLat], [target, targetLat]] };
  }

  const crossesEast = delta < -180;
  const adjustedTarget = crossesEast ? target + 360 : target - 360;
  const boundary = crossesEast ? 180 : -180;
  const oppositeBoundary = crossesEast ? -180 : 180;
  const span = adjustedTarget - origin;
  const t = span === 0 ? 0.5 : (boundary - origin) / span;
  const crossingLat = originLat + (targetLat - originLat) * t;

  return {
    type: 'MultiLineString',
    coordinates: [
      [[origin, originLat], [boundary, crossingLat]],
      [[oppositeBoundary, crossingLat], [target, targetLat]],
    ],
  };
}
