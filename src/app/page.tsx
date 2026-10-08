'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Newspaper, Search, X, Globe, MapPinned, Route, Satellite, Moon, ExternalLink, AlertTriangle, Activity, Database, Wifi, Play, Network, Crosshair, Pentagon, Radio, PenLine, Save } from 'lucide-react';
import { type TerrainStatus } from '@/lib/map-terrain';
import { loadCameraCatalog, mergeCameraCatalog } from '@/lib/camera-catalog';
import { buildPublicLayerData } from '@/lib/publicLayerData';
import { buildAppNewsPins } from '@/lib/appNewsPins';
import { buildPublicFieldAlerts } from '@/lib/publicFieldAlerts';
import { restoreLayerState, serializeLayerState } from '@/lib/layerUrlState';
import WorldFeed from '@/components/WorldFeed';
import ScmPanel from '@/components/ScmPanel';
import SearchBar from '@/components/SearchBar';
import DirectionsBar, { type RouteResult, type LiveLocation } from '@/components/DirectionsBar';
import NavigationView from '@/components/NavigationView';
import FlightWatchPanel, { type WatchedFlight, type FlightTelemetry, type AircraftDetail, type Airport } from '@/components/FlightWatchPanel';
import type { NavProgress } from '@/lib/navigation';
import type { LiveDetection } from '@/lib/malware-intel';
import ScaleBar from '@/components/ScaleBar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { applySettings, loadSavedSettings } from '@/lib/style-tokens';
import SharePanel from '@/components/SharePanel';
import ViewPresets from '@/components/ViewPresets';
import KeyboardShortcuts from '@/components/KeyboardShortcuts';
import GlobalStatusBar from '@/components/GlobalStatusBar';
import LiveAlerts from '@/components/LiveAlerts';
import MenaPulse from '@/components/MenaPulse';
import ArcGISPanel from '@/components/ArcGISPanel';
import { SATELLITE_VISUAL_PRESETS, type SatelliteVisualPreset } from '@/lib/satellite-visual-preset';
import { loadWorldWorkspaceSnapshot, saveWorldWorkspaceSnapshot } from '@/lib/workspacePersistence';
import { recordWorldVisitOnce } from '@/lib/publicVisitCounter';
import WorldBrandMark from '@/components/WorldBrandMark';
const WorldMap = dynamic(() => import('@/components/WorldMap'), { ssr: false });
const LayerPanel = dynamic(() => import('@/components/LayerPanel'));
const SpaceCam = dynamic(() => import('@/components/SpaceCam'), { ssr: false });
const CameraViewer = dynamic(() => import('@/components/CameraViewer'));
const DrawingToolbar = dynamic(() => import('@/components/DrawingToolbar'), { ssr: false });
const DrawHud = dynamic(() => import('@/components/DrawHud'), { ssr: false });
// The measurement helpers are pure functions — importing them directly keeps
// them out of the lazy chunk, so a finished polygon can be measured whether or
// not the toolbar has loaded yet.
import { toShape, queryRing, type DrawMode, type DrawnShape, type DrawProgress, type DrawResult } from '@/lib/draw';
import { selectInPolygon } from '@/lib/aoi';
import { diffSweep, appendEvents, type WatchBaseline, type WatchEvent } from '@/lib/watch';
import { STORAGE_KEY, serializeShapes, deserializeShapes, shapesToGeoJSON, downloadFile } from '@/lib/aoi-export';

const M3TM_APP_ORIGIN = 'https://m3tm.app';
type EmbeddedNewsItem = {
  id: string;
  title: string;
  source: string;
  url: string;
  latitude: number;
  longitude: number;
  originLatitude?: number;
  originLongitude?: number;
  routeStatus?: 'verified';
};
type EmbeddedNewsPayload = {
  id?: unknown;
  title?: unknown;
  source?: unknown;
  url?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  originLatitude?: unknown;
  originLongitude?: unknown;
  routeStatus?: unknown;
};

type EmbeddedRoute = {
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
};

function toEmbeddedCoordinate(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max ? coordinate : null;
}

const DEFAULT_ACTIVE_LAYERS = {
  flights: true, private: true, jets: true, military: false, military_activity: true, maritime: true, naval_activity: true,
  satellites: false, sat_comms: false, sat_military: false, sat_navigation: true,
  sat_earth: true, sat_science: true, balloons: false, cctv: true, cctv_previews: true,
  live_news: true, earthquakes: true, fires: false, weather: false, radiation: false,
  infrastructure: false, global_incidents: true, conflict_zones: true, conflict_density: true, frontlines: true, reported_routes: true, day_night: true,
  cables: true, sdk_sea: true, sdk_air: true, sdk_naval: true, terrain_3d: false,
  terrain_elevation: false, terrain_etopo_2022: false, malware: false, cyber_attacks: false, gdelt_events: true, civil_unrest: true,
  cf_outages: true, cf_attacks: true, app_news: true, alert_pins: true, country_borders: true,
};

const PUBLIC_EMBED_ACTIVE_LAYERS = Object.fromEntries(
  Object.keys(DEFAULT_ACTIVE_LAYERS).map((key) => [
    key,
    [
      'live_news', 'global_incidents', 'conflict_zones', 'conflict_density', 'frontlines', 'gdelt_events',
      'reported_routes', 'military_activity', 'naval_activity', 'civil_unrest', 'earthquakes', 'flights', 'private', 'jets', 'sdk_air', 'cf_outages', 'cf_attacks', 'sat_military', 'sat_navigation', 'sat_earth', 'sat_science',
      // Published, source-backed M3TM.APP news should be visible from the first APP embed paint.
      'app_news', 'alert_pins',
      'country_borders',
    ].includes(key),
  ]),
) as typeof DEFAULT_ACTIVE_LAYERS;

// Public controls expose only generalized military awareness. Exact military tracks and internal OSINT tools stay outside this surface.
const PUBLIC_EMBED_LAYER_KEYS = [
  'flights', 'military_activity', 'private', 'jets', 'maritime', 'naval_activity',
  'satellites', 'sat_comms', 'sat_military', 'sat_navigation', 'sat_earth', 'sat_science',
  'cctv', 'cctv_previews', 'live_news', 'earthquakes', 'fires', 'weather',
  'infrastructure', 'conflict_zones', 'conflict_density', 'frontlines',
  'reported_routes', 'global_incidents', 'gdelt_events', 'civil_unrest', 'cables',
  'sdk_sea', 'sdk_air', 'sdk_naval',
  'malware', 'cf_outages', 'cf_attacks', 'app_news', 'alert_pins', 'country_borders', 'day_night', 'terrain_3d',
  'terrain_elevation', 'terrain_etopo_2022',
] as const;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Mobile if narrow, OR landscape phone (short height + moderate width)
      setIsMobile(w < 768 || (h < 500 && w < 1024));
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  return isMobile;
}
/** Extracts a watchable YouTube URL from embed/channel URLs */
function getYouTubeWatchUrl(url: string): string {
  if (url.includes('channel=')) return `https://www.youtube.com/channel/${url.split('channel=')[1].split('&')[0]}/live`;
  if (url.includes('/embed/')) return `https://www.youtube.com/watch?v=${url.split('/embed/')[1].split('?')[0]}`;
  return url;
}

function ViewSegment({ active, onClick, title, icon: Icon, label, layoutId }: {
  active: boolean;
  onClick: () => void;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  layoutId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-mono font-medium tracking-[0.18em] transition-colors duration-200 ${
        active ? 'text-[var(--gold-light)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="absolute inset-0 rounded-md border border-[var(--border-active)] bg-[var(--gold-primary)]/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_14px_var(--gold-glow)]"
        />
      )}
      <Icon className="w-3.5 h-3.5 relative z-10" />
      <span className="hidden md:inline relative z-10">{label}</span>
    </button>
  );
}

