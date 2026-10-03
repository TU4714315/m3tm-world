import { NextResponse } from 'next/server';
import WebSocket from 'ws';
import { durableCacheConfigured, durableGetJson, durableSetJson } from '@/lib/durableCache';

/**
 * OSIRIS — Maritime Intelligence
 * Real-time AIS vessel tracking via aisstream.io + Static global ports.
 */

const PORTS = [
  // ── Top Container Ports ──
  { name: 'Shanghai', country: 'CN', lat: 31.23, lng: 121.47, type: 'container', volume: '47.3M TEU', rank: 1 },
  { name: 'Singapore', country: 'SG', lat: 1.26, lng: 103.84, type: 'container', volume: '37.2M TEU', rank: 2 },
  { name: 'Ningbo-Zhoushan', country: 'CN', lat: 29.87, lng: 121.55, type: 'container', volume: '33.3M TEU', rank: 3 },
  { name: 'Shenzhen', country: 'CN', lat: 22.54, lng: 114.05, type: 'container', volume: '30.0M TEU', rank: 4 },
  { name: 'Guangzhou', country: 'CN', lat: 23.08, lng: 113.32, type: 'container', volume: '24.2M TEU', rank: 5 },
  { name: 'Busan', country: 'KR', lat: 35.10, lng: 129.04, type: 'container', volume: '22.7M TEU', rank: 6 },
  { name: 'Qingdao', country: 'CN', lat: 36.07, lng: 120.38, type: 'container', volume: '22.0M TEU', rank: 7 },
  { name: 'Rotterdam', country: 'NL', lat: 51.90, lng: 4.50, type: 'container', volume: '14.5M TEU', rank: 8 },
  { name: 'Tokyo', country: 'JP', lat: 35.61, lng: 139.79, type: 'container', volume: '4.5M TEU' },
  { name: 'Yokohama', country: 'JP', lat: 35.45, lng: 139.66, type: 'container', volume: '2.9M TEU' },
  { name: 'Kobe', country: 'JP', lat: 34.67, lng: 135.21, type: 'container', volume: '2.8M TEU' },
  { name: 'Nagoya', country: 'JP', lat: 35.08, lng: 136.87, type: 'container', volume: '2.6M TEU' },
  { name: 'Osaka', country: 'JP', lat: 34.63, lng: 135.41, type: 'container', volume: '2.1M TEU' },
  { name: 'Hakata (Fukuoka)', country: 'JP', lat: 33.60, lng: 130.40, type: 'container', volume: '0.9M TEU' },
  { name: 'Kitakyushu', country: 'JP', lat: 33.91, lng: 130.93, type: 'container', volume: '0.5M TEU' },
  { name: 'Shimizu', country: 'JP', lat: 35.00, lng: 138.50, type: 'container', volume: '0.5M TEU' },
  { name: 'Tomakomai', country: 'JP', lat: 42.63, lng: 141.63, type: 'container', volume: '0.4M TEU' },
  { name: 'Niigata', country: 'JP', lat: 37.95, lng: 139.06, type: 'container', volume: '0.2M TEU' },
  { name: 'Sendai', country: 'JP', lat: 38.27, lng: 141.02, type: 'container', volume: '0.2M TEU' },
  { name: 'Mizushima', country: 'JP', lat: 34.50, lng: 133.72, type: 'energy', volume: 'Industrial' },
  { name: 'Yokkaichi', country: 'JP', lat: 34.95, lng: 136.65, type: 'energy', volume: 'Industrial' },
  { name: 'Dubai (Jebel Ali)', country: 'AE', lat: 25.01, lng: 55.06, type: 'container', volume: '14.0M TEU', rank: 9 },
  { name: 'Port Klang', country: 'MY', lat: 2.99, lng: 101.39, type: 'container', volume: '13.2M TEU', rank: 10 },
  { name: 'Antwerp', country: 'BE', lat: 51.30, lng: 4.40, type: 'container', volume: '12.0M TEU', rank: 11 },
  { name: 'Xiamen', country: 'CN', lat: 24.48, lng: 118.09, type: 'container', volume: '11.4M TEU', rank: 12 },
  { name: 'Hamburg', country: 'DE', lat: 53.55, lng: 9.97, type: 'container', volume: '8.7M TEU', rank: 14 },
  { name: 'Los Angeles', country: 'US', lat: 33.74, lng: -118.27, type: 'container', volume: '9.9M TEU', rank: 13 },
  { name: 'Long Beach', country: 'US', lat: 33.75, lng: -118.19, type: 'container', volume: '8.0M TEU', rank: 15 },
  { name: 'Tanjung Pelepas', country: 'MY', lat: 1.36, lng: 103.55, type: 'container', volume: '9.8M TEU', rank: 16 },
  { name: 'Savannah', country: 'US', lat: 32.08, lng: -81.09, type: 'container', volume: '5.6M TEU', rank: 20 },
  { name: 'Felixstowe', country: 'GB', lat: 51.96, lng: 1.35, type: 'container', volume: '3.8M TEU', rank: 25 },
  { name: 'Santos', country: 'BR', lat: -23.95, lng: -46.31, type: 'container', volume: '4.2M TEU', rank: 22 },
  { name: 'Colombo', country: 'LK', lat: 6.94, lng: 79.84, type: 'container', volume: '7.2M TEU', rank: 17 },

  // ── Energy/Oil Ports ──
  { name: 'Ras Tanura', country: 'SA', lat: 26.64, lng: 50.16, type: 'energy', volume: '6.5M bpd' },
  { name: 'Fujairah', country: 'AE', lat: 25.14, lng: 56.35, type: 'energy', volume: '3.5M bpd' },
  { name: 'Novorossiysk', country: 'RU', lat: 44.72, lng: 37.77, type: 'energy', volume: '2.8M bpd' },
  { name: 'Houston Ship Channel', country: 'US', lat: 29.73, lng: -95.27, type: 'energy', volume: '2.5M bpd' },
  { name: 'Kharg Island', country: 'IR', lat: 29.24, lng: 50.33, type: 'energy', volume: '2.0M bpd' },
  { name: 'Primorsk', country: 'RU', lat: 60.35, lng: 28.70, type: 'energy', volume: '1.6M bpd' },

  // ── Major Naval Bases ──
  { name: 'Norfolk Naval Station', country: 'US', lat: 36.95, lng: -76.33, type: 'naval', fleet: 'US Atlantic Fleet' },
  { name: 'San Diego Naval Base', country: 'US', lat: 32.69, lng: -117.15, type: 'naval', fleet: 'US Pacific Fleet' },
  { name: 'Pearl Harbor', country: 'US', lat: 21.35, lng: -157.97, type: 'naval', fleet: 'US Pacific Fleet' },
  { name: 'Yokosuka', country: 'JP', lat: 35.28, lng: 139.67, type: 'naval', fleet: 'US 7th Fleet' },
  { name: 'Severomorsk', country: 'RU', lat: 69.07, lng: 33.42, type: 'naval', fleet: 'Russian Northern Fleet' },
  { name: 'Tartus', country: 'SY', lat: 34.89, lng: 35.89, type: 'naval', fleet: 'Russian Mediterranean' },
  { name: 'Zhanjiang', country: 'CN', lat: 21.20, lng: 110.39, type: 'naval', fleet: 'PLA Navy South Sea Fleet' },
  { name: 'Qingdao Naval', country: 'CN', lat: 36.09, lng: 120.43, type: 'naval', fleet: 'PLA Navy North Sea Fleet' },
  { name: 'Portsmouth', country: 'GB', lat: 50.80, lng: -1.11, type: 'naval', fleet: 'Royal Navy' },
  { name: 'Toulon', country: 'FR', lat: 43.12, lng: 5.93, type: 'naval', fleet: 'French Navy Mediterranean' },
  { name: 'Changi Naval Base', country: 'SG', lat: 1.33, lng: 104.01, type: 'naval', fleet: 'Republic of Singapore Navy' },
  { name: 'Visakhapatnam', country: 'IN', lat: 17.69, lng: 83.30, type: 'naval', fleet: 'Indian Navy Eastern Command' },
  { name: 'Mumbai Naval', country: 'IN', lat: 18.93, lng: 72.84, type: 'naval', fleet: 'Indian Navy Western Command' },
];

