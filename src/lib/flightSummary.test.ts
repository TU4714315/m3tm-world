import { describe, expect, it } from 'vitest';
import { buildFlightSummary } from './flightSummary';

describe('flight summary projection', () => {
  it('returns public counters without serializing aircraft tracks', () => {
    const summary = buildFlightSummary({
      commercial_flights: [{ icao24: 'civil-1' }, { icao24: 'civil-2' }],
      private_flights: [{ registration: 'private-1' }],
      private_jets: [{ callsign: 'jet-1' }],
      military_flights: [{ icao24: 'mil-sensitive' }],
      military_activity: [
        { lat: 24, lng: 48, approximate_count: '2-4', icao24: 'strip-me' },
        { lat: 30, lng: 42, approximate_count: '5-9', callsign: 'strip-me-too' },
      ],
      military_activity_meta: {
        mode: 'coarse-regional-aggregate',
        exact_tracks_exposed: false,
        identifiers_exposed: false,
      },
      flight_source_status: {
        status: 'active',
        providers: {
          adsbfi_mil: 6,
          opensky: 9000,
          opensky_age_s: 42,
        },
      },
      source: 'opensky-anon',
      timestamp: '2026-10-01T09:00:00Z',
    });

    expect(summary.status).toBe('operational');
    expect(summary.counts).toEqual({
      commercial: 2,
      private: 1,
      jets: 1,
      public_total: 4,
    });
    expect(summary.military_activity).toEqual({
      cells: 2,
      mode: 'coarse-regional-aggregate',
      exact_tracks_exposed: false,
      identifiers_exposed: false,
    });
    expect(summary.providers).toMatchObject({ adsbfi_mil: 6, opensky: 9000 });
    const serialized = JSON.stringify(summary);
    for (const forbidden of ['civil-1', 'private-1', 'jet-1', 'mil-sensitive', 'strip-me', 'strip-me-too']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('reports degraded when no public observation is active', () => {
    expect(buildFlightSummary({
      commercial_flights: [],
      private_flights: [],
      private_jets: [],
      military_activity: [],
      flight_source_status: { status: 'empty', providers: {} },
    }).status).toBe('degraded');
  });

  it('reports cached-only military cells as degraded when the live source status is empty', () => {
    expect(buildFlightSummary({
      commercial_flights: [],
      private_flights: [],
      private_jets: [],
      military_activity: [{ id: 'cached-cell' }],
      military_activity_meta: { stale_fallback: true },
      flight_source_status: { status: 'empty', providers: {} },
      source: 'opensky-anon',
    }).status).toBe('degraded');
  });

  it('reports stale fallback data as degraded even when cached rows exist', () => {
    expect(buildFlightSummary({
      commercial_flights: [{ icao24: 'stale-row' }],
      private_flights: [],
      private_jets: [],
      military_activity: [],
      flight_source_status: { status: 'active', providers: {} },
      source: 'opensky-anon+stale',
    }).status).toBe('degraded');
  });
});