export default function Dashboard() {
  const dataRef = useRef<any>({});
  const [dataVersion, setDataVersion] = useState(0);
  const data = dataRef.current;

  useEffect(() => {
    void recordWorldVisitOnce();
  }, []);

  const [, setBackendStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [mapView, setMapView] = useState<{ zoom: number; latitude: number; longitude?: number }>({ zoom: 2.5, latitude: 20, longitude: 0 });
  const [flyToLocation, setFlyToLocation] = useState<{ lat: number; lng: number; zoom?: number; ts: number } | null>(null);
  const [embedMode, setEmbedMode] = useState(false);
  const [embedSurface, setEmbedSurface] = useState<'public' | 'internal'>('internal');
  const [embeddedNewsItems, setEmbeddedNewsItems] = useState<EmbeddedNewsItem[]>([]);
  const [embeddedRoute, setEmbeddedRoute] = useState<EmbeddedRoute | null>(null);
  const worldMapReadyRef = useRef(false);
  const mouseCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const coordsDisplayRef = useRef<HTMLDivElement>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [regionDossier, setRegionDossier] = useState<any>(null);
  const [dossierLoading, setDossierLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const autoLocateCancelled = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const embedded = params.get('embed') === '1' && window.parent !== window;
    const publicSurface = params.get('surface') === 'public';
    if (!embedded && !publicSurface) return;

    const frameId = window.requestAnimationFrame(() => {
      setEmbedMode(embedded);
      setEmbedSurface(publicSurface ? 'public' : 'internal');
      setShowSplash(false);
    });
    if (!embedded) {
      return () => window.cancelAnimationFrame(frameId);
    }
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== M3TM_APP_ORIGIN || event.source !== window.parent) return;
      const message = event.data;
      if (!message || message.source !== 'm3tm-app' || message.version !== 1) return;
      if (message.type === 'm3tm:hello') {
        if (worldMapReadyRef.current) {
          window.parent.postMessage({ source: 'm3tm-world', type: 'm3tm:ready', version: 1 }, M3TM_APP_ORIGIN);
        }
        return;
      }
      if (message.type !== 'm3tm:sync') return;

      const items: EmbeddedNewsItem[] = Array.isArray(message.newsItems)
        ? message.newsItems.flatMap((item: EmbeddedNewsPayload) => {
            const latitude = toEmbeddedCoordinate(item?.latitude, -90, 90);
            const longitude = toEmbeddedCoordinate(item?.longitude, -180, 180);
            if (
              typeof item?.id !== 'string'
              || !item.id
              || latitude === null
              || longitude === null
            ) return [];
            const originLatitude = toEmbeddedCoordinate(item?.originLatitude, -90, 90);
            const originLongitude = toEmbeddedCoordinate(item?.originLongitude, -180, 180);
            const verifiedRoute = item?.routeStatus === 'verified' && originLatitude !== null && originLongitude !== null;
            const mapped: EmbeddedNewsItem = {
              id: item.id,
              title: String(item.title || 'خبر'),
              source: String(item.source || ''),
              url: String(item.url || ''),
              latitude,
              longitude,
            };
            if (verifiedRoute) {
              mapped.originLatitude = originLatitude;
              mapped.originLongitude = originLongitude;
              mapped.routeStatus = 'verified';
            }
            return [mapped];
          })
        : [];

      setEmbeddedNewsItems(items);
      if (typeof message.selectedNewsId === 'string') {
        const selected = items.find(item => item.id === message.selectedNewsId);
        if (selected) {
          setFlyToLocation({ lat: selected.latitude, lng: selected.longitude, zoom: 6, ts: Date.now() });
          if (selected.routeStatus === 'verified' && selected.originLatitude !== undefined && selected.originLongitude !== undefined) {
            setEmbeddedRoute({
              geometry: {
                type: 'LineString',
                coordinates: [
                  [selected.originLongitude, selected.originLatitude],
                  [selected.longitude, selected.latitude],
                ],
              },
              from: { lat: selected.originLatitude, lng: selected.originLongitude },
              to: { lat: selected.latitude, lng: selected.longitude },
            });
          } else {
            setEmbeddedRoute(null);
          }
        } else {
          setEmbeddedRoute(null);
        }
      } else {
        setEmbeddedRoute(null);
      }
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('message', onMessage);
    };
  }, []);

  const [activeCamera, setActiveCamera] = useState<any>(null);
  const [, setSpaceWeather] = useState<any>(null);
  const [showLayers, setShowLayers] = useState(true);  const [showAlerts, setShowAlerts] = useState(false);
  const [showSpaceCam, setShowSpaceCam] = useState(false);
  const [showScmPanel, setShowScmPanel] = useState(true);
  const [showDrawing, setShowDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null);
  const [drawProgress, setDrawProgress] = useState<DrawProgress | null>(null);
  const [drawCommand, setDrawCommand] = useState<{ action: 'undo' | 'finish' | 'cancel'; seq: number } | null>(null);
  const sendDraw = useCallback((action: 'undo' | 'finish' | 'cancel') => {
    setDrawCommand(c => ({ action, seq: (c?.seq ?? 0) + 1 }));
  }, []);
  /** AOIs whose contents are being watched for arrivals and departures. */
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [watchEvents, setWatchEvents] = useState<WatchEvent[]>([]);
  const watchBaselines = useRef<Record<string, WatchBaseline>>({});
  const [selectedPolygon, setSelectedPolygon] = useState<string | null>(null);
  const [showDesktopSearch, setShowDesktopSearch] = useState(false);
  const [showDirections, setShowDirections] = useState(false);
  const [activeRoute, setActiveRoute] = useState<
    (RouteResult & {
      from: { lat: number; lng: number };
      to: { lat: number; lng: number };
      alternates?: Array<{ type: 'LineString'; coordinates: [number, number][] }>;
      activeSegment?: [number, number][] | null;
    }) | null
  >(null);
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  const [followUser, setFollowUser] = useState(false);
  const [navSession, setNavSession] = useState<
    { route: RouteResult; label: string; key: number } | null
  >(null);
  const [navProgress, setNavProgress] = useState<NavProgress | null>(null);
  const [watchedFlights, setWatchedFlights] = useState<WatchedFlight[]>([]);
  const [aircraftAirports, setAircraftAirports] = useState<Record<string, Airport[]>>({});

  // The popup lives in raw map HTML, so it hands aircraft over through a global.
  useEffect(() => {
    (window as unknown as { m3tmWatchFlight?: (f: WatchedFlight) => void }).m3tmWatchFlight = (f) => {
      if (!f?.icao24) return;
      setWatchedFlights((prev) =>
        prev.some((w) => w.icao24 === f.icao24) ? prev : [...prev, f].slice(-6));
    };
  }, []);

  const removeWatched = useCallback((icao24: string) => {
    setWatchedFlights((prev) => prev.filter((w) => w.icao24 !== icao24));
    setAircraftAirports((prev) => {
      const next = { ...prev };
      delete next[icao24];
      return next;
    });
  }, []);

  const handleAircraftDetail = useCallback((icao24: string, detail: AircraftDetail | null) => {
    const ports = [detail?.origin, detail?.destination]
      .filter((a): a is Airport => Boolean(a && Number.isFinite(a.lat) && Number.isFinite(a.lng)));
    setAircraftAirports((prev) => (ports.length ? { ...prev, [icao24]: ports } : prev));
  }, []);

  // Telemetry for watched aircraft, refreshed from whatever the feed last gave us.
  const watchTelemetry = useMemo(() => {
    const out: Record<string, FlightTelemetry> = {};
    if (!watchedFlights.length) return out;
    const buckets = [
      data?.commercial_flights, data?.private_flights,
      data?.private_jets, data?.military_flights,
    ];
    const wanted = new Set(watchedFlights.map((w) => w.icao24));
    for (const bucket of buckets) {
      for (const f of bucket || []) {
        if (f?.icao24 && wanted.has(f.icao24)) {
          out[f.icao24] = {
            lat: f.lat, lng: f.lng, alt: f.alt,
            speed_knots: f.speed_knots, heading: f.heading,
            grounded: f.grounded, squawk: f.squawk,
          };
        }
      }
    }
    return out;
  }, [watchedFlights, data]);

  // A navigation session owns its own position watch. The planner's watch dies
  // with the planner when guidance takes over the panel, so guidance cannot
  // depend on it — without this the banner sits on "waiting for a fix" forever.
  useEffect(() => {
    if (!navSession) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setLiveLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
      }),
      () => { /* the view already explains the HTTPS requirement */ },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [navSession]);  const [showArcGIS, setShowArcGIS] = useState(false);
  const [arcgisLayers, setArcgisLayers] = useState<Array<{ id: string; title: string; url: string; geojson: any; color: string; visible: boolean; opacity: number }>>([]);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; bounds?: { west: number; south: number; east: number; north: number } } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'layers'|'intel'|'search'|null>(null);
  const [showMenaPulse, setShowMenaPulse] = useState(false);
  const [mapProjection, setMapProjection] = useState<'globe'|'mercator'>('globe');
  const [terrainFocus, setTerrainFocus] = useState(0);
  const [terrainStatus, setTerrainStatus] = useState<TerrainStatus>('idle');
  const [terrainRetry, setTerrainRetry] = useState(0);
  const [mapStyle, setMapStyle] = useState<'dark'|'satellite'>('satellite');
  const [satelliteVisual, setSatelliteVisual] = useState<SatelliteVisualPreset>('clarity');
  const [sweepData, setSweepData] = useState<any>(null);
  const [scanTargets, setScanTargets] = useState<any[]>([]);
  const [drawnPolygons, setDrawnPolygons] = useState<DrawnShape[]>([]);
  const [demoMode, setDemoMode] = useState(false);
  const [worldTheme, setWorldTheme] = useState<'core'|'ghost'>('core');

  useEffect(() => {
    document.body.className = worldTheme === 'core' ? '' : `theme-${worldTheme}`;
  }, [worldTheme]);

  /* Style Studio overrides are inline on <body>, so they survive the theme
     swap above and only need reapplying once per load. */
  useEffect(() => {
    const saved = loadSavedSettings();
    if (saved) applySettings(saved);
  }, []);

  const isMobile = useIsMobile();
  const startTime = useRef(Date.now());
  const geocodeCache = useRef<Map<string, string>>(new Map());
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGeocodedPos = useRef<{ lat: number; lng: number } | null>(null);

  // ── DEFAULT: Most layers OFF — fast initial load ──
  const [activeLayers, setActiveLayers] = useState(DEFAULT_ACTIVE_LAYERS);
  const [showPublicEmbedLayers, setShowPublicEmbedLayers] = useState(false);
  const workspaceAutoSaveReadyRef = useRef(false);
  const [saveConfirmed, setSaveConfirmed] = useState(false);

  const saveWorkspaceNow = useCallback(() => {
    const savedAt = saveWorldWorkspaceSnapshot({
      activeLayers,
      projection: mapProjection,
      mapStyle,
      theme: worldTheme,
      satelliteVisual,
      view: {
        lat: Number.isFinite(mapView.latitude) ? mapView.latitude : 20,
        lng: Number.isFinite(mapView.longitude) ? Number(mapView.longitude) : 0,
        zoom: Number.isFinite(mapView.zoom) ? mapView.zoom : 2.5,
      },
    });
    if (!savedAt) return;
    setSaveConfirmed(true);
    window.setTimeout(() => setSaveConfirmed(false), 1600);
  }, [activeLayers, mapProjection, mapStyle, mapView.latitude, mapView.longitude, mapView.zoom, satelliteVisual, worldTheme]);

  useEffect(() => {
    // Never overwrite URL-selected layers on the standalone public WORLD page.
    if (!embedMode || embedSurface !== 'public') return;
    const frameId = window.requestAnimationFrame(() => {
      setActiveLayers(PUBLIC_EMBED_ACTIVE_LAYERS);
      setShowLayers(false);
      setShowAlerts(false);
      setShowSpaceCam(false);
      setShowDrawing(false);
      setShowDirections(false);
      setShowArcGIS(false);
      setMobilePanel(null);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [embedMode, embedSurface]);
  // Server-side capability flags — describe provider readiness without locking toggles.
  const selectFlatMap = () => {
    setActiveLayers(prev => ({ ...prev, terrain_elevation: false, terrain_3d: false }));
    setMapProjection('mercator');
  };
  const terrainPanelProps = {
    terrainStatus,
    on3DModeSelected: () => setMapProjection('globe'),
    onTerrainRetry: () => setTerrainRetry(value => value + 1),
    onTerrainFocus: () => setTerrainFocus(value => value + 1),
  };
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [liveFeedUrl, setLiveFeedUrl] = useState<string | null>(null);
  const [liveFeedName, setLiveFeedName] = useState('');
  const [liveFeedEmbedAllowed, setLiveFeedEmbedAllowed] = useState(true);

  // Splash screen
  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 2500);
    return () => clearTimeout(splashTimer);
  }, []);

  // On mount: geolocate by IP and fly to user's city (after splash/map init)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Restore active layers from URL if present on standalone WORLD.
    // Embedded surfaces still probe provider readiness, but do not inherit
    // arbitrary URL layer state or auto-geolocate behind the parent app.
    const p = new URLSearchParams(window.location.search);
    const isEmbeddedFrame = p.get('embed') === '1' && window.parent !== window;
    if (!isEmbeddedFrame) {
      const savedWorkspace = loadWorldWorkspaceSnapshot();
      const explicitLayers = p.has('layers');
      const lat = Number(p.get('lat'));
      const lng = Number(p.get('lon'));
      const zoom = Number(p.get('zoom'));
      const explicitView = p.has('lat') && p.has('lon') && p.has('zoom')
        && Number.isFinite(lat) && Math.abs(lat) <= 90
        && Number.isFinite(lng) && Math.abs(lng) <= 180
        && Number.isFinite(zoom) && zoom >= 0 && zoom <= 24;

      if (savedWorkspace) {
        if (!explicitLayers) setActiveLayers(prev => ({ ...prev, ...savedWorkspace.activeLayers }));
        setMapProjection(savedWorkspace.projection);
        setMapStyle(savedWorkspace.mapStyle);
        setWorldTheme(savedWorkspace.theme);
        setSatelliteVisual(savedWorkspace.satelliteVisual);
        if (!explicitView) {
          autoLocateCancelled.current = true;
          setFlyToLocation({ ...savedWorkspace.view, ts: Date.now() });
        }
      }

      if (explicitLayers) setActiveLayers(prev => restoreLayerState(prev, p));
      if (explicitView) {
        autoLocateCancelled.current = true;
        setFlyToLocation({ lat, lng, zoom, ts: Date.now() });
      }

      window.setTimeout(() => { workspaceAutoSaveReadyRef.current = true; }, 0);
    }
    // Probe credential-gated feeds without exposing credentials. Provider
    // readiness is status only and never overrides the user's layer selection.
    fetch('/api/cloudflare-radar?probe=1', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(p => {
        if (!p) return;
        const configured = Boolean(p.configured);
        const fallbackAvailable = Boolean(p.fallback_available);
        setCapabilities(current => ({ ...current, cloudflare: configured || fallbackAvailable }));
        dataRef.current = {
          ...dataRef.current,
          cloudflare_source_status: {
            status: configured ? 'configured' : fallbackAvailable ? 'active_fallback' : 'not_configured',
            configured,
            fallback_active: !configured && fallbackAvailable,
            fallback_sections: {
              outages: !configured && fallbackAvailable,
              attacks: !configured && fallbackAvailable,
            },
            provider: configured
              ? String(p.source || 'Cloudflare Radar')
              : String(p.fallback_source || 'GDELT 2.0 + abuse.ch Feodo Tracker'),
            source_mode: configured ? 'cloudflare-radar' : fallbackAvailable ? 'public-fallback' : 'unavailable',
            providers: {},
            timestamp: new Date().toISOString(),
          },
        };
        setDataVersion(v => v + 1);
      })
      .catch(() => {
        dataRef.current = {
          ...dataRef.current,
          cloudflare_source_status: { status: 'unavailable', configured: false, provider: 'Cloudflare Radar', timestamp: new Date().toISOString() },
        };
        setDataVersion(v => v + 1);
      });
    if (isEmbeddedFrame) return;

    // Once the user interacts, a late IP-location response must not steal the
    // camera back. The request is also cancelled when this page unmounts.
    const geoController = new AbortController();
    const cancelAutoLocate = () => { autoLocateCancelled.current = true; };
    window.addEventListener('pointerdown', cancelAutoLocate, { once: true });
    window.addEventListener('keydown', cancelAutoLocate, { once: true });
    const geoTimer = setTimeout(() => {
      if (autoLocateCancelled.current) return;
      fetch('/api/geo', { signal: geoController.signal })
        .then(r => r.json())
        .then(geo => {
          if (!autoLocateCancelled.current && !geoController.signal.aborted && geo.status === 'success' &&
              Number.isFinite(geo.lat) && Number.isFinite(geo.lon) && Math.abs(geo.lat) <= 90 && Math.abs(geo.lon) <= 180) {
            setFlyToLocation({ lat: geo.lat, lng: geo.lon, zoom: 8, ts: Date.now() });
          }
        })
        .catch(() => { /* silent — keep default global view */ });
    }, 3000);

    return () => {
      clearTimeout(geoTimer); geoController.abort();
      window.removeEventListener('pointerdown', cancelAutoLocate);
      window.removeEventListener('keydown', cancelAutoLocate);
    };
  }, []);

  // URL state: persist active layers only (lat/lon comes from IP geolocation on each load)
  const urlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (urlTimer.current) clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const params = serializeLayerState(activeLayers, new URLSearchParams(window.location.search));
      const url = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(null, '', url);
    }, 1500);
  }, [activeLayers]);

  // Local workspace continuity: one-click save is backed by a quiet autosave.
  // Embedded instances do not write host-specific state into this browser.
  useEffect(() => {
    if (embedMode || !workspaceAutoSaveReadyRef.current) return;
    const timer = window.setTimeout(() => {
      saveWorldWorkspaceSnapshot({
        activeLayers,
        projection: mapProjection,
        mapStyle,
        theme: worldTheme,
        satelliteVisual,
        view: {
          lat: Number.isFinite(mapView.latitude) ? mapView.latitude : 20,
          lng: Number.isFinite(mapView.longitude) ? Number(mapView.longitude) : 0,
          zoom: Number.isFinite(mapView.zoom) ? mapView.zoom : 2.5,
        },
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [activeLayers, embedMode, mapProjection, mapStyle, mapView.latitude, mapView.longitude, mapView.zoom, satelliteVisual, worldTheme]);

  useEffect(() => {
    if (embedMode) return;
    const saveShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveWorkspaceNow();
      }
    };
    window.addEventListener('keydown', saveShortcut);
    return () => window.removeEventListener('keydown', saveShortcut);
  }, [embedMode, saveWorkspaceNow]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as Element)?.tagName)) return;
      if (e.key === 'f' && !e.ctrlKey) {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      }
      if (e.key === 'l') setShowLayers(p => !p);
      if (e.key === 'c') setShowScmPanel(p => !p);
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) { setShowDesktopSearch(p => !p); setShowAlerts(false); setShowSpaceCam(false); }
      if (e.key === 'r' && !e.ctrlKey && !e.metaKey) setFlyToLocation({ lat: 20, lng: 0, zoom: 2.5, ts: Date.now() });
      if (e.key === 'g') {
        setActiveLayers(prev => ({ ...prev, terrain_elevation: false, terrain_3d: false }));
        setMapProjection(p => p === 'globe' ? 'mercator' : 'globe');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowDesktopSearch(true); setShowAlerts(false); setShowSpaceCam(false);
      }
    };
    const fsHandler = () => setIsFullscreen(!!document.fullscreenElement);
    window.addEventListener('keydown', handler);
    document.addEventListener('fullscreenchange', fsHandler);
    return () => { window.removeEventListener('keydown', handler); document.removeEventListener('fullscreenchange', fsHandler); };
  }, []);

  // Mouse coords + reverse geocode (Zero-Render)
  const handleMouseCoords = useCallback((coords: { lat: number; lng: number }) => {
    mouseCoordsRef.current = coords;
    if (coordsDisplayRef.current) {
      coordsDisplayRef.current.innerText = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    }
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      if (lastGeocodedPos.current) {
        const d = Math.abs(coords.lat - lastGeocodedPos.current.lat) + Math.abs(coords.lng - lastGeocodedPos.current.lng);
        if (d < 0.5) return; // increased threshold — fewer geocode calls
      }
      const gk = `${coords.lat.toFixed(1)},${coords.lng.toFixed(1)}`; // coarser grid = more cache hits
      if (geocodeCache.current.has(gk)) { setLocationLabel(geocodeCache.current.get(gk)!); lastGeocodedPos.current = coords; return; }
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json&zoom=10&addressdetails=1`, { headers: { 'Accept-Language': 'ar-SA,ar;q=0.9,en;q=0.5' } });
        if (res.ok) {
          const d = await res.json();
          const a = d.address || {};
          const label = [a.city||a.town||a.village||a.county, a.state||a.region, a.country].filter(Boolean).join(', ') || 'غير معروف';
          if (geocodeCache.current.size > 500) { const it = geocodeCache.current.keys(); for (let i=0;i<100;i++) { const k = it.next().value; if(k) geocodeCache.current.delete(k); }}
          geocodeCache.current.set(gk, label);
          setLocationLabel(label);
          lastGeocodedPos.current = coords;
        }
      } catch (e) { console.warn('[M3TM.WORLD] Suppressed error:', e instanceof Error ? e.message : e); }
    }, 3000); // 3s debounce (was 1.5s)
  }, []);

  // Region dossier (right-click)
  const handleRightClick = useCallback(async (coords: { lat: number; lng: number }) => {
    setDossierLoading(true); setRegionDossier(null);
    try {
      const res = await fetch(`/api/region-dossier?lat=${coords.lat}&lng=${coords.lng}`);
      if (res.ok) setRegionDossier(await res.json());
    } catch (e) { console.warn('[M3TM.WORLD] Suppressed error:', e instanceof Error ? e.message : e); } finally { setDossierLoading(false); }
  }, []);
  // Entity click handler (hoisted from JSX to comply with Rules of Hooks - Fixes #113)
  const handleEntityClick = useCallback((entity: any) => {
    if (entity?.type === 'cctv') setActiveCamera(entity);
    if (embedMode && entity?.type === 'live_news' && typeof entity.id === 'string' && entity.id) {
      window.parent.postMessage({
        source: 'm3tm-world',
        type: 'm3tm:select',
        version: 1,
        id: entity.id,
      }, M3TM_APP_ORIGIN);
      return;
    }
    if (entity?.type === 'live_news' && entity.url) {
      setLiveFeedUrl(entity.url);
      setLiveFeedName(entity.name);
      setLiveFeedEmbedAllowed(entity.embed_allowed !== false);
    }
  }, [embedMode]);

  const handleWorldMapReady = useCallback(() => {
    worldMapReadyRef.current = true;
    if (!embedMode) return;
    window.parent.postMessage({
      source: 'm3tm-world',
      type: 'm3tm:ready',
      version: 1,
    }, M3TM_APP_ORIGIN);
  }, [embedMode]);

  // ── Drawing / AOI ──
  // WorldMap already owns the draw interaction and the polygon rendering;
  // this only turns a finished ring into a measured, named, coloured record.
  // Restore drawn areas on load. Work that vanishes on refresh is work the
  // operator will not trust the tool with.
  useEffect(() => {
    try {
      const restored = deserializeShapes(localStorage.getItem(STORAGE_KEY));
      if (restored.length) setDrawnPolygons(restored);
    } catch { /* storage unavailable — start empty */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, serializeShapes(drawnPolygons)); } catch { /* quota or private mode */ }
  }, [drawnPolygons]);

  // ── Tripwires ──
  // Re-sweep every watched AOI whenever live data refreshes and record what
  // changed. Keyed off dataVersion rather than `data` so this runs once per
  // refresh instead of once per render.
  useEffect(() => {
    if (watched.size === 0) return;
    const now = Date.now();
    const fresh: WatchEvent[] = [];
    for (const shape of drawnPolygons) {
      if (!watched.has(shape.id)) continue;
      const ring = queryRing(shape);
      if (!ring) continue;
      const report = selectInPolygon(ring, dataRef.current as any);
      const prev = watchBaselines.current[shape.id] ?? null;
      const { baseline, events } = diffSweep(shape.id, report, prev, now);
      watchBaselines.current[shape.id] = baseline;
      fresh.push(...events);
    }
    if (fresh.length) setWatchEvents(log => appendEvents(log, fresh));
  }, [dataVersion, watched, drawnPolygons]);

  const toggleWatch = useCallback((id: string) => {
    setWatched(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Drop the baseline too, so re-arming starts clean rather than
        // reporting everything that moved while the watch was off.
        delete watchBaselines.current[id];
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDrawComplete = useCallback((result: DrawResult) => {
    setDrawnPolygons(prev => [toShape(result, prev, prev.length), ...prev]);
    // One shape per arming: staying armed after a finish is how you end up
    // with an accidental second AOI from the click that dismisses the first.
    setDrawMode(null);
    setDrawProgress(null);
  }, []);

  const handleExportGeoJSON = useCallback(() => {
    downloadFile(
      `m3tm-world-aoi-${new Date().toISOString().slice(0, 10)}.geojson`,
      JSON.stringify(shapesToGeoJSON(drawnPolygons), null, 2),
      'application/geo+json',
    );
  }, [drawnPolygons]);

  // ── SHARED FETCH UTILITY (Fixes #107 — single definition, not 3 copies) ──
  /* `skipWhenHidden` is for background polling only — skipping a *user-initiated*
     load (a layer toggle, or first paint in a background tab) leaves the caller
     believing it fetched, so the layer stays empty until a full reload.
     Returns whether data actually landed, so callers can retry. */
  const fetchEndpoint = useCallback(async (
    url: string,
    transform?: (d: any) => any,
    options?: RequestInit,
    { skipWhenHidden = false }: { skipWhenHidden?: boolean } = {},
  ): Promise<boolean> => {
    if (skipWhenHidden && typeof document !== 'undefined' && document.hidden) return false;
    try {
      // Force the browser to bypass its local disk cache for real-time data
      const res = await fetch(url, { ...options, cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const d = transform ? transform(json) : json;
        dataRef.current = { ...dataRef.current, ...d };
        setDataVersion(v => v + 1);
        setBackendStatus('connected');
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[M3TM.WORLD] Suppressed error:', e instanceof Error ? e.message : e);
      setBackendStatus('error');
      return false;
    }
  }, []);

  // ── PROGRESSIVE DATA LOADING (request-optimized) ──
  useEffect(() => {
    // Priority 1: Core feeds (always needed for panels)
    const eqUrl = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';
    const eqTransform = (data: any) => ({ earthquakes: (data.features || []).map((f: any) => ({ id: f.id, lat: f.geometry?.coordinates?.[1] || 0, lng: f.geometry?.coordinates?.[0] || 0, depth: f.geometry?.coordinates?.[2] || 0, magnitude: f.properties?.mag, place: f.properties?.place, time: f.properties?.time, url: f.properties?.url, tsunami: f.properties?.tsunami, type: f.properties?.type, felt: f.properties?.felt, alert: f.properties?.alert })) });
    fetchEndpoint(eqUrl, eqTransform);
    fetchEndpoint('/api/news');
    /* A cold start can time out every upstream quote and return an all-empty
       feed. Waiting a full poll interval to find out leaves the panel blank for
       15 minutes, so retry a few times up-front until instruments actually land. */
    const marketRetries: ReturnType<typeof setTimeout>[] = [];
    const loadMarkets = async (attempt = 0) => {
      await fetchEndpoint('/api/markets', d => ({ markets: d }));
      if ((dataRef.current.markets?.count || 0) === 0 && attempt < 3) {
        marketRetries.push(setTimeout(() => loadMarkets(attempt + 1), 15000));
      }
    };
    const marketTimer = setTimeout(() => loadMarkets(), 800);

    // Priority 2: Space Weather telemetry
    const spaceTimer = setTimeout(async () => {
      try {
        const r = await fetch('/api/space-weather');
        if (r.ok) setSpaceWeather(await r.json());
      } catch (e) { console.warn('[M3TM.WORLD] Suppressed error:', e instanceof Error ? e.message : e); }
    }, 5000);

    // Polling — OPTIMIZED intervals to minimize edge requests
    const intervals = [
      setInterval(() => fetchEndpoint(eqUrl, eqTransform, undefined, { skipWhenHidden: true }), 900000),  // 15 min (was 5)
      setInterval(() => fetchEndpoint('/api/news', undefined, undefined, { skipWhenHidden: true }), 60000),          // 1 min — shared by map panels and top-news ticker
      setInterval(() => fetchEndpoint('/api/markets', d => ({ markets: d }), undefined, { skipWhenHidden: true }), 900000), // 15 min (was 5)
    ];
    return () => {
      clearTimeout(marketTimer);
      marketRetries.forEach(clearTimeout);
      clearTimeout(spaceTimer);
      intervals.forEach(clearInterval);
    };
  }, [fetchEndpoint]);

  // ── LAYER-AWARE DATA LOADING — only fetch when layer is toggled ON ──
  const layerFetchedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!activeLayers.cctv) return;
    return loadCameraCatalog(cameras => {
      dataRef.current = {
        ...dataRef.current,
        cameras: mergeCameraCatalog(dataRef.current.cameras ?? [], cameras),
      };
      setDataVersion(value => value + 1);
      setBackendStatus('connected');
    }, () => {
      console.warn('[M3TM.WORLD] Camera catalogue load failed; bounded retry scheduled');
      dataRef.current = { ...dataRef.current, camera_catalog_error: true };
      setDataVersion(v => v + 1);
    }, status => {
      const earlier = dataRef.current.camera_catalog_status?.sourceNames ?? [];
      dataRef.current = {
        ...dataRef.current,
        camera_catalog_error: false,
        camera_catalog_status: {
          ...status,
          // Across partial-region retries retain each observed provider once.
          sourceNames: Array.from(new Set([...earlier, ...status.sourceNames])),
        },
      };
      setDataVersion(v => v + 1);
    });
  }, [activeLayers.cctv]);

  useEffect(() => {
    const flightRetryTimers: ReturnType<typeof setTimeout>[] = [];
    const wantsFlights = activeLayers.flights || activeLayers.military ||
      activeLayers.military_activity || activeLayers.jets || activeLayers.private || activeLayers.sdk_air;

    // Flights
    const loadFlights = (attempt = 0) => {
      layerFetchedRef.current.add('flights');
      void fetchEndpoint('/api/flights').then(ok => {
        const state = dataRef.current.flight_source_status?.status;
        if (ok && state !== 'empty') return;
        layerFetchedRef.current.delete('flights');
        if (attempt < 2 && wantsFlights) {
          const timer = setTimeout(() => loadFlights(attempt + 1), 5000 * (attempt + 1));
          flightRetryTimers.push(timer);
        }
      });
    };
    if (wantsFlights && !layerFetchedRef.current.has('flights')) loadFlights();
    // Satellites (any satellite sub-layer triggers fetch)
    const anySatLayer = activeLayers.satellites || activeLayers.sat_comms || activeLayers.sat_military || activeLayers.sat_navigation || activeLayers.sat_earth || activeLayers.sat_science;
    if (anySatLayer && !layerFetchedRef.current.has('satellites')) {
      // Keep the moment the positions were propagated for. The catalogue is
      // fetched once and never re-polled, so by the time an orbit is requested
      // these markers can be a long way out of date — the orbit route needs the
      // marker's epoch to draw a track that still passes through it.
      fetchEndpoint('/api/satellites', d => ({ ...d, satellites_at: d.timestamp }));
      layerFetchedRef.current.add('satellites');
    }
    // Fires
    if (activeLayers.fires && !layerFetchedRef.current.has('fires')) {
      fetchEndpoint('/api/fires');
      layerFetchedRef.current.add('fires');
    }
    // Maritime
    if ((activeLayers.maritime || activeLayers.naval_activity || activeLayers.sdk_sea) && !layerFetchedRef.current.has('maritime')) {
      fetchEndpoint('/api/maritime', d => ({
        maritime_ports: d.ports ?? [],
        maritime_chokepoints: d.chokepoints ?? [],
        maritime_ships: d.ships ?? [],
        naval_activity: d.naval_activity ?? [],
        naval_activity_meta: d.naval_activity_meta ?? null,
        maritime_source_status: d.source_status ?? null,
        maritime_source: d.source ?? 'M3TM maritime reference',
        maritime_timestamp: d.timestamp ?? null,
      }));
      layerFetchedRef.current.add('maritime');
    }
    // Live News
    if (activeLayers.live_news && !layerFetchedRef.current.has('live_news')) {
      fetchEndpoint('/api/live-news', d => ({ live_feeds: d.feeds }));
      layerFetchedRef.current.add('live_news');
    }
    // Weather
    if (activeLayers.weather && !layerFetchedRef.current.has('weather')) {
      fetchEndpoint('/api/weather', d => ({ weather_events: d.events }));
      layerFetchedRef.current.add('weather');
    }
    // Infrastructure
    if (activeLayers.infrastructure && !layerFetchedRef.current.has('infrastructure')) {
      fetchEndpoint('/api/infrastructure', d => ({ infrastructure: d.infrastructure }));
      layerFetchedRef.current.add('infrastructure');
    }
    // Global Incidents (GDELT)
    if ((activeLayers.global_incidents || activeLayers.sdk_naval) && !layerFetchedRef.current.has('gdelt')) {
      fetchEndpoint('/api/gdelt', d => ({ gdelt: d.events }));
      layerFetchedRef.current.add('gdelt');
    }

    // Submarine Cables — shared by `cables` layer AND `sdk_sea` SDK domain
        if ((activeLayers.cables || activeLayers.sdk_sea) && !layerFetchedRef.current.has('cables')) {
      (async () => {
        try {
          const ts = Date.now();
      const res = await fetch(`/data/submarine-cables.json?v=${ts}`);
          if (res.ok) {
             const cablesData = await res.json();
             dataRef.current = { ...dataRef.current, submarine_cables: cablesData.features };
             setDataVersion(v => v + 1);
          }
        } catch (e) { console.warn('Cables fetch failed'); }
      })();
      layerFetchedRef.current.add('cables');
    }


    // Live Malware (abuse.ch) is pushed, not fetched — see the SSE subscription below.

    // Live Cyber Attacks (animated arcs)
    if ((activeLayers as any).cyber_attacks && !layerFetchedRef.current.has('cyber_attacks')) {
      fetchEndpoint('/api/cyber-attacks', d => ({ cyber_attacks: d.attacks }));
      layerFetchedRef.current.add('cyber_attacks');
    }
    /* Mark before awaiting so a re-render mid-flight cannot double-fetch, then
       release the mark if nothing landed — otherwise one failed request leaves
       the layer permanently empty. */
    const loadLayerOnce = (key: string, url: string, transform: (d: any) => any) => {
      if (layerFetchedRef.current.has(key)) return;
      layerFetchedRef.current.add(key);
      fetchEndpoint(url, transform).then(ok => {
        if (!ok) layerFetchedRef.current.delete(key);
      });
    };

    // Static, non-operational global border reference from a vendored Natural Earth 1:110m dataset.
    if ((activeLayers as any).country_borders) {
      loadLayerOnce('country_borders', '/data/ne110-land-boundaries.geojson', d => ({
        country_boundaries: d?.type === 'FeatureCollection' && Array.isArray(d.features)
          ? d : { type: 'FeatureCollection', features: [] },
        country_boundaries_meta: d?.metadata || null,
      }));
    }

    // GDELT 2.0 source-backed conflict + protest/civil-unrest reports.
    if ((activeLayers as any).gdelt_events || (activeLayers as any).reported_routes || (activeLayers as any).civil_unrest) {
      loadLayerOnce('gdelt_events', '/api/gdelt-events?quad=3,4&min_articles=2&limit=1000', d => {
        const events = Array.isArray(d.events) ? d.events : [];
        return {
          gdelt_events: events.filter((event: any) => event?.quad === 4 && event?.event_category !== 'civil_unrest'),
          civil_unrest: events.filter((event: any) => event?.event_category === 'civil_unrest'),
          reported_routes: d.reported_routes ?? [],
          reported_routes_meta: d.reported_routes_meta ?? null,
          gdelt_source_published_at: d.source_published_at ?? null,
          gdelt_data_state: d.data_state ?? 'unknown',
        };
      });
    }
    if ((activeLayers as any).conflict_zones || (activeLayers as any).conflict_density) {
      loadLayerOnce('conflicts', '/api/conflicts', d => ({
        conflict_zones: d.zones ?? [],
        conflict_live_events: d.liveEvents ?? [],
        conflict_source_status: d.sourceStatus ?? null,
        conflict_category_counts: d.categoryCounts ?? {},
        conflict_data_state: d.dataState ?? 'live',
        conflict_served_at: d.servedAt ?? d.timestamp ?? null,
        conflict_source_published_at: d.sourcePublishedAt ?? null,
        conflict_summary: {
          totalZones: d.totalZones ?? 0,
          totalLiveEvents: d.totalLiveEvents ?? 0,
          activeWarzones: d.activeWarzones ?? 0,
          zonesWithRecentReports: d.zonesWithRecentReports ?? 0,
          timestamp: d.timestamp ?? null,
        },
      }));
    }
    if ((activeLayers as any).frontlines) {
      loadLayerOnce('frontlines', '/api/frontlines', d => ({
        frontlines: d.frontlines ?? { type: 'FeatureCollection', features: [] },
        frontlines_meta: {
          total: d.total ?? 0,
          status: d.status ?? 'unavailable',
          source: d.source ?? 'DeepStateMap.Live',
          sourceMode: d.sourceMode ?? 'published-snapshot',
          timestamp: d.timestamp ?? null,
        },
      }));
    }

    // Network events — Cloudflare Radar when configured, otherwise factual public fallbacks.
    if ((activeLayers as any).cf_outages || (activeLayers as any).cf_attacks) {
      loadLayerOnce('cloudflare_radar', '/api/cloudflare-radar', d => ({
        cf_outages: d.outages ?? [],
        cf_attack_origins: d.attack_origins ?? [],
        cloudflare_source_status: {
          status: d.partial ? 'partial' : d.fallback_active ? 'active_fallback' : d.configured === false ? 'not_configured' : 'active',
          configured: d.configured === true,
          fallback_active: d.fallback_active === true,
          fallback_sections: d.fallback_sections ?? { outages: false, attacks: false },
          provider: d.source ?? 'Cloudflare Radar',
          source_mode: d.source_mode ?? (d.fallback_active ? 'public-fallback' : 'cloudflare-radar'),
          cloudflare_status: d.cloudflare_status ?? (d.configured ? 'active' : 'not_configured'),
          providers: d.providers ?? {},
          timestamp: d.timestamp ?? new Date().toISOString(),
          partial: d.partial === true,
        },
      }));
    }

    return () => flightRetryTimers.forEach(clearTimeout);
  }, [activeLayers, fetchEndpoint]);

  // ── LAYER-AWARE POLLING — only poll data for active layers ──
  useEffect(() => {
    const intervals: ReturnType<typeof setInterval>[] = [];
    // Legacy layer polling (gated by legacy toggle names).
    if (activeLayers.flights || activeLayers.military || activeLayers.military_activity || activeLayers.jets || activeLayers.private || activeLayers.sdk_air) {
      const flightPollMs = activeLayers.military_activity ? 120000 : 300000;
      intervals.push(setInterval(() => fetchEndpoint('/api/flights'), flightPollMs));
    }

    if ((activeLayers as any).cyber_attacks) {
      intervals.push(setInterval(() => {
        layerFetchedRef.current.delete('cyber_attacks');
        fetchEndpoint('/api/cyber-attacks', d => ({ cyber_attacks: d.attacks }));
        layerFetchedRef.current.add('cyber_attacks');
      }, 10000)); // 10s — rapid refresh
    }

    if (activeLayers.global_incidents || activeLayers.sdk_naval) {
      intervals.push(setInterval(() => fetchEndpoint('/api/gdelt', d => ({ gdelt: d.events || [] })), 300000));
    }
    if ((activeLayers as any).gdelt_events || (activeLayers as any).reported_routes || (activeLayers as any).civil_unrest) {
      intervals.push(setInterval(() => fetchEndpoint('/api/gdelt-events?quad=3,4&min_articles=2&limit=1000', d => {
        const events = Array.isArray(d.events) ? d.events : [];
        return {
          gdelt_events: events.filter((event: any) => event?.quad === 4 && event?.event_category !== 'civil_unrest'),
          civil_unrest: events.filter((event: any) => event?.event_category === 'civil_unrest'),
          reported_routes: d.reported_routes ?? [],
          reported_routes_meta: d.reported_routes_meta ?? null,
          gdelt_source_published_at: d.source_published_at ?? null,
          gdelt_data_state: d.data_state ?? 'unknown',
        };
      }, undefined, { skipWhenHidden: true }), showMenaPulse ? 60000 : 300000));
    }
    if ((activeLayers as any).conflict_zones || (activeLayers as any).conflict_density) {
      intervals.push(setInterval(() => fetchEndpoint('/api/conflicts', d => ({
        conflict_zones: d.zones ?? [],
        conflict_live_events: d.liveEvents ?? [],
        conflict_source_status: d.sourceStatus ?? null,
        conflict_category_counts: d.categoryCounts ?? {},
        conflict_data_state: d.dataState ?? 'live',
        conflict_served_at: d.servedAt ?? d.timestamp ?? null,
        conflict_source_published_at: d.sourcePublishedAt ?? null,
        conflict_summary: {
          totalZones: d.totalZones ?? 0,
          totalLiveEvents: d.totalLiveEvents ?? 0,
          activeWarzones: d.activeWarzones ?? 0,
          zonesWithRecentReports: d.zonesWithRecentReports ?? 0,
          timestamp: d.timestamp ?? null,
        },
      }), undefined, { skipWhenHidden: true }), showMenaPulse ? 60000 : 300000));
    }
    if ((activeLayers as any).frontlines) {
      intervals.push(setInterval(() => fetchEndpoint('/api/frontlines', d => ({
        frontlines: d.frontlines ?? { type: 'FeatureCollection', features: [] },
        frontlines_meta: {
          total: d.total ?? 0,
          status: d.status ?? 'unavailable',
          source: d.source ?? 'DeepStateMap.Live',
          sourceMode: d.sourceMode ?? 'published-snapshot',
          timestamp: d.timestamp ?? null,
        },
      })), 1800000));
    }

    // Network-event monitor: refresh source-backed public observations without
    // depending on a Cloudflare credential. Cloudflare remains preferred when configured.
    if ((activeLayers as any).cf_outages || (activeLayers as any).cf_attacks) {
      intervals.push(setInterval(() => fetchEndpoint('/api/cloudflare-radar', d => ({
        cf_outages: d.outages ?? [],
        cf_attack_origins: d.attack_origins ?? [],
        cloudflare_source_status: {
          status: d.partial ? 'partial' : d.fallback_active ? 'active_fallback' : d.configured === false ? 'not_configured' : 'active',
          configured: d.configured === true,
          fallback_active: d.fallback_active === true,
          fallback_sections: d.fallback_sections ?? { outages: false, attacks: false },
          provider: d.source ?? 'Cloudflare Radar',
          source_mode: d.source_mode ?? (d.fallback_active ? 'public-fallback' : 'cloudflare-radar'),
          cloudflare_status: d.cloudflare_status ?? (d.configured ? 'active' : 'not_configured'),
          providers: d.providers ?? {},
          timestamp: d.timestamp ?? new Date().toISOString(),
          partial: d.partial === true,
        },
      }), undefined, { skipWhenHidden: true }), 180000));
    }
    return () => intervals.forEach(clearInterval);
  }, [activeLayers, fetchEndpoint, showMenaPulse]);

  // Maritime earns a fast cadence only while live vessels are actually arriving.
  // With no live AIS rows, ports/chokepoints are static reference data and poll at 5m.
  useEffect(() => {
    if (!(activeLayers.maritime || activeLayers.naval_activity || activeLayers.sdk_sea)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const transformMaritime = (d: any) => ({
      maritime_ports: d.ports ?? [],
      maritime_chokepoints: d.chokepoints ?? [],
      maritime_ships: d.ships ?? [],
        naval_activity: d.naval_activity ?? [],
        naval_activity_meta: d.naval_activity_meta ?? null,
        maritime_source_status: d.source_status ?? null,
      maritime_source: d.source ?? 'M3TM maritime reference',
      maritime_timestamp: d.timestamp ?? null,
    });

    const schedule = () => {
      if (cancelled) return;
      const liveShips = Array.isArray(dataRef.current.maritime_ships) ? dataRef.current.maritime_ships.length : 0;
      const navalCells = Array.isArray(dataRef.current.naval_activity) ? dataRef.current.naval_activity.length : 0;
      timer = setTimeout(async () => {
        await fetchEndpoint('/api/maritime', transformMaritime, undefined, { skipWhenHidden: true });
        schedule();
      }, liveShips > 0 ? 10_000 : navalCells > 0 ? 60_000 : 300_000);
    };
    schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeLayers.maritime, activeLayers.naval_activity, activeLayers.sdk_sea, fetchEndpoint]);
  /* ── LIVE MALWARE — pushed over SSE while the layer is on ──
     Detections arrive when URLhaus reports them rather than on a timer, so
     there is no poll interval to tune and no request that re-downloads the
     same rows to discover nothing changed. The connection also carries the
     progressive geolocation fill, which is why a cold server paints the map in
     batches instead of staying empty and then snapping to full. */
  useEffect(() => {
    if (!activeLayers.malware) return;

    const source = new EventSource('/api/malware/stream');
    // Keyed by address: a host re-reported with a new payload updates its node
    // rather than stacking a second dot on the same coordinates.
    const byIp = new Map<string, LiveDetection>();
    // The server sends `status` at the end of every poll, so the first one
    // marks the end of the initial fill — anything after it is genuinely new
    // and worth drawing attention to.
    let filled = false;

    const commit = () => {
      dataRef.current = { ...dataRef.current, malware_threats: [...byIp.values()] };
      setDataVersion(v => v + 1);
    };

    source.onmessage = ev => {
      try {
        const event = JSON.parse(ev.data);
        if (event.type === 'snapshot') {
          byIp.clear();
          for (const d of event.detections) byIp.set(d.ip, d);
          commit();
        } else if (event.type === 'detections') {
          // Only a first sighting is an arrival. An existing host that served
          // another payload arrives with fresh:false and keeps whatever beacon
          // state it already had, so it does not re-flag itself as new.
          const beacon = filled && event.fresh;
          for (const d of event.detections) {
            byIp.set(d.ip, beacon ? { ...d, detected_at: Date.now() } : { ...d, detected_at: byIp.get(d.ip)?.detected_at });
          }
          commit();
        } else if (event.type === 'status') {
          filled = true;
          // Hosts that have gone dark since the last poll. The store prunes
          // these; without mirroring it here the map would only ever grow.
          if (event.retired?.length) {
            for (const ip of event.retired) byIp.delete(ip);
            commit();
          }
        }
        setBackendStatus('connected');
      } catch {
        // One malformed frame must not tear down the subscription.
      }
    };

    /* EventSource reconnects on its own, firing `error` on each attempt, and
       the store replays a snapshot on connect so a drop self-heals. Only a
       readyState of CLOSED means it has given up — reporting the transient
       ones would flag the backend as down every time a connection recycles. */
    source.onopen = () => setBackendStatus('connected');
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) setBackendStatus('error');
    };

    return () => source.close();
  }, [activeLayers.malware]);

  // CCTV: loaded once on layer toggle via layerFetchedRef (no viewport polling)

  // Reactive layer fetch: handled by layerFetchedRef above (no duplicate)

  // ── M3TM.WORLD — shared live-data layer ──
  // Memoized so generated SDK entities recompute only when dataVersion or SDK toggles change.
  const sdkEntities = useMemo(() => {
    const entities: any[] = [];
    const anyActive = activeLayers.sdk_sea || activeLayers.sdk_air || activeLayers.sdk_naval;
    if (!anyActive) return entities;
    const allFlights = [
      ...(data.commercial_flights || []),
      ...(data.private_flights || []),
      ...(data.private_jets || []),
    ];
    const flightStep = Math.max(1, Math.floor(allFlights.length / 60));
    for (let i = 0; i < allFlights.length; i += flightStep) {
      const f = allFlights[i];
      if (!f.lat || !f.lng) continue;
      entities.push({
        type: 'Feature', geometry: { type: 'Point', coordinates: [f.lng, f.lat] },
        properties: { domain: 'AIR', name: f.callsign?.trim() || 'مسار', source: 'ADS-B / OpenSky' },
      });
    }
    const ships = data.maritime_ships || [];
    const shipStep = Math.max(1, Math.floor(ships.length / 60));
    for (let i = 0; i < ships.length; i += shipStep) {
      const s = ships[i];
      if (!s.lat || !s.lng) continue;
      entities.push({
        type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: { domain: 'SEA', name: s.name || `MMSI-${s.mmsi}`, source: 'AIS Stream' },
      });
    }
    const landEqs = (data.earthquakes || []).filter((eq: any) => eq.lat && eq.lng);
    for (const eq of landEqs) {
      if (!eq.lat || !eq.lng) continue;
      entities.push({
        type: 'Feature', geometry: { type: 'Point', coordinates: [eq.lng, eq.lat] },
        properties: { domain: 'LAND', name: `M${eq.magnitude} ${eq.place || ''}`, source: 'USGS' },
      });
    }
    const gdeltData = data.gdelt || [];
    for (const g of gdeltData) {
      if (!g.lat || !g.lng) continue;
      entities.push({
        type: 'Feature', geometry: { type: 'Point', coordinates: [g.lng, g.lat] },
        properties: { domain: 'EVENTS', name: g.name || 'حدث GDACS', source: 'GDACS' },
      });
    }
    const newsData = data.news || [];
    for (const n of newsData) {
      if (!n.coords || n.coords.length < 2) continue;
      entities.push({
        type: 'Feature', geometry: { type: 'Point', coordinates: [n.coords[1], n.coords[0]] },
        properties: { domain: 'NEWS', name: n.title || 'خبر', source: n.source || 'RSS' },
      });
    }
    return entities;
  }, [dataVersion, activeLayers.sdk_sea, activeLayers.sdk_air, activeLayers.sdk_naval]);

  const embeddedLiveFeeds = useMemo(() => embeddedNewsItems.map(item => ({
    bridge_id: item.id,
    name: item.title,
    city: '',
    country: item.source,
    url: item.url,
    category: 'm3tm-app',
    embed_allowed: true,
    lat: item.latitude,
    lng: item.longitude,
    ...(item.routeStatus === 'verified'
      && item.originLatitude !== undefined
      && item.originLongitude !== undefined
      ? {
          route_status: 'verified',
          origin_lat: item.originLatitude,
          origin_lng: item.originLongitude,
        }
      : {}),
  })), [embeddedNewsItems]);

  const sdkDisplayData = useMemo(() => (
    embedSurface === 'public'
      ? {
          ...buildPublicLayerData(data, embeddedLiveFeeds),
          app_news: buildAppNewsPins(data.news),
          alert_pins: buildPublicFieldAlerts(data.news),
          country_boundaries: data.country_boundaries || { type: 'FeatureCollection', features: [] },
        }
      : {
          ...data,
          app_news: buildAppNewsPins(data.news),
          alert_pins: buildPublicFieldAlerts(data.news),
          sdk_entities: sdkEntities,
          ...(embeddedLiveFeeds.length ? { live_feeds: embeddedLiveFeeds } : {}),
        }
  ), [data, embedMode, embedSurface, embeddedLiveFeeds, sdkEntities]);

  const totalFlights = useMemo(() => (
    (data.commercial_flights?.length||0)+(data.private_flights?.length||0)+(data.private_jets?.length||0)+(data.military_flights?.length||0)
  ), [data.commercial_flights, data.private_flights, data.private_jets, data.military_flights]);


  return (
    <main className="fixed inset-0 w-full h-full bg-[var(--bg-void)] overflow-hidden">

      {/* ── SPLASH ── */}
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="absolute inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at center, #0a0a14 0%, var(--bg-void) 70%)' }}
          >
            {/* ── Scanline CRT overlay ── */}
            <div className="absolute inset-0 pointer-events-none z-[1]" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(212,175,55,0.015) 2px, rgba(212,175,55,0.015) 4px)',
              animation: 'splashScanDrift 8s linear infinite',
            }} />

            {/* ── V4.2 badge — top-left ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.9 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="absolute top-6 left-6 z-[2] font-mono text-[11px] tracking-[0.3em] text-[var(--gold-primary)]"
            >
              V4.2
            </motion.div>



            {/* ── Geometric tactical logo ── */}
            <div className="relative w-40 h-40 mb-8 flex items-center justify-center z-[2]">
              {/* Outer ring — slow clockwise */}
              <motion.div
                initial={{ opacity: 0, scale: 0.6, rotate: 0 }}
                animate={{ opacity: 1, scale: 1, rotate: 360 }}
                transition={{ opacity: { duration: 0.6 }, scale: { duration: 0.8, ease: 'easeOut' }, rotate: { duration: 20, repeat: Infinity, ease: 'linear' } }}
                className="absolute inset-0 rounded-full"
                style={{ border: '1px solid rgba(212,175,55,0.2)' }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full" style={{ background: 'var(--gold-primary)', boxShadow: '0 0 12px var(--gold-primary), 0 0 24px rgba(212,175,55,0.3)' }} />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full" style={{ background: 'rgba(212,175,55,0.5)', boxShadow: '0 0 6px rgba(212,175,55,0.3)' }} />
              </motion.div>

              {/* Middle ring — faster counter-clockwise */}
              <motion.div
                initial={{ opacity: 0, scale: 0.4, rotate: 0 }}
                animate={{ opacity: 1, scale: 1, rotate: -360 }}
                transition={{ opacity: { duration: 0.6, delay: 0.15 }, scale: { duration: 0.8, delay: 0.15, ease: 'easeOut' }, rotate: { duration: 12, repeat: Infinity, ease: 'linear' } }}
                className="absolute rounded-full"
                style={{ inset: '18px', border: '1px solid rgba(0,229,255,0.15)' }}
              >
                <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--cyan-primary)', boxShadow: '0 0 10px var(--cyan-primary), 0 0 20px rgba(0,229,255,0.2)' }} />
                <div className="absolute bottom-0 left-1/4 translate-y-1/2 w-1 h-1 rounded-full" style={{ background: 'rgba(0,229,255,0.4)' }} />
              </motion.div>

              {/* Inner ring — fastest clockwise */}
              <motion.div
                initial={{ opacity: 0, scale: 0.2, rotate: 0 }}
                animate={{ opacity: 1, scale: 1, rotate: 360 }}
                transition={{ opacity: { duration: 0.6, delay: 0.3 }, scale: { duration: 0.8, delay: 0.3, ease: 'easeOut' }, rotate: { duration: 7, repeat: Infinity, ease: 'linear' } }}
                className="absolute rounded-full"
                style={{ inset: '40px', border: '1px solid rgba(212,175,55,0.25)' }}
              >
                <div className="absolute top-0 left-1/4 -translate-y-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gold-primary)', boxShadow: '0 0 8px var(--gold-primary)' }} />
              </motion.div>

              {/* Core circle + crosshair */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                className="relative w-12 h-12 rounded-full flex items-center justify-center"
                style={{ border: '2px solid var(--gold-primary)', boxShadow: '0 0 20px rgba(212,175,55,0.15), inset 0 0 20px rgba(212,175,55,0.05)' }}
              >
                <motion.div
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-5 h-5 rounded-full"
                  style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.4) 0%, rgba(212,175,55,0.05) 70%)' }}
                />
                {/* Crosshair lines */}
                <div className="absolute w-[1px] h-full" style={{ background: 'linear-gradient(to bottom, transparent, rgba(212,175,55,0.3), transparent)' }} />
                <div className="absolute w-full h-[1px]" style={{ background: 'linear-gradient(to right, transparent, rgba(212,175,55,0.3), transparent)' }} />
              </motion.div>

              {/* Faint pulsing radar sweep */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.15, 0], rotate: [0, 360] }}
                transition={{ opacity: { duration: 3, repeat: Infinity }, rotate: { duration: 3, repeat: Infinity, ease: 'linear' }, delay: 0.6 }}
                className="absolute inset-[10px] rounded-full"
                style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(212,175,55,0.15) 40deg, transparent 80deg)' }}
              />
            </div>

                        {/* M3TM.WORLD vector brand — true transparent background, no raster halo */}
                                    <WorldBrandMark variant="hero" className="mb-3 z-[2]" />

            {/* ── Subtitle — typewriter reveal ── */}
            <div className="overflow-hidden mb-8 z-[2]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ delay: 1.2, duration: 0.8, ease: 'easeInOut' }}
                className="overflow-hidden whitespace-nowrap"
              >
                <p dir="rtl" className="text-[11px] md:text-[10px] tracking-[0.08em] text-[var(--gold-primary)]" style={{ opacity: 0.8 }}>
                  خريطة عالمية للبيانات الحية
                </p>
              </motion.div>
            </div>

            {/* ── Multi-stage progress bar ── */}
            <div className="w-64 md:w-80 z-[2]">
              {/* Thin progress track */}
              <div className="relative w-full h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(212,175,55,0.1)' }}>
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: ['0%', '25%', '50%', '78%', '100%'] }}
                  transition={{ duration: 2.2, delay: 0.5, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' }}
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: 'linear-gradient(90deg, var(--gold-primary), var(--cyan-primary), var(--gold-primary))', boxShadow: '0 0 12px rgba(212,175,55,0.4)' }}
                />
              </div>

              {/* Status messages — cycling */}
              <div className="mt-3 h-4 flex items-center justify-center">
                {[
                  { text: 'جارٍ تأمين الاتصال الآمن...', delay: 0.5 },
                  { text: 'تهيئة مصادر البيانات...', delay: 1.1 },
                  { text: 'معايرة الحساسات...', delay: 1.7 },
                  { text: 'النظام جاهز', delay: 2.2 },
                ].map((stage, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 1, 0] }}
                    transition={{ delay: stage.delay, duration: 0.6, times: [0, 0.1, 0.7, 1] }}
                    className="absolute text-[11px] font-mono tracking-[0.25em]"
                    style={{ color: i === 3 ? 'var(--cyan-primary)' : 'var(--text-secondary)' }}
                  >
                    {stage.text}
                  </motion.span>
                ))}
              </div>
            </div>

            {/* ── Decorative grid lines ── */}
            <div className="absolute inset-0 pointer-events-none z-[0]" style={{ opacity: 0.03 }}>
              <div className="absolute inset-0" style={{
                backgroundImage: 'linear-gradient(rgba(212,175,55,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.5) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
              }} />
            </div>

            {/* ── Corner frame accents ── */}
            {[
              { t: '10px', l: '10px', bw: '2px 0 0 2px' },
              { t: '10px', r: '10px', bw: '2px 2px 0 0' },
              { b: '10px', l: '10px', bw: '0 0 2px 2px' },
              { b: '10px', r: '10px', bw: '0 2px 2px 0' },
            ].map((pos, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ delay: 0.8 + i * 0.1, duration: 0.5 }}
                className="absolute w-8 h-8 z-[2]"
                style={{ top: pos.t, bottom: pos.b, left: pos.l, right: pos.r, borderWidth: pos.bw, borderStyle: 'solid', borderColor: 'var(--gold-primary)' }}
              />
            ))}



            {/* ── Inline keyframe for scanline drift ── */}

          </motion.div>
        )}
      </AnimatePresence>



      {/* ── MAP ── (dir=ltr keeps the map canvas unmirrored under RTL UI) ── */}
      <div dir="ltr" className="absolute inset-0">
      <ErrorBoundary name="Map">
        <WorldMap
          key={worldTheme}
          data={sdkDisplayData}
          activeLayers={activeLayers}
          onReady={handleWorldMapReady}
          projection={mapProjection === 'mercator' ? 'mercator' : 'globe'}
          terrainEnabled={activeLayers.terrain_elevation && mapProjection === 'globe'}
          terrainFocus={terrainFocus}
          terrainRetry={terrainRetry}
          onTerrainStatusChange={setTerrainStatus}
          mapStyle={mapStyle === 'satellite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'dark'}
          satelliteVisual={satelliteVisual} 
          onEntityClick={handleEntityClick} 
          onMouseCoords={handleMouseCoords} 
          onRightClick={embedMode ? undefined : handleRightClick}
          onViewStateChange={setMapView} 
          flyToLocation={flyToLocation}
          sweepData={sweepData}
          scanTargets={scanTargets}
          demoMode={demoMode}
          theme={worldTheme}
          arcgisLayers={arcgisLayers.filter(l => l.visible).map(l => ({ id: l.id, title: l.title, geojson: l.geojson, color: l.color, opacity: l.opacity }))}
          onMapCenter={setMapCenter}
          route={embedMode ? embeddedRoute : activeRoute}
          userLocation={
            navSession && navProgress
              ? { lat: navProgress.snapped[1], lng: navProgress.snapped[0], accuracy: liveLocation?.accuracy, heading: liveLocation?.heading }
              : liveLocation
          }
          followUser={followUser}
          onFollowInterrupt={() => setFollowUser(false)}
          navigating={Boolean(navSession)}
          drawMode={drawMode}
          onDrawProgress={setDrawProgress}
          drawCommand={drawCommand}
          onDrawCancel={() => { setDrawMode(null); setDrawProgress(null); }}
          onDrawComplete={handleDrawComplete}
          drawnPolygons={drawnPolygons}
          aircraftAirports={aircraftAirports}
        />
      </ErrorBoundary>
      </div>

      {/* ── DIRECTIONS — opens beside the right-hand tool rail ── */}
      <div
        className="absolute top-3 z-[400] w-[min(92vw,372px)] pointer-events-auto"
        style={isMobile ? { left: '50%', transform: 'translateX(-50%)' } : { right: '56px' }}
      >
        {navSession ? (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
            <NavigationView
              key={navSession.key}
              route={navSession.route}
              destinationLabel={navSession.label}
              fix={liveLocation}
              onProgress={setNavProgress}
              following={followUser}
              onRecenter={() => setFollowUser(true)}
              onExit={() => { setNavSession(null); setNavProgress(null); setFollowUser(false); }}
              onReroute={async (fromPt) => {
                // Re-plan from where the driver actually is, to the same destination.
                const dest = navSession.route.geometry.coordinates.at(-1)!;
                try {
                  const res = await fetch(
                    `/api/directions?from=${fromPt.lat},${fromPt.lng}&to=${dest[1]},${dest[0]}&mode=auto`,
                  );
                  const data = await res.json();
                  if (res.ok && !data.error) {
                    setNavSession((n) => (n ? { ...n, route: data, key: Date.now() } : n));
                    setActiveRoute({ ...data, from: fromPt, to: { lat: dest[1], lng: dest[0] } });
                  }
                } catch { /* keep the old route rather than dropping guidance */ }
              }}
            />
          </motion.div>
        ) : null}

        {/* The planner stays mounted underneath a running session: unmounting it
            would discard the route you are driving, so ending guidance would
            drop you into an empty form instead of back onto your route. */}
        {showDirections && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: navSession ? 0 : 1, y: 0 }}
            className={navSession ? 'pointer-events-none h-0 overflow-hidden' : ''}
            aria-hidden={Boolean(navSession)}
          >
            <DirectionsBar
              center={mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lng } : null}
              onRoute={(r) => setActiveRoute(r)}
              onLiveLocation={setLiveLocation}
              onFollowChange={setFollowUser}
              onActiveSegment={(seg) => setActiveRoute((r) => (r ? { ...r, activeSegment: seg } : r))}
              onStartNavigation={(r, label) => {
                setNavSession({ route: r, label, key: Date.now() });
                setFollowUser(true);
              }}
              onLocate={(lat, lng, zoom) => setFlyToLocation({ lat, lng, zoom, ts: Date.now() })}
              onClose={() => { setShowDirections(false); setActiveRoute(null); }}
            />
          </motion.div>
        )}
      </div>


      {/* ── FLIGHT WATCH ── */}
      {!embedMode && watchedFlights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
          className="absolute top-3 z-[380] w-[min(92vw,290px)] pointer-events-auto
                     max-h-[calc(100vh-180px)] overflow-y-auto styled-scrollbar"
          style={{ left: isMobile ? '12px' : '120px' }}
        >
          <FlightWatchPanel
            watched={watchedFlights}
            telemetry={watchTelemetry}
            onRemove={removeWatched}
            onLocate={(lat, lng) => setFlyToLocation({ lat, lng, zoom: 8, ts: Date.now() })}
            onDetail={handleAircraftDetail}
          />
        </motion.div>
      )}

      {/* ── MAP VIEW CONTROLS ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.5 }}
        className={`absolute bottom-[75px] md:bottom-[100px] z-[200] flex flex-col gap-1.5 pointer-events-none ${embedMode ? 'hidden' : ''}`}
        style={{ left: isMobile ? '12px' : '120px', right: isMobile ? '12px' : 'auto' }}
      >
        {/* Unified Control Strip */}
        <div className="flex w-fit max-w-full items-center justify-center gap-[3px] p-[4px] pointer-events-auto rounded-2xl border border-[var(--border-primary)] bg-[rgba(7,9,16,0.88)] backdrop-blur-2xl shadow-[0_12px_36px_rgba(0,0,0,0.58),0_0_24px_rgba(var(--gold-rgb),0.05)]">
          <ViewSegment layoutId="view-projection" active={mapProjection === 'globe'} onClick={() => setMapProjection('globe')} title="كرة ثلاثية الأبعاد" icon={Globe} label="3D" />
          <ViewSegment layoutId="view-projection" active={mapProjection === 'mercator'} onClick={selectFlatMap} title="خريطة ثنائية الأبعاد" icon={MapPinned} label="2D" />
          <div className="w-px h-5 mx-1 bg-[var(--border-secondary)]" />
          <ViewSegment layoutId="view-style" active={mapStyle === 'dark'} onClick={() => setMapStyle('dark')} title="الوضع الليلي" icon={Moon} label="خريطة" />
          <ViewSegment layoutId="view-style" active={mapStyle === 'satellite'} onClick={() => setMapStyle('satellite')} title="عرض الأقمار الصناعية" icon={Satellite} label="قمر" />
          <div className="w-px h-5 mx-1 bg-[var(--border-secondary)]" />
          <button
            type="button"
            onClick={saveWorkspaceNow}
            title="حفظ العرض الحالي الآن — الحفظ التلقائي يعمل أيضًا (Ctrl+S)"
            aria-label="حفظ العرض الحالي"
            className={`flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-[11px] font-semibold transition-colors ${saveConfirmed ? 'bg-emerald-400/20 text-emerald-200' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
          >
            <Save className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{saveConfirmed ? 'تم الحفظ' : 'حفظ'}</span>
          </button>
        </div>


        {/* One-touch regional operations layout, independent of source layers. */}
        <div dir="rtl" className="flex max-w-[min(92vw,520px)] flex-wrap items-center gap-1.5 pointer-events-auto rounded-xl border border-white/20 bg-[rgba(7,12,20,0.90)] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,.4)]" aria-label="عرض الرصد ووضوح القمر الصناعي">
          <button type="button" onClick={() => {
              selectFlatMap(); setMapStyle('dark'); setShowMenaPulse(true);
              if (isMobile) setMobilePanel('intel');
              setFlyToLocation({ lat: 25, lng: 42.5, zoom: 4.2, ts: Date.now() });
            }}
            className="rounded-md border border-cyan-300/35 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/20 focus-visible:ring-2 focus-visible:ring-cyan-300"
            title="خريطة داكنة مسطّحة، تركيز الشرق الأوسط، موجز الأدلة المنشورة — لا يغيّر المصادر">
            <MapPinned className="inline h-3.5 w-3.5 ms-1"/> مرصد الشرق الأوسط
          </button>
          {mapStyle === 'satellite' && <>
            <span className="px-1 text-[11px] font-semibold text-white/80">إضاءة الصورة</span>
            {(Object.keys(SATELLITE_VISUAL_PRESETS) as SatelliteVisualPreset[]).map(mode => (
              <button type="button" key={mode} onClick={() => setSatelliteVisual(mode)}
                title={SATELLITE_VISUAL_PRESETS[mode].descriptionAr}
                aria-pressed={satelliteVisual === mode}
                className={`rounded-md px-2 py-1.5 text-[11px] focus-visible:ring-2 focus-visible:ring-cyan-300 ${satelliteVisual === mode ? 'bg-amber-300/25 font-bold text-amber-100 ring-1 ring-amber-300/60' : 'text-white/70 hover:bg-white/15'}`}>
                {SATELLITE_VISUAL_PRESETS[mode].labelAr}
              </button>
            ))}
          </>}
        </div>
        {(activeLayers.gdelt_events || activeLayers.civil_unrest) && <details dir="rtl"
          className="pointer-events-auto max-w-[min(92vw,460px)] rounded-xl border border-white/12 bg-[#05080d]/48 px-2.5 py-1.5 text-[11px] leading-5 text-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-2xl" aria-label="دليل رموز الأحداث">
          <summary className="cursor-pointer list-none py-1 font-semibold text-amber-100">دليل الرموز ▾</summary>
          <div className="pt-1">
            <span className="text-slate-300 font-semibold">⬡ ناشر واحد / أولي</span>
            <span className="mx-2 text-white/30">|</span>
            <span className="text-orange-300 font-semibold">⬡ عدة ناشرين</span>
            <span className="mx-2 text-white/30">|</span>
            <span className="text-amber-200">● رقم = مجموعة تقارير</span>
            <span className="block text-[10px] text-white/60">الرموز تلخص بلاغات منشورة ولا تعني تأكيد الواقعة.</span>
          </div>
        </details>}
        {/* Scale Bar */}
        {!isMobile && (
          <div className="pl-0.5">
            <ScaleBar zoom={mapView.zoom} latitude={mapView.latitude} />
          </div>
        )}
      </motion.div>

            {/* ── HEADER ── */}
      <motion.div dir="ltr" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.3 }} className={`absolute top-4 z-[201] pointer-events-none ${embedMode ? 'hidden' : ''}`} style={{ left: isMobile ? '24px' : '64px' }}>
        <WorldBrandMark variant="header" className="shrink-0" />
      </motion.div>

      {/* ── TOP-RIGHT STATUS (desktop) ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className={`status-bar-desktop absolute top-4 right-6 z-[200] pointer-events-none ${embedMode ? 'hidden' : ''}`}>
        <a href={M3TM_APP_ORIGIN} title="الرجوع إلى M3TM.APP" aria-label="الرجوع إلى M3TM.APP" className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[var(--gold-primary)]/30 bg-[#05080d]/35 px-3 py-1.5 text-[9px] font-mono tracking-widest text-[var(--gold-primary)] shadow-[0_8px_28px_rgba(0,0,0,0.22)] backdrop-blur-xl transition hover:bg-[#05080d]/55">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)] animate-world-pulse" />
          <span className="text-[var(--gold-primary)] font-bold">الرجوع إلى M3TM.APP</span>
        </a>
      </motion.div>

      {/* ── MOBILE: Compact top status ── */}
      {/* The route planner claims the top of a phone screen; leaving this in
          place would put the M3TM.APP return control underneath the destination field. */}
      {!embedMode && isMobile && !showDirections && !navSession && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }} className="absolute top-3 right-3 z-[200] pointer-events-auto flex items-center gap-2">
          <a href={M3TM_APP_ORIGIN} title="الرجوع إلى M3TM.APP" aria-label="الرجوع إلى M3TM.APP" className="glass-panel px-2 py-1 flex items-center gap-1.5 text-[9px] font-mono tracking-widest hover:opacity-80 transition-opacity border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/10">
            <div className="w-1 h-1 rounded-full bg-[var(--gold-primary)] animate-world-pulse" />
            <span className="text-[var(--gold-primary)] font-bold">الرجوع إلى M3TM.APP</span>
          </a>
        </motion.div>
      )}



      {/* Public APP iframe: allow users to operate the real public layers
          without exposing internal OSINT controls or altering the bridge. */}
      {embedMode && embedSurface === 'public' && (
        <div dir="rtl" className="absolute bottom-20 left-2 z-[450] pointer-events-auto">
          <button type="button" aria-controls="m3tm-public-embed-layers"
            aria-expanded={showPublicEmbedLayers}
            onClick={() => setShowPublicEmbedLayers(open => !open)}
            className="glass-panel min-h-11 px-3 py-2 flex items-center gap-2 text-xs font-medium text-[var(--gold-primary)] shadow-lg"
            aria-label="عرض وإدارة طبقات الخريطة العامة">
            <Layers className="w-4 h-4" />
            <span>الطبقات</span>
            <span className="text-[10px] text-white/70">{PUBLIC_EMBED_LAYER_KEYS.filter(k => activeLayers[k]).length}</span>
          </button>
          {showPublicEmbedLayers && (
            <section id="m3tm-public-embed-layers" aria-label="طبقات الخريطة العامة"
              className="absolute bottom-12 left-0 w-[min(88vw,360px)] max-h-[min(65dvh,560px)] overflow-y-auto styled-scrollbar glass-panel rounded-xl border border-white/10 p-3 shadow-2xl"
              onKeyDown={event => { if (event.key === 'Escape') setShowPublicEmbedLayers(false); }}>
              <div className="sticky top-0 z-10 bg-[var(--bg-void)]/95 pb-2 mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--gold-primary)]">الطبقات العامة المتاحة</span>
                <button type="button" aria-label="إغلاق الطبقات" className="p-1 text-white/70"
                  onClick={() => setShowPublicEmbedLayers(false)}><X className="w-4 h-4" /></button>
              </div>
              <p className="mb-2 text-[10px] text-white/50">إتاحة الطبقة لا تعني توفر بيانات مصدرها الآن؛ تظهر أعداد العناصر بعد وصول البيانات.</p>
              <LayerPanel {...terrainPanelProps} data={sdkDisplayData} activeLayers={activeLayers}
                setActiveLayers={setActiveLayers} isMobile={true}
                allowedLayerKeys={PUBLIC_EMBED_LAYER_KEYS}
                capabilities={capabilities} />
            </section>
          )}
        </div>
      )}

      {/* ── NEW SIDEBAR (Root Level) ── */}
      {!embedMode && showLayers && !isMobile && <LayerPanel {...terrainPanelProps} data={sdkDisplayData} activeLayers={activeLayers} setActiveLayers={setActiveLayers} theme={worldTheme} setTheme={setWorldTheme} capabilities={capabilities} />}



      {/* ── RIGHT TOOL STRIP (desktop only — mobile uses bottom nav) ── */}
      {!embedMode && !isMobile && <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-[250] pointer-events-auto rounded-full border border-white/10 bg-[#05080d]/20 p-1 shadow-[0_14px_50px_rgba(0,0,0,0.25)] backdrop-blur-2xl">
        <div className="relative group">
          <button onClick={() => { setShowAlerts(false); setShowSpaceCam(v => !v); }} className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${showSpaceCam ? 'bg-[#00E5FF]/20' : 'hover:bg-white/10'}`} title="بث مباشر من الفضاء — قناة فيديو من محطة الفضاء الدولية" aria-label="الفضاء" aria-expanded={showSpaceCam}>
            <Radio className={`w-4 h-4 ${showSpaceCam ? 'text-[#00E5FF]' : 'text-white/60'}`} />
            {showSpaceCam && (
              <span
                aria-hidden="true"
                className="absolute -right-1 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-current text-[#00E5FF]"
              />
            )}
          </button>
          <span className="absolute right-11 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] tracking-wider text-white/90 bg-[#05080d]/65 backdrop-blur-xl rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">الفضاء</span>
          <AnimatePresence>
            {showSpaceCam && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute right-12 top-1/2 -translate-y-1/2 w-80">
                <SpaceCam />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative group">
          <button type="button" aria-label="موجز الشرق الأوسط والبحر الأحمر" aria-expanded={showMenaPulse}
            onClick={() => {
              setShowMenaPulse(p=>!p);
              setShowArcGIS(false);
              setShowAlerts(false);
              setShowSpaceCam(false);
              setShowDesktopSearch(false);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-cyan-300 hover:bg-cyan-300/20 focus-visible:ring-1">
            <MapPinned className="h-4 w-4"/>
          </button>
          <span className="absolute right-11 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-[#05080d]/65 px-2 py-1 text-[11px] text-white backdrop-blur-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none">المرصد</span>
          {showMenaPulse && <div className="absolute right-12 top-1/2 -translate-y-1/2 w-[min(89vw,440px)]">
            <MenaPulse data={sdkDisplayData} stale={data.conflict_data_state === 'cached-stale'}
              publishedAt={data.conflict_source_published_at}
              onFocus={() => setFlyToLocation({lat:27,lng:43,zoom:4.5,ts:Date.now()})}
              onLocate={(lat,lng) => setFlyToLocation({lat,lng,zoom:6,ts:Date.now()})}/>
          </div>}
        </div>
        <div className="relative group">
          <button onClick={() => { setShowAlerts(!showAlerts); setShowDrawing(false); }} className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${showAlerts ? 'bg-[#FF3D3D]/20' : 'hover:bg-white/10'}`} title="تنبيهات حية — زلازل ونزاعات وأخبار عاجلة" aria-label="التنبيهات" aria-expanded={showAlerts}>
            <AlertTriangle className={`w-4 h-4 ${showAlerts ? 'text-[#FF3D3D]' : 'text-white/60'}`} />
            {showAlerts && (
              <span
                aria-hidden="true"
                className="absolute -right-1 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-current text-[#FF3D3D]"
              />
            )}
          </button>
          <span className="absolute right-11 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] tracking-wider text-white/90 bg-[#05080d]/65 backdrop-blur-xl rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">تنبيهات</span>
          <AnimatePresence>
            {showAlerts && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute right-12 top-1/2 -translate-y-1/2 w-80">
                <LiveAlerts data={data} onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })} onWatchFeed={(url, name) => { setLiveFeedUrl(url); setLiveFeedName(name); }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative group">
          <button onClick={() => { setShowDrawing(!showDrawing); setShowAlerts(false); setShowSpaceCam(false); }} className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${showDrawing ? 'bg-[#00E5FF]/20' : 'hover:bg-white/10'}`} title="رسم — قياس مناطق الاهتمام على الخريطة" aria-label="الرسم" aria-expanded={showDrawing}>
            <PenLine className={`w-4 h-4 ${showDrawing ? 'text-[#00E5FF]' : 'text-white/60'}`} />
            {showDrawing && (
              <span
                aria-hidden="true"
                className="absolute -right-1 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-current text-[#00E5FF]"
              />
            )}
          </button>
          <span className="absolute right-11 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] tracking-wider text-white/90 bg-[#05080d]/65 backdrop-blur-xl rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">رسم</span>
        </div>

        <div className="relative group">
          <button onClick={() => { setShowDirections(!showDirections); if (showDirections) { setActiveRoute(null); } setShowDesktopSearch(false); setShowAlerts(false); setShowSpaceCam(false); setShowDrawing(false); }} className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${showDirections ? 'bg-[var(--gold-primary)]/20' : 'hover:bg-white/10'}`} title="الاتجاهات — توجيه خطوة بخطوة" aria-label="الاتجاهات" aria-expanded={showDirections}>
            <Route className={`w-4 h-4 ${showDirections ? 'text-[var(--gold-primary)]' : 'text-white/60'}`} />
            {showDirections && (
              <span
                aria-hidden="true"
                className="absolute -right-1 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-current text-[var(--gold-primary)]"
              />
            )}
          </button>
          <span className="absolute right-11 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] tracking-wider text-white/90 bg-[#05080d]/65 backdrop-blur-xl rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">مسار</span>
        </div>

        <div className="relative group">
          <button onClick={() => { setShowDesktopSearch(!showDesktopSearch); setShowAlerts(false); setShowSpaceCam(false); setShowDrawing(false); }} className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${showDesktopSearch ? 'bg-[var(--gold-primary)]/20' : 'hover:bg-white/10'}`} title="بحث — ابحث عن المواقع والمدن والإحداثيات" aria-label="البحث" aria-expanded={showDesktopSearch}>
            <Search className={`w-4 h-4 ${showDesktopSearch ? 'text-[var(--gold-primary)]' : 'text-white/60'}`} />
            {showDesktopSearch && (
              <span
                aria-hidden="true"
                className="absolute -right-1 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-current text-[var(--gold-primary)]"
              />
            )}
          </button>
          <span className="absolute right-11 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] tracking-wider text-white/90 bg-[#05080d]/65 backdrop-blur-xl rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">بحث</span>
          <AnimatePresence>
            {showDesktopSearch && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute right-12 top-1/2 -translate-y-1/2 w-80">
                <SearchBar alwaysExpanded center={mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lng } : null} onLocate={(lat, lng, zoom) => { setFlyToLocation({ lat, lng, zoom, ts: Date.now() }); setShowDesktopSearch(false); }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Separator */}
        <div className="w-4 h-px bg-white/10 mx-auto" />

        {/* ── ARCGIS INTEL ── */}
        <div className="relative group">
          <button onClick={() => {
            setShowArcGIS(v => !v);
            setShowMenaPulse(false);
            setShowAlerts(false);
            setShowSpaceCam(false);
            setShowDesktopSearch(false);
          }} className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${showArcGIS ? 'bg-[var(--gold-primary)]/20' : 'hover:bg-white/10'}`} title="مكتبة الخرائط العامة — إضافة طبقات مرجعية اختيارية" aria-label="مكتبة الخرائط العامة" aria-expanded={showArcGIS}>
            <Database className={`w-4 h-4 ${showArcGIS ? 'text-[var(--gold-primary)]' : 'text-white/60'}`} />
            {showArcGIS && (
              <span
                aria-hidden="true"
                className="absolute -right-1 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-current text-[var(--gold-primary)]"
              />
            )}
            {arcgisLayers.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-[var(--gold-primary)] text-black text-[9px] font-mono font-bold leading-none px-0.5">{arcgisLayers.length}</span>}
          </button>
          <span className="absolute right-11 top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] tracking-wider text-white/90 bg-[#05080d]/65 backdrop-blur-xl rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">مكتبة الخرائط</span>
          <AnimatePresence>
            {showArcGIS && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute right-12 top-1/2 -translate-y-1/2 w-[340px]">
                <div className="rounded-2xl border border-white/10 bg-[#05080d]/52 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl max-h-[70vh] overflow-y-auto styled-scrollbar">
                  <ArcGISPanel
                    onImportLayer={(layer) => setArcgisLayers(prev => [...prev.filter(l => l.id !== layer.id), { ...layer, color: layer.color || '#D4AF37', visible: true, opacity: layer.opacity ?? 0.8 }])}
                    onRemoveLayer={(id) => setArcgisLayers(prev => prev.filter(l => l.id !== id))}
                    onUpdateLayer={(id, updates) => setArcgisLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))}
                    importedLayers={arcgisLayers}
                    mapBounds={mapCenter?.bounds || null}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>


        {/* Separator */}
        <div className="w-4 h-px bg-white/10 mx-auto" />

      </div>}

      {/* ── LIVE FEED VIEWER OVERLAY ── */}
      <AnimatePresence>
        {!embedMode && liveFeedUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setLiveFeedUrl(null)}
          >
            <motion.div
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              className="w-[90vw] max-w-[900px] flex flex-col relative rounded-xl overflow-hidden border border-[var(--border-primary)] shadow-2xl bg-black"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#111] border-b border-[var(--border-primary)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF4081] animate-world-pulse" />
                  <span className="text-[11px] font-mono font-bold text-white tracking-wider">{liveFeedName}</span>
                  <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono text-[10px] font-bold">بث مباشر</span>
                  {!liveFeedEmbedAllowed && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono text-[10px]">خارجي فقط</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={getYouTubeWatchUrl(liveFeedUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--border-primary)] hover:bg-[var(--gold-primary)] hover:text-black text-white transition-colors text-[10px] font-mono"
                  >
                    <span>فتح في يوتيوب</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <button onClick={() => setLiveFeedUrl(null)} className="text-white/70 hover:text-white transition-colors p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body — iframe or external card */}
              {liveFeedEmbedAllowed ? (
                <div className="w-full aspect-video relative bg-black">
                  <iframe
                    src={liveFeedUrl}
                    className="w-full h-full absolute inset-0"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="w-full aspect-video flex items-center justify-center bg-black/95">
                  <div className="text-center px-8">
                    <div className="w-14 h-14 rounded-full bg-[#39FF14]/10 border border-[#39FF14]/20 flex items-center justify-center mx-auto mb-4">
                      <ExternalLink className="w-6 h-6 text-[#39FF14]" />
                    </div>
                    <p className="text-[12px] font-mono font-bold text-white tracking-widest mb-2">التضمين مقيد</p>
                    <p className="text-[10px] font-mono text-white/50 mb-6 max-w-xs">
                      {liveFeedName} لا يسمح بالتضمين من جهات خارجية. اضغط بالأسفل لفتح البث المباشر مباشرة.
                    </p>
                    <a
                      href={getYouTubeWatchUrl(liveFeedUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded border border-[#39FF14]/40 text-[#39FF14] font-mono text-[11px] hover:bg-[#39FF14]/10 transition-colors tracking-wider"
                    >
                      <ExternalLink className="w-4 h-4" />
                      فتح البث المباشر
                    </a>
                  </div>
                </div>
              )}

              {/* Footer — only show for embeddable feeds */}
              {liveFeedEmbedAllowed && (
                <div className="bg-[#111]/90 px-4 py-2.5 border-t border-[var(--border-primary)] flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-[var(--gold-primary)] shrink-0" />
                  <span className="text-[10px] font-mono text-white/70 leading-relaxed">
                    إذا ظهرت رسالة &ldquo;الفيديو غير متاح&rdquo;، استخدم <strong className="text-[var(--gold-primary)]">فتح في يوتيوب</strong> بالأعلى.
                  </span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ MOBILE UI ═══ */}
      {!embedMode && isMobile && (
        <>
          {/* Mobile Bottom Navigation */}
          <div className="mobile-nav">
            <div className="glass-panel mobile-nav-inner">
              {[
                { id: 'layers' as const, icon: Layers, label: 'الطبقات' },
                { id: 'intel' as const, icon: Newspaper, label: 'الأخبار' },
                { id: 'search' as const, icon: Search, label: 'بحث' },
                // Routing was reachable only from the desktop tool rail, so a
                // phone could not open it at all. It sits next to SEARCH
                // because both answer "take me somewhere".
                { id: 'route' as const, icon: Route, label: 'مسار' },
              ].map(tab => {
                // Routing opens the planner at the top of the screen rather than
                // the bottom drawer — it needs the room above the keyboard, and
                // guidance has to stay readable while you drive.
                const isRoute = tab.id === 'route';
                const active = isRoute ? showDirections || Boolean(navSession) : mobilePanel === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (isRoute) {
                        // Mid-drive this must not touch anything: closing the
                        // planner clears the active route, which would take the
                        // line off the map underneath a driver. Guidance is
                        // ended from the navigation view's own exit.
                        if (navSession) return;
                        setMobilePanel(null);
                        setShowDirections((open) => {
                          if (open) setActiveRoute(null);
                          return !open;
                        });
                        return;
                      }
                      setMobilePanel(mobilePanel === tab.id ? null : tab.id);
                    }}
                    aria-pressed={active}
                    disabled={isRoute && Boolean(navSession)}
                    className={`mobile-nav-btn ${active ? 'active' : ''}`}
                    style={{ fontSize: '11px', minHeight: '48px', padding: '6px 5px' }}
                  >
                    <tab.icon style={{ width: 19, height: 19 }} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile Drawer */}
          <AnimatePresence>
            {mobilePanel && (
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed bottom-[52px] left-0 right-0 z-[400] glass-panel rounded-b-none overflow-y-auto styled-scrollbar"
                style={{ maxHeight: 'min(55vh, calc(100dvh - 100px))', paddingBottom: 'env(safe-area-inset-bottom, 4px)' }}
              >
                <div className="mobile-drawer-handle" />
                <div className="px-3 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="hud-text text-[12px] text-[var(--text-primary)]">
                      {mobilePanel === 'layers' ? 'الطبقات والإحصائيات' : mobilePanel === 'intel' ? 'موجز الأخبار' : 'بحث'}
                    </span>
                    <button onClick={() => setMobilePanel(null)} className="text-[var(--text-muted)] p-1"><X className="w-4 h-4" /></button>
                  </div>
                  {mobilePanel === 'layers' && (
                    <>
                      <div className="glass-panel-sm p-2 mb-2">
                        <div className="grid grid-cols-5 gap-1 text-center">
                          <div><div className="hud-label" style={{fontSize:'9px'}}>طيران</div><div className="hud-value text-[10px]">{totalFlights.toLocaleString()}</div></div>
                          <div><div className="hud-label" style={{fontSize:'9px'}}>أقمار</div><div className="hud-value text-[10px]">{(data.satellites?.length||0)}</div></div>
                          <div><div className="hud-label" style={{fontSize:'9px'}}>كاميرات</div><div className="hud-value text-[10px]">{(data.cameras?.length||0)}</div></div>
                          <div><div className="hud-label" style={{fontSize:'9px'}}>طقس</div><div className="hud-value text-[10px]" style={{color:'var(--accent-weather)'}}>{(data.weather_events?.length||0)}</div></div>
                          <div><div className="hud-label" style={{fontSize:'9px'}}>منشآت</div><div className="hud-value text-[10px]" style={{color:'var(--accent-nuclear)'}}>{(data.infrastructure?.length||0)}</div></div>
                        </div>
                      </div>
                      <LayerPanel {...terrainPanelProps} data={sdkDisplayData} activeLayers={activeLayers} setActiveLayers={setActiveLayers} isMobile={true} theme={worldTheme} setTheme={setWorldTheme} capabilities={capabilities} />
                      <div className="mt-8">
                        <ViewPresets onNavigate={(lat, lng, zoom) => { setFlyToLocation({ lat, lng, zoom, ts: Date.now() }); setMobilePanel(null); }} />
                      </div>
                    </>
                  )}
                  {mobilePanel === 'intel' && <div className="space-y-3">
                    {/* A phone user opens أخبار to read headlines, not to
                        scroll past an entire 700px evidence console first. */}
                    <WorldFeed data={data} onLocate={(lat,lng) => {
                      setFlyToLocation({lat,lng,zoom:6,ts:Date.now()});
                      setMobilePanel(null);
                    }}/>
                    <details className="rounded-xl border border-cyan-300/25 bg-black/60 p-2">
                      <summary className="cursor-pointer py-2 text-sm font-semibold text-cyan-100">
                        مرصد الشرق الأوسط · الاشتباكات والنزاعات والمواقع
                      </summary>
                      <MenaPulse data={sdkDisplayData} stale={data.conflict_data_state === 'cached-stale'}
                        publishedAt={data.conflict_source_published_at}
                        onFocus={() => {
                          setFlyToLocation({lat:27,lng:43,zoom:4.5,ts:Date.now()});
                          setMobilePanel(null);
                        }}
                        onLocate={(lat,lng) => {
                          setFlyToLocation({lat,lng,zoom:6,ts:Date.now()});
                          setMobilePanel(null);
                        }}/>
                    </details>
                  </div>}
                  {mobilePanel === 'search' && (
                    <div className="space-y-2">
                      <SearchBar center={mapCenter ? { lat: mapCenter.lat, lng: mapCenter.lng } : null} onLocate={(lat, lng, zoom) => { setFlyToLocation({ lat, lng, zoom, ts: Date.now() }); setMobilePanel(null); }} />
                      <SharePanel mapView={mapView} activeLayers={activeLayers} mouseCoords={null} />
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── BOTTOM CURSOR INFO (desktop) ── */}
      {!embedMode && !isMobile && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3, duration: 0.8 }} className="desktop-only absolute bottom-8 z-[200] pointer-events-auto" style={{ left: '72px' }}>
          <div className="flex items-center gap-5 text-[9px] font-mono tracking-widest text-[var(--text-muted)] opacity-60">
            <div className="flex gap-2 items-center" title="إحداثيات المؤشر (مرّر فوق الخريطة)">
              <span>المؤشر</span>
              <span ref={coordsDisplayRef} className="text-[var(--gold-primary)] font-bold tabular-nums">—</span>
            </div>
            <div className="flex gap-2 items-center" title="اسم الموقع الجغرافي المعكوس">
              <span>الموقع</span>
              <span className="text-[var(--cyan-primary)] truncate max-w-[200px]">{locationLabel || 'حرّك المؤشر على الخريطة'}</span>
            </div>
            <div className="flex gap-2 items-center" title="مستوى التكبير الحالي">
              <span>التكبير</span>
              <span className="text-[var(--gold-primary)] font-bold tabular-nums">{mapView.zoom.toFixed(1)}</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Scale bar is now integrated into the map controls section above */}

      {/* ── Region Dossier ── */}
      {!embedMode && (regionDossier || dossierLoading) && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="absolute top-16 md:top-20 left-2 right-2 md:left-1/2 md:right-auto md:-translate-x-1/2 z-[300] md:w-[480px] max-h-[65vh] overflow-y-auto styled-scrollbar">
          <div className="glass-panel p-5 world-glow">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-mono font-bold text-[var(--gold-primary)] tracking-wider">ملف المنطقة</h2>
              <button onClick={() => { setRegionDossier(null); setDossierLoading(false); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs">✕</button>
            </div>
            {dossierLoading ? (
              <div className="text-center py-8">
                <div className="w-5 h-5 border-2 border-[var(--gold-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span className="text-[9px] font-mono text-[var(--text-muted)] tracking-widest">جارٍ تجميع البيانات...</span>
              </div>
            ) : regionDossier && (
              <div className="space-y-3">
                <div><div className="hud-label mb-0.5">الموقع</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.location?.display_name}</div></div>
                {regionDossier.country && (
                  <div className="grid grid-cols-2 gap-2">
                    <div><div className="hud-label mb-0.5">الدولة</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.country.flag} {regionDossier.country.name}</div></div>
                    <div><div className="hud-label mb-0.5">العاصمة</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.country.capital}</div></div>
                    <div><div className="hud-label mb-0.5">السكان</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.country.population?.toLocaleString()}</div></div>
                    <div><div className="hud-label mb-0.5">المنطقة</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.country.subregion || regionDossier.country.region}</div></div>
                    <div><div className="hud-label mb-0.5">اللغات</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.country.languages?.join(', ')}</div></div>
                    <div><div className="hud-label mb-0.5">المساحة</div><div className="text-xs text-[var(--text-primary)]">{regionDossier.country.area?.toLocaleString()} km²</div></div>
                  </div>
                )}
                {regionDossier.head_of_state && (<div><div className="hud-label mb-0.5">رئيس الدولة</div><div className="text-xs text-[var(--gold-primary)]">{regionDossier.head_of_state.name}</div><div className="text-[9px] text-[var(--text-muted)]">{regionDossier.head_of_state.position}</div></div>)}
                {regionDossier.wikipedia && (<div><div className="hud-label mb-1">موجز المنطقة</div><div className="flex gap-3">{regionDossier.wikipedia.thumbnail && <img src={regionDossier.wikipedia.thumbnail} alt="" className="w-14 h-14 rounded object-cover flex-shrink-0" />}<p className="text-[9px] text-[var(--text-secondary)] leading-relaxed">{regionDossier.wikipedia.extract}</p></div></div>)}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Camera Viewer ── */}
      <CameraViewer
        camera={embedMode ? null : activeCamera}
        onClose={() => setActiveCamera(null)}
        onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })}
      />

      {/* ── Entity Graph Panel ── */}
      {/* Guidance belongs over the map, where the clicking happens. */}
      {!embedMode && drawMode && (
        <DrawHud
          mode={drawMode}
          progress={drawProgress}
          onUndo={() => sendDraw('undo')}
          onFinish={() => sendDraw('finish')}
          onCancel={() => { sendDraw('cancel'); setDrawMode(null); setDrawProgress(null); }}
        />
      )}

      {!embedMode && showDrawing && (
        <div className="absolute right-12 top-1/2 -translate-y-1/2 z-[400] w-80 pointer-events-auto">
          <DrawingToolbar
            drawMode={drawMode}
            onSetDrawMode={setDrawMode}
            progress={drawProgress}
            polygons={drawnPolygons}
            onDeletePolygon={(id) => setDrawnPolygons(p => p.filter(x => x.id !== id))}
            onClearAll={() => { setDrawnPolygons([]); setSelectedPolygon(null); }}
            onExportGeoJSON={handleExportGeoJSON}
            selectedPolygon={selectedPolygon}
            onSelectPolygon={setSelectedPolygon}
            onRenamePolygon={(id, name) => setDrawnPolygons(p => p.map(x => x.id === id ? { ...x, name } : x))}
            data={data}
            onLocateEntity={(lat, lng) => setFlyToLocation({ lat, lng, zoom: 12, ts: Date.now() })}
            watched={watched}
            onToggleWatch={toggleWatch}
            watchEvents={watchEvents}
          />
        </div>
      )}

      {/* ── OVERLAYS ── */}
      {!embedMode && <div className="vignette absolute inset-0 pointer-events-none z-[2]" />}
      {!embedMode && <div className="crt-scanlines absolute inset-0 pointer-events-none z-[3] opacity-[0.02]" />}
      {/* Corner frames — using explicit classes for Tailwind JIT compatibility */}
      {!embedMode && [
        { pos: 'top-0 left-0', vAnchor: 'top-0', hAnchor: 'left-0', hGrad: 'bg-gradient-to-r', vGrad: 'bg-gradient-to-b' },
        { pos: 'top-0 right-0', vAnchor: 'top-0', hAnchor: 'right-0', hGrad: 'bg-gradient-to-l', vGrad: 'bg-gradient-to-b' },
        { pos: 'bottom-0 left-0', vAnchor: 'bottom-0', hAnchor: 'left-0', hGrad: 'bg-gradient-to-r', vGrad: 'bg-gradient-to-t' },
        { pos: 'bottom-0 right-0', vAnchor: 'bottom-0', hAnchor: 'right-0', hGrad: 'bg-gradient-to-l', vGrad: 'bg-gradient-to-t' },
      ].map((c, i) => (
        <div key={i} className={`absolute ${c.pos} w-16 h-16 pointer-events-none z-[1]`}>
          <div className={`absolute ${c.vAnchor} ${c.hAnchor} w-full h-[1px] ${c.hGrad} from-[var(--gold-primary)]/30 to-transparent`} />
          <div className={`absolute ${c.vAnchor} ${c.hAnchor} w-[1px] h-full ${c.vGrad} from-[var(--gold-primary)]/30 to-transparent`} />
        </div>
      ))}

      {/* Keyboard Shortcuts Overlay */}
      {!embedMode && <KeyboardShortcuts />}

      {/* ── GLOBAL STATUS TICKER (bottom) ── */}
      {!embedMode && <GlobalStatusBar news={Array.isArray(data.news) ? data.news : []} />}

      {/* Shortcut hint — more visible */}
      {!embedMode && <div className="desktop-only absolute bottom-[26px] right-5 z-[200] pointer-events-none text-[10px] font-mono text-[var(--text-secondary)] opacity-80 tracking-widest" title="اضغط ? لعرض كل اختصارات لوحة المفاتيح">
        اضغط <span className="text-[var(--gold-primary)]">؟</span> للاختصارات · <span className="text-[var(--gold-primary)]">F</span> ملء الشاشة · <span className="text-[var(--gold-primary)]">R</span> إعادة الضبط
      </div>}


    </main>
  );
}