const CHOKEPOINTS = [
  { name: 'Strait of Hormuz', lat: 26.57, lng: 56.25, traffic: '21M bpd oil', risk: 'HIGH' },
  { name: 'Strait of Malacca', lat: 2.50, lng: 101.50, traffic: '16M bpd oil', risk: 'MODERATE' },
  { name: 'Suez Canal', lat: 30.43, lng: 32.34, traffic: '12% world trade', risk: 'ELEVATED' },
  { name: 'Bab el-Mandeb', lat: 12.58, lng: 43.33, traffic: '6.2M bpd oil', risk: 'CRITICAL' },
  { name: 'Panama Canal', lat: 9.08, lng: -79.68, traffic: '5% world trade', risk: 'LOW' },
  { name: 'Turkish Straits', lat: 41.12, lng: 29.07, traffic: '3M bpd oil', risk: 'MODERATE' },
  { name: 'Danish Straits', lat: 55.70, lng: 12.60, traffic: '3.2M bpd oil', risk: 'LOW' },
  { name: 'Cape of Good Hope', lat: -34.36, lng: 18.47, traffic: 'Alt route Suez', risk: 'LOW' },
  { name: 'Taiwan Strait', lat: 24.00, lng: 119.00, traffic: '88% large ships', risk: 'ELEVATED' },
  { name: 'Lombok Strait', lat: -8.47, lng: 115.72, traffic: 'Alt Malacca', risk: 'LOW' },
];

// --- Global AIS Stream Client (In-Memory Cache) ---
// Note: In a true serverless environment, this state would reset per invocation.
// For Next.js dev server or Node.js Docker container, this will persist.

const globalForAis = globalThis as unknown as {
  shipsCache: Map<number, any>;
  isAisConnecting: boolean;
  durableHydrated?: boolean;
  durableHydrationNextAttemptAt?: number;
  hydratedFromDurable?: boolean;
  lastDurableWriteAt?: number;
};

if (!globalForAis.shipsCache) {
  globalForAis.shipsCache = new Map();
  globalForAis.isAisConnecting = false;
}

const shipsCache = globalForAis.shipsCache;
const MARITIME_PUBLIC_CACHE_KEY = 'm3tm:public:ais-civil:v1';
const MARITIME_PUBLIC_CACHE_TTL_SECONDS = 30 * 60;
const MARITIME_DURABLE_WRITE_INTERVAL_MS = 60_000;
const MARITIME_MAX_PERSISTED_SHIPS = 1200;
const MARITIME_DURABLE_RETRY_MS = 60_000;

function isExplicitPublicCivilianShip(ship: any): boolean {
  return ship?.type === 'cargo' || ship?.type === 'tanker';
}

async function hydratePublicShipsFromDurable() {
  if (globalForAis.durableHydrated) return;
  const now = Date.now();
  if ((globalForAis.durableHydrationNextAttemptAt || 0) > now) return;
  if (shipsCache.size > 0) {
    globalForAis.durableHydrationNextAttemptAt = now + MARITIME_DURABLE_RETRY_MS;
    return;
  }

  const cached = await durableGetJson<{ ships: any[]; observed_at: string }>(MARITIME_PUBLIC_CACHE_KEY);
  if (!cached.value?.ships?.length) {
    globalForAis.durableHydrationNextAttemptAt = now + MARITIME_DURABLE_RETRY_MS;
    return;
  }

  const observedAt = Date.parse(cached.value.observed_at);
  if (!Number.isFinite(observedAt) || now - observedAt > 10 * 60 * 1000) {
    globalForAis.durableHydrationNextAttemptAt = now + MARITIME_DURABLE_RETRY_MS;
    return;
  }

  let loaded = 0;
  for (const ship of cached.value.ships) {
    if (!isExplicitPublicCivilianShip(ship)) continue;
    if (!Number.isFinite(Number(ship?.lat)) || !Number.isFinite(Number(ship?.lng))) continue;
    const id = Number(ship?.mmsi ?? ship?.id);
    if (!Number.isFinite(id)) continue;
    shipsCache.set(id, { ...ship, timestamp: Number(ship.timestamp) || observedAt });
    loaded += 1;
  }
  globalForAis.hydratedFromDurable = loaded > 0;
  globalForAis.durableHydrated = loaded > 0;
  if (!loaded) globalForAis.durableHydrationNextAttemptAt = now + MARITIME_DURABLE_RETRY_MS;
}

function connectAisStream() {
  if (globalForAis.isAisConnecting) return;
  const apiKey = process.env.AIS_API_KEY;
  if (!apiKey) return;

  globalForAis.isAisConnecting = true;
  let ws: WebSocket;

  try {
    ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
  } catch (e) {
    globalForAis.isAisConnecting = false;
    return;
  }

  ws.on("open", () => {
    globalForAis.isAisConnecting = false;
    const subscriptionMessage = {
      APIKey: apiKey,
      // Target specific high-value SCM areas to ensure data delivery on free tier
      BoundingBoxes: [
        // Tokyo Bay
        [[34.8, 139.5], [35.7, 140.2]],
        // Hormuz
        [[25.0, 54.0], [27.5, 57.5]],
        // Suez Canal
        [[27.0, 32.0], [32.0, 33.5]],
        // Bab el-Mandeb
        [[12.0, 42.5], [14.0, 44.0]],
        // Panama Canal
        [[8.0, -80.5], [10.0, -79.0]],
        // Malacca / Singapore
        [[1.0, 103.0], [3.0, 104.5]],
        // Taiwan Strait
        [[22.0, 118.0], [26.0, 121.0]],
        // Rotterdam / English Channel
        [[50.0, 0.0], [53.0, 5.0]],
        // US West Coast (LA/LB)
        [[33.0, -119.0], [34.5, -117.0]],
        // Global fallback (often heavily sampled by aisstream)
        [[-90, -180], [90, 180]]
      ],
      FilterMessageTypes: ["PositionReport", "ShipStaticData"]
    };
    ws.send(JSON.stringify(subscriptionMessage));
  });

  // Map AIS ship types to OSIRIS categories
  const getOsirisShipType = (typeCode: number) => {
    if (!typeCode) return 'cargo';
    if (typeCode >= 80 && typeCode <= 89) return 'tanker';
    if (typeCode >= 70 && typeCode <= 79) return 'cargo';
    if (typeCode === 35) return 'military';
    return 'cargo';
  };

  ws.on("message", (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      const mmsi = parsed.MetaData?.MMSI;
      if (!mmsi) return;

      const existing = shipsCache.get(mmsi) || {
        id: mmsi, mmsi: mmsi, timestamp: Date.now()
      };

      // Extract Name from MetaData if available (present in most messages)
      if (parsed.MetaData?.ShipName) {
        existing.name = parsed.MetaData.ShipName.trim();
      }

      if (parsed.MessageType === "PositionReport" && parsed.Message?.PositionReport) {
        const report = parsed.Message.PositionReport;
        existing.lat = report.Latitude;
        existing.lng = report.Longitude;
        existing.speed = report.Sog;
        existing.heading = report.TrueHeading || report.Cog;
        existing.timestamp = Date.now();
      } 
      else if (parsed.MessageType === "ShipStaticData" && parsed.Message?.ShipStaticData) {
        const staticData = parsed.Message.ShipStaticData;
        existing.name = staticData.Name ? staticData.Name.trim() : existing.name;
        existing.destination = staticData.Destination ? staticData.Destination.trim() : existing.destination;
        existing.type = getOsirisShipType(staticData.Type);
      }

      // Only store if we have coordinates
      if (existing.lat && existing.lng) {
        shipsCache.set(mmsi, existing);
      }

      // Limit cache size to prevent memory leak (allow up to 20,000 ships)
      if (shipsCache.size > 20000) {
        const firstKey = shipsCache.keys().next().value;
        if (firstKey) shipsCache.delete(firstKey);
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  ws.on("close", () => {
    globalForAis.isAisConnecting = false;
    setTimeout(connectAisStream, 5000); // Reconnect
  });

  ws.on("error", () => {
    ws.close();
  });
}

// Start connection process asynchronously
connectAisStream();

// --- SCM Integration: VesselAPI Hybrid Fallback (Satellite AIS) ---
let lastVesselApiFetch = 0;
async function fetchVesselApiFallback() {
  // Mock data removed per user request. We only rely on real live stream data.
}

/* ── Response snapshot cache ──────────────────────────────────────────────
   The AIS websocket writes into shipsCache continuously, so a GET is pure
   aggregation over whatever that map happens to hold. Rebuilding it per
   request is what pins the CPU once the maritime layer gets popular: 58 ports
   and 10 chokepoints scanned against up to 20,000 ships is ~1.4M distance
   calculations, and the reply then serialises every one of those ships — a
   multi-megabyte JSON.stringify. At ~30 req/s that whole job runs thirty
   times a second to produce a byte-identical answer.

   Building it once per SNAPSHOT_TTL_MS and handing every caller the same
   pre-serialised string makes the cost independent of how many people are
   watching. The window sits well under the 10s the client polls at, so
   nothing reaches the map staler than it already was. */
const SNAPSHOT_TTL_MS = 5_000;
const PUBLIC_NAVAL_CELL_DEG = 6;
const PUBLIC_NAVAL_MIN_GROUP = 2;
const PUBLIC_NAVAL_TIME_BUCKET_MS = 30 * 60 * 1000;

interface PublicNavalActivityCell {
  id: string;
  lat: number;
  lng: number;
  level: number;
  activity: 'محدود' | 'متوسط' | 'مرتفع';
  approximate_count: '2-4' | '5-9' | '10+';
  cell_degrees: number;
  precision: 'coarse-regional';
  time_precision: '30-minute-bucket';
  observed_at_bucket: string;
  reporting_mode: 'public-ais-aggregate';
}

export function buildPublicNavalActivity(allShips: any[], now = Date.now()): PublicNavalActivityCell[] {
  const buckets = new Map<string, { latIndex: number; lngIndex: number; count: number }>();
  for (const ship of allShips) {
    if (ship?.type !== 'military') continue;
    const lat = Number(ship?.lat);
    const lng = Number(ship?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const latIndex = Math.floor((lat + 90) / PUBLIC_NAVAL_CELL_DEG);
    const lngIndex = Math.floor((lng + 180) / PUBLIC_NAVAL_CELL_DEG);
    const key = `${latIndex}:${lngIndex}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.count += 1;
    else buckets.set(key, { latIndex, lngIndex, count: 1 });
  }

  const observedAtBucket = new Date(
    Math.floor(now / PUBLIC_NAVAL_TIME_BUCKET_MS) * PUBLIC_NAVAL_TIME_BUCKET_MS
  ).toISOString();

  return [...buckets.entries()].flatMap(([key, bucket]) => {
    if (bucket.count < PUBLIC_NAVAL_MIN_GROUP) return [];
    const level = bucket.count >= 10 ? 3 : bucket.count >= 5 ? 2 : 1;
    return [{
      id: `naval-activity-${key}`,
      lat: -90 + (bucket.latIndex + 0.5) * PUBLIC_NAVAL_CELL_DEG,
      lng: -180 + (bucket.lngIndex + 0.5) * PUBLIC_NAVAL_CELL_DEG,
      level,
      activity: level === 3 ? 'مرتفع' : level === 2 ? 'متوسط' : 'محدود',
      approximate_count: bucket.count >= 10 ? '10+' : bucket.count >= 5 ? '5-9' : '2-4',
      cell_degrees: PUBLIC_NAVAL_CELL_DEG,
      precision: 'coarse-regional',
      time_precision: '30-minute-bucket',
      observed_at_bucket: observedAtBucket,
      reporting_mode: 'public-ais-aggregate',
    }];
  });
}

const globalForSnapshot = globalThis as unknown as {
  maritimeSnapshot?: { body: string; builtAt: number };
};

function buildSnapshot(now: number): string {
  // Clean up stale ships (older than 10 minutes)
  for (const [mmsi, ship] of shipsCache.entries()) {
    if (now - ship.timestamp > 10 * 60 * 1000) {
      shipsCache.delete(mmsi);
    }
  }

  // Public WORLD never exposes military-class AIS tracks. We derive only
  // coarse regional naval activity before removing those source rows.
  const allShips = Array.from(shipsCache.values());
  const navalActivity = buildPublicNavalActivity(allShips, now);
  const ships = allShips.filter(isExplicitPublicCivilianShip);
  const publicPorts = PORTS.filter(port => port.type !== 'naval');

  // Dynamically calculate live traffic (Fast approximation of Haversine)
  const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const dx = (lng1 - lng2) * Math.cos((lat1 + lat2) / 2 * Math.PI / 180);
    const dy = lat1 - lat2;
    return Math.sqrt(dx * dx + dy * dy) * 111.32;
  };

  const dynamicPorts = publicPorts.map(port => {
    let nearbyCount = 0;
    let waitingCount = 0;

    for (let i = 0; i < ships.length; i++) {
      if (getDistanceKm(port.lat, port.lng, ships[i].lat, ships[i].lng) < 50) {
        nearbyCount++;
        // If speed is less than 0.5 knots, consider it anchored/waiting
        if (ships[i].speed < 0.5 && ships[i].type !== 'military') {
          waitingCount++;
        }
      }
    }

    // Heuristic: More than 40% waiting indicates congestion
    const congestionRatio = nearbyCount > 0 ? waitingCount / nearbyCount : 0;
    let congestionStatus = 'NORMAL';
    let estDwellTime = '1-2 Days';
    
    if (congestionRatio > 0.6 || waitingCount > 30) {
      congestionStatus = 'SEVERE';
      estDwellTime = '7+ Days';
    } else if (congestionRatio > 0.4 || waitingCount > 15) {
      congestionStatus = 'CONGESTED';
      estDwellTime = '3-5 Days';
    }

    return {
      ...port,
      volume: `${port.volume} | LIVE: ${nearbyCount} (WAITING: ${waitingCount})`,
      congestion: congestionStatus,
      dwell_time: estDwellTime
    };
  });

  const dynamicChokepoints = CHOKEPOINTS.map(choke => {
    let nearbyCount = 0;
    for (let i = 0; i < ships.length; i++) {
      if (getDistanceKm(choke.lat, choke.lng, ships[i].lat, ships[i].lng) < 100) nearbyCount++;
    }
    
    // Dynamically adjust risk based on live ship concentration
    let dynamicRisk = choke.risk;
    if (nearbyCount > 50) dynamicRisk = 'CRITICAL';
    else if (nearbyCount > 20 && dynamicRisk !== 'CRITICAL') dynamicRisk = 'HIGH';
    else if (nearbyCount > 5 && dynamicRisk === 'LOW') dynamicRisk = 'ELEVATED';

    return {
      ...choke,
      traffic: `${choke.traffic} | LIVE SHIPS: ${nearbyCount}`,
      risk: dynamicRisk
    };
  });

  const latestObservedMs = ships.reduce((latest, ship) => {
    const observed = Number(ship?.timestamp);
    return Number.isFinite(observed) ? Math.max(latest, observed) : latest;
  }, 0);
  const aisConfigured = Boolean(process.env.AIS_API_KEY);
  const aisStatus = !aisConfigured
    ? 'not_configured'
    : ships.length > 0
      ? 'active'
      : globalForAis.isAisConnecting
        ? 'connecting'
        : 'configured_no_data';

  return JSON.stringify({
    ports: dynamicPorts,
    chokepoints: dynamicChokepoints,
    ships,
    naval_activity: navalActivity,
    naval_activity_meta: {
      mode: 'coarse-regional-aggregate',
      source_mode: 'public-ais-observations',
      cell_degrees: PUBLIC_NAVAL_CELL_DEG,
      minimum_group: PUBLIC_NAVAL_MIN_GROUP,
      time_precision: '30-minute-bucket',
      identifiers_exposed: false,
      exact_tracks_exposed: false,
      speed_heading_exposed: false,
      unobserved_vessels_inferred: false,
      absence_semantics: 'No aggregate cell means no qualifying public AIS observations in the current cache, not proof of absence.',
    },
    total_ports: dynamicPorts.length,
    total_chokepoints: dynamicChokepoints.length,
    total_ships: ships.length,
    source: 'AISStream.io + M3TM static maritime reference',
    source_status: {
      ais: {
        status: aisStatus,
        configured: aisConfigured,
        provider: 'AISStream.io',
        public_ships: ships.length,
        military_public_cells: navalActivity.length,
        latest_observed_at: latestObservedMs ? new Date(latestObservedMs).toISOString() : null,
        latest_observation_age_s: latestObservedMs ? Math.max(0, Math.round((now - latestObservedMs) / 1000)) : null,
        persistence: 'process-memory',
        serverless_note: 'A persistent live AIS stream requires a long-lived ingestion process; serverless instances may reset between invocations.',
        exact_military_tracks_exposed: false,
      },
      reference: {
        status: 'active',
        provider: 'M3TM.WORLD curated static reference',
        ports: dynamicPorts.length,
        chokepoints: dynamicChokepoints.length,
      },
    },
    timestamp: new Date(now).toISOString(),
    storage: {
      mode: durableCacheConfigured() ? 'durable+memory' : 'memory',
      hydrated_from_durable: !!globalForAis.hydratedFromDurable,
      military_tracks_persisted: false,
      naval_aggregate_persisted: false,
    },
  });
}

/** Test seam — forces the next GET to rebuild. */
export function clearMaritimeSnapshot(): void {
  delete globalForSnapshot.maritimeSnapshot;
}

export async function GET() {
  // Trigger Hybrid Fallback
  await fetchVesselApiFallback();
  await hydratePublicShipsFromDurable();

  const now = Date.now();
  const cached = globalForSnapshot.maritimeSnapshot;

  const snapshot = cached && now - cached.builtAt < SNAPSHOT_TTL_MS
    ? cached
    : { body: buildSnapshot(now), builtAt: now };
  globalForSnapshot.maritimeSnapshot = snapshot;

  if (
    now - (globalForAis.lastDurableWriteAt || 0) >= MARITIME_DURABLE_WRITE_INTERVAL_MS
    && shipsCache.size > 0
  ) {
    globalForAis.lastDurableWriteAt = now;
    try {
      const parsed = JSON.parse(snapshot.body) as { ships?: any[]; timestamp?: string };
      const safeShips = (parsed.ships || [])
        .filter(isExplicitPublicCivilianShip)
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
        .slice(0, MARITIME_MAX_PERSISTED_SHIPS);
      if (safeShips.length > 0) {
        await durableSetJson(
          MARITIME_PUBLIC_CACHE_KEY,
          { ships: safeShips, observed_at: parsed.timestamp || new Date(now).toISOString() },
          MARITIME_PUBLIC_CACHE_TTL_SECONDS,
        );
      }
    } catch (error) {
      console.warn('[M3TM.WORLD] AIS durable snapshot skipped:', error instanceof Error ? error.message : error);
    }
  }

  const maxAgeSeconds = Math.floor(SNAPSHOT_TTL_MS / 1000);

  return new NextResponse(snapshot.body, {
    headers: {
      'Content-Type': 'application/json',
      // The server would not have produced anything newer inside this window
      // either, so let the browser and any CDN in front of it skip the round
      // trip entirely rather than re-asking every 10s per open tab.
      'Cache-Control': `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=15`,
    },
  });
}
