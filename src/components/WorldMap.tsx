'use client';

import { buildGeometry, closeRing, drawReducer, initialDrawState, measure, type DrawAction, type DrawMode, type DrawProgress, type DrawResult, type DrawState } from '@/lib/draw';
import { useEffect, useRef, useState, useCallback, memo } from 'react';
import * as maplibregl from 'maplibre-gl';
import { installTerrainTileProtocol } from '@/lib/terrain-tiles';
import { createSatelliteLayer, parseColor, type SatPoint } from '@/lib/satellite-layer';
import { MAP_DEFAULTS, MAP_PALETTE_KEYS, readMapPalette, satColorFor, type MapPalette } from '@/lib/map-palette';
import { STYLE_EVENT } from '@/lib/style-tokens';
import { arrivalBeacons } from '@/lib/malware-intel';
import SatelliteCard, { type SatelliteDetail } from '@/components/SatelliteCard';
import CctvPreviews, { type PreviewCamera } from '@/components/CctvPreviews';
import MapControls from '@/components/MapControls';
import LiveNewsPreviews, { type PreviewFeed } from '@/components/LiveNewsPreviews';
import { attachTerrain, type TerrainStatus } from '@/lib/map-terrain';

import { applyMapProjection } from '@/lib/map-projection';
import { buildAntimeridianSafeLine } from '@/lib/publicRouteGeometry';

/** The catalogue fields the satellite layer and its popup actually read. */
interface SatelliteRow {
  name: string;
  lat: number;
  lng: number;
  alt: number;
  color?: string;
  mission?: string;
  category?: string;
  noradId?: string;
}
import 'maplibre-gl/dist/maplibre-gl.css';

interface WorldMapProps {
  data: any;
  activeLayers: Record<string, boolean>;
  onEntityClick?: (entity: any) => void;
  onReady?: () => void;
  onMouseCoords?: (coords: { lat: number; lng: number }) => void;
  onRightClick?: (coords: { lat: number; lng: number }) => void;
  onViewStateChange?: (vs: { zoom: number; latitude: number }) => void;
  flyToLocation?: { lat: number; lng: number; zoom?: number; ts: number } | null;
  projection?: 'mercator' | 'globe';
  terrainEnabled?: boolean;
  terrainRetry?: number;
  terrainFocus?: number;
  onTerrainStatusChange?: (status: TerrainStatus) => void;

  mapStyle?: string;
  sweepData?: any;
  scanTargets?: any[];
  demoMode?: boolean;
  theme?: 'core' | 'ghost';
  drawnPolygons?: Array<{ id: string; name: string; geojson: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.LineString>; color: string }>;
  arcgisLayers?: Array<{ id: string; title: string; geojson: any; color?: string; opacity?: number }>;
  /** Active draw mode, or null when not drawing. */
  drawMode?: DrawMode | null;
  onDrawProgress?: (p: DrawProgress | null) => void;
  onDrawCancel?: () => void;
  /**
   * Undo / finish / cancel driven from a button rather than the keyboard.
   * Carries a seq so pressing the same button twice still registers.
   */
  drawCommand?: { action: DrawAction["type"]; seq: number } | null;
  onDrawComplete?: (result: DrawResult) => void;
  onMapCenter?: (coords: { lat: number; lng: number; bounds?: { west: number; south: number; east: number; north: number } }) => void;
  /** Active turn-by-turn route drawn as a line with origin/destination pins. */
  route?: {
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
    /** Unselected alternatives, drawn dimmed behind the active line. */
    alternates?: Array<{ type: 'LineString'; coordinates: [number, number][] }>;
    /** Highlighted portion for the step the operator has selected. */
    activeSegment?: [number, number][] | null;
  } | null;
  /** Live position from the browser — drawn as a pulsing dot with accuracy ring. */
  userLocation?: { lat: number; lng: number; accuracy?: number; heading?: number | null } | null;
  /** Keep the camera centred on userLocation as it moves. */
  followUser?: boolean;
  /** Fired when the operator pans/zooms/rotates while follow mode is on. */
  onFollowInterrupt?: () => void;
  /** Live navigation: tighter zoom and the map turned to face travel direction. */
  navigating?: boolean;
  /** Corroborated endpoint airports for watched aircraft, keyed by icao24. */
  aircraftAirports?: Record<string, Array<{ icao: string; iata?: string; city?: string; lat: number; lng: number }>>;
}

function computeSolarTerminator(): [number, number][] {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
  const decRad = declination * Math.PI / 180;
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const subsolarLng = (12 - utcHours) * 15;
  const points: [number, number][] = [];
  for (let lng = -180; lng <= 180; lng += 2) {
    const lngRad = (lng - subsolarLng) * Math.PI / 180;
    const lat = Math.atan(-Math.cos(lngRad) / Math.tan(decRad)) * 180 / Math.PI;
    points.push([lng, lat]);
  }
  const darkSide = declination >= 0 ? -90 : 90;
  points.push([180, darkSide]);
  points.push([-180, darkSide]);
  points.push(points[0]);
  return points;
}

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

function WorldMap({ data, activeLayers, onEntityClick, onReady, onMouseCoords, onRightClick, onViewStateChange, flyToLocation, projection = 'globe', terrainEnabled = false, terrainRetry = 0, terrainFocus = 0, onTerrainStatusChange, mapStyle = 'dark', sweepData, scanTargets = [], demoMode = false, theme = 'core', drawnPolygons = [], arcgisLayers = [], drawMode = null, onDrawComplete, onDrawProgress, onDrawCancel, drawCommand = null, onMapCenter, route = null, userLocation = null, followUser = false, onFollowInterrupt, navigating = false, aircraftAirports = {} }: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (mapReady) onReady?.();
  }, [mapReady, onReady]);

  // Do not replay an earlier explicit zoom request after theme/retry remounts.
  const lastTerrainFocus = useRef(terrainFocus);
  const wasNavigating = useRef(false);
  /**
   * What the map's own layers draw with, mirrored out of the `--map-*` custom
   * properties. Held in state rather than read at each use so a change re-runs
   * the recolour effects; held in a ref as well for the click handlers, which
   * are registered once on load and would otherwise close over the first value.
   */
  const [palette, setPalette] = useState<MapPalette>(MAP_DEFAULTS);
  const paletteRef = useRef(palette);
  useEffect(() => { paletteRef.current = palette; }, [palette]);
  const prevDrawnPolygonsRef = useRef<string[]>([]);
  const prevArcgisLayersRef = useRef<string[]>([]);
  const satLayerRef = useRef<ReturnType<typeof createSatelliteLayer> | null>(null);
  // pick() returns an index into the array last handed to setPoints, so the
  // matching catalogue rows are kept in the same order to resolve it.
  const satRowsRef = useRef<SatelliteRow[]>([]);
  /** Index of the selected satellite in the array last handed to setPoints. */
  const satPickedRef = useRef<number | null>(null);
  /** The selection's NORAD id. The index moves whenever the catalogue is
   *  re-polled and re-filtered; the id does not, so it is what identifies the
   *  selection across a refresh and what discards a late orbit reply. */
  const satSelectedIdRef = useRef<string | null>(null);
  /** When the catalogue positions were propagated for, so an orbit can be drawn
   *  around the marker rather than around the moment it was clicked. */
  const satEpochRef = useRef<number | null>(null);
  const [selectedSat, setSelectedSat] = useState<SatelliteDetail | null>(null);

  /** Drops the selection: the ring, the orbit track and the readout together.
   *  Leaving any one of them behind is what made a closed popup look like a
   *  still-selected satellite. */
  const clearSat = useCallback(() => {
    if (satPickedRef.current === null && satSelectedIdRef.current === null) return;
    satPickedRef.current = null;
    satSelectedIdRef.current = null;
    satLayerRef.current?.setSelected(null);
    satLayerRef.current?.setOrbit(null);
    setSelectedSat(null);
  }, []);
  const drawingCoordsRef = useRef<number[][]>([]);

  // Create aircraft icon on canvas (for WebGL symbol layer)
  const createIcon = useCallback((map: maplibregl.Map, id: string, color: string, size: number) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2, cy = size / 2;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = Math.max(1, size * 0.055);
    ctx.shadowColor = 'rgba(0,0,0,0.72)';
    ctx.shadowBlur = Math.max(2, size * 0.14);
    ctx.shadowOffsetY = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.4);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
    ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
    ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
    ctx.lineTo(cx, cy + size * 0.35);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  const createDot = useCallback((map: maplibregl.Map, id: string, color: string, size: number) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = Math.max(1, size * 0.055);
    ctx.shadowColor = 'rgba(0,0,0,0.72)';
    ctx.shadowBlur = Math.max(2, size * 0.14);
    ctx.shadowOffsetY = 1;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI * 2);
    ctx.fill();
    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // ── DEMO MODE SPINNING ──
    let spinReq: number | undefined = undefined;
    let isSpinning = false;

    const startSpinning = () => {
      if (!map) return;
      isSpinning = true;
      let lastTime = performance.now();

      const frame = (time: number) => {
        if (!isSpinning) return;

        // Only spin if the user is not actively dragging or zooming the map
        if (!map.isMoving() && !map.isZooming()) {
          const dt = time - lastTime;
          const center = map.getCenter();
          // Adjust spin speed: 0.5 degrees per second
          center.lng += (0.5 * dt) / 1000;
          map.setCenter(center);
        }

        lastTime = time;
        spinReq = requestAnimationFrame(frame);
      };

      spinReq = requestAnimationFrame(frame);
    };

    if (demoMode) {
      startSpinning();
    } else {
      isSpinning = false;
      if (spinReq) cancelAnimationFrame(spinReq);
    }

    return () => {
      isSpinning = false;
      if (spinReq) cancelAnimationFrame(spinReq);
      if (typeof window !== 'undefined' && (window as any)._globeSpinTimer) {
        clearInterval((window as any)._globeSpinTimer);
      }
    };
  }, [mapReady, demoMode]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Select basemap style
    const styleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

    const container = containerRef.current;
    maplibregl.setWorkerUrl(`/vendor/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);
    const baseOptions = {
      container,
      style: styleUrl,
      center: [25.48, 42.70] as [number, number], zoom: 6.5, minZoom: 1.5, maxZoom: 18,
      attributionControl: false as const,
      maxPitch: 85,
      transformRequest: (url: string) => {
        // Route all CARTO CDN requests through the internal Next.js proxy API
        if (url.includes('cartocdn.com')) {
          const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
          return { url: `${baseUrl}/api/proxy-tiles?url=${encodeURIComponent(url)}` };
        }
        return { url };
      },
    };

    // MapLibre asks for a high-performance WebGL2 context and throws outright if it
    // cannot get one. Some machines refuse that exact request while still granting a
    // plainer one, so walk down to weaker requests before giving up. The WebGL1 rung
    // this used to have cannot come back: MapLibre 6's ContextType is 'webgl2' alone,
    // so machines that only ever managed WebGL1 are now out of reach either way.
    // Dropping antialias is the last rung left for a struggling GPU.
    const attributeFallbacks: maplibregl.MapOptions['canvasContextAttributes'][] = [
      undefined,
      { powerPreference: 'low-power', failIfMajorPerformanceCaveat: false },
      { powerPreference: 'low-power', failIfMajorPerformanceCaveat: false, antialias: false },
    ];

    let map: maplibregl.Map | undefined;
    for (const canvasContextAttributes of attributeFallbacks) {
      try {
        map = new maplibregl.Map(
          canvasContextAttributes ? { ...baseOptions, canvasContextAttributes } : baseOptions
        );
        break;
      } catch (e) {
        // A failed constructor leaves its canvas behind; the next attempt needs a clean container.
        container.innerHTML = '';
        if (canvasContextAttributes === attributeFallbacks[attributeFallbacks.length - 1]) throw e;
        console.warn('[M3TM.WORLD] WebGL context rejected, retrying with weaker attributes:', e instanceof Error ? e.message : e);
      }
    }
    if (!map) return;

    map.on('load', () => {
      mapRef.current = map;

      // Theme colors
      const isGhost = theme === 'ghost';
      const phantomPurple = '#B388FF';
      const phantomDark = '#1A0040';
      /* The first paint reads the same `--map-*` properties the recolour
         effects below push in later. Deriving them from `theme` here as well
         is what let the two drift: the effect's ghost palette was four
         distinct violets, this block's was one, and whichever ran last won. */
      const bootStyle = getComputedStyle(document.body);
      const boot = readMapPalette(name => bootStyle.getPropertyValue(name));
      const cameraColor = boot.cctv;
      const flightCom = boot.flightCivil;
      const flightPriv = boot.flightPrivate;
      const flightGov = boot.flightGov;
      const flightMil = boot.flightMilitary;

      // Create icons — M3TM.WORLD Unified Palette
      createIcon(map, 'plane-cyan', flightCom, 24);
      createIcon(map, 'plane-green', flightPriv, 24);
      createIcon(map, 'plane-pink', flightGov, 24);
      createIcon(map, 'plane-red', flightMil, 24);
      createIcon(map, 'plane-grey', boot.flightUnknown, 24);
      createDot(map, 'dot-gold', isGhost ? phantomPurple : '#D4AF37', 8);
      createDot(map, 'dot-red', isGhost ? phantomPurple : '#D32F2F', 10);
      createDot(map, 'dot-orange', isGhost ? phantomPurple : '#E65100', 10);
      createDot(map, 'dot-green', isGhost ? phantomPurple : '#26A69A', 10);
      createDot(map, 'dot-fire', isGhost ? phantomPurple : '#E65100', 10);
      createDot(map, 'dot-cctv', cameraColor, 10);

      const sources = ['flights','military','military-activity','jets','private-fl','selected-flight-track','satellites','earthquakes','gdelt','day-night','cctv','fires','weather','infrastructure','maritime','maritime-choke','maritime-ships','live-news','reported-routes','frontlines','conflict-zones', 'balloons', 'radiation', 'ip-sweep-devices', 'ip-sweep-pulse', 'ip-sweep-connections', 'scan-targets', 'sdk-entities', 'sdk-links', 'malware-nodes', 'malware-new', 'network-mesh', 'cyber-arcs', 'cyber-heads', 'cyber-impacts', 'gdelt-events', 'cf-outages', 'cf-attacks'];
      sources.forEach(s => map.addSource(s, { type: 'geojson', data: EMPTY_FC }));

      // ── FLIGHT ROUTE VISUALIZATION SOURCES & LAYERS ──

      // Warning icon generator (parameterized — eliminates 3x copy-paste)
      const createWarningIcon = (id: string, color: string) => {
        const s = 20;
        const c = document.createElement('canvas');
        c.width = s; c.height = s;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(s/2, 1);
        ctx.lineTo(s - 1, s - 1);
        ctx.lineTo(1, s - 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', s/2, s - 4);
        map.addImage(id, { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) });
      };
      createWarningIcon('warn-icon', '#D32F2F');
      createWarningIcon('warn-orange', '#E65100');
      createWarningIcon('warn-yellow', '#F9A825');

      map.addLayer({ id: 'conflict-zone-halo', type: 'circle', source: 'conflict-zones', filter: ['==',['get','kind'],'zone'], paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,18, 4,28, 8,46],
        'circle-color': ['match', ['get','severity'], 'war','#D32F2F', 'high','#E65100', '#F9A825'],
        'circle-opacity': 0.12, 'circle-blur': 0.8,
      }});
      map.addLayer({ id: 'conflict-event-dots', type: 'circle', source: 'conflict-zones', filter: ['==',['get','kind'],'event'], paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2.5, 5,4.5, 9,7],
        'circle-color': '#FF5252', 'circle-opacity': 0.82,
        'circle-stroke-width': 1, 'circle-stroke-color': '#FFD7D7', 'circle-stroke-opacity': 0.55,
      }});
      map.addLayer({ id: 'conflict-icons', type: 'symbol', source: 'conflict-zones', filter: ['==',['get','kind'],'zone'], layout: {
        'icon-image': ['match', ['get','severity'], 'war','warn-icon', 'high','warn-orange', 'warn-yellow'],
        'icon-size': ['interpolate',['linear'],['zoom'], 1,0.6, 4,0.8, 8,1],
        'icon-allow-overlap': true,
        'text-field': ['get','label'],
        'text-size': ['interpolate',['linear'],['zoom'], 1,7, 4,9, 8,11],
        'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.4],
        'text-allow-overlap': false,
      }, paint: {
        'text-color': ['match', ['get','severity'], 'war','#D32F2F', 'high','#E65100', '#F9A825'],
        'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9,
      }});

      map.addLayer({ id: 'military-activity-halo', type: 'circle', source: 'military-activity', paint: {
        'circle-radius': ['interpolate',['linear'],['get','level'], 1,18, 2,28, 3,42],
        'circle-color': '#EF5350', 'circle-opacity': 0.12, 'circle-blur': 0.85,
      }});
      map.addLayer({ id: 'military-activity-dots', type: 'circle', source: 'military-activity', paint: {
        'circle-radius': ['interpolate',['linear'],['get','level'], 1,5, 2,7, 3,9],
        'circle-color': ['interpolate',['linear'],['get','level'], 1,'#FFB74D', 2,'#FF7043', 3,'#EF5350'],
        'circle-opacity': 0.9, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFF3E0', 'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'military-activity-label', type: 'symbol', source: 'military-activity', minzoom: 3, layout: {
        'text-field': ['concat','نشاط عسكري · ',['get','activity'],' · ',['get','approximate_count']],
        'text-size': 9, 'text-font': ['Open Sans Bold'], 'text-offset': [0,1.5], 'text-allow-overlap': false,
      }, paint: { 'text-color':'#FFCCBC', 'text-halo-color':'#000', 'text-halo-width':1.5 }});

      map.addLayer({ id: 'reported-routes-halo', type: 'line', source: 'reported-routes', layout: { 'line-cap':'round', 'line-join':'round' }, paint: {
        'line-color':'#D4AF37', 'line-width':5, 'line-opacity':0.12, 'line-blur':2,
      }});
      map.addLayer({ id: 'reported-routes-core', type: 'line', source: 'reported-routes', layout: { 'line-cap':'round', 'line-join':'round' }, paint: {
        'line-color':'#FFD166', 'line-width':1.5, 'line-opacity':0.68, 'line-dasharray':[2,3],
      }});

      map.addLayer({ id: 'frontlines-fill', type: 'fill', source: 'frontlines', paint: {
        'fill-color':'#E0A63A', 'fill-opacity':0.035,
      }});
      map.addLayer({ id: 'frontlines-line', type: 'line', source: 'frontlines', layout: { 'line-cap':'round', 'line-join':'round' }, paint: {
        'line-color':'#FFD166',
        'line-width':['interpolate',['linear'],['zoom'], 2,0.8, 6,1.5, 10,2.2],
        'line-opacity':0.72,
        'line-dasharray':[3,2],
      }});


      // Day/Night
      map.addLayer({ id: 'day-night-fill', type: 'fill', source: 'day-night', paint: { 'fill-color': isGhost ? '#0D0030' : '#000022', 'fill-opacity': 0.35 }});

      // Earthquakes — amber threat spectrum
      map.addLayer({ id: 'eq-circles', type: 'circle', source: 'earthquakes', paint: {
        'circle-radius': ['interpolate',['linear'],['get','magnitude'], 2.5,4, 5,12, 7,24],
        'circle-color': ['interpolate',['linear'],['get','magnitude'], 2.5,'#F9A825', 4,'#E65100', 6,'#D32F2F'],
        'circle-opacity': 0.55, 'circle-blur': 0.3, 'circle-stroke-width': 1, 'circle-stroke-color': '#F9A825', 'circle-stroke-opacity': 0.25,
      }});
      map.addLayer({ id: 'eq-label', type: 'symbol', source: 'earthquakes', filter: ['>=',['get','magnitude'],4.5], layout: {
        'text-field': ['concat','M',['to-string',['get','magnitude']]], 'text-size': 9, 'text-font': ['Open Sans Regular'], 'text-offset': [0,1.5],
      }, paint: { 'text-color': '#F9A825', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Fires — burnt sienna
      map.addLayer({ id: 'fires-heat', type: 'circle', source: 'fires', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,8],
        'circle-color': '#E65100', 'circle-opacity': 0.45, 'circle-blur': 0.5,
      }});

      // CCTV — outer glow ring (black/white depending on theme)
      map.addLayer({ id: 'cctv-glow', type: 'circle', source: 'cctv', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,14, 14,20],
        'circle-color': '#000000', 'circle-opacity': 0.35, 'circle-blur': 1,
      }});
      // CCTV — main dot
      map.addLayer({ id: 'cctv-dots', type: 'circle', source: 'cctv', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8, 14,12],
        'circle-color': cameraColor, 'circle-opacity': 0.9,
        'circle-stroke-width': 2.5, 'circle-stroke-color': '#000000', 'circle-stroke-opacity': 0.9,
      }});
      // CCTV — labels at zoom 10+
      map.addLayer({ id: 'cctv-label', type: 'symbol', source: 'cctv', minzoom: 10, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': cameraColor, 'text-halo-color': '#000000', 'text-halo-width': 1.5, 'text-opacity': 0.8 }});

      // GDELT



      // ══ NETWORK INTEL — Live Malware (abuse.ch) — crimson threat ══
      map.addLayer({ id: 'malware-glow', type: 'circle', source: 'malware-nodes', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,12, 10,20],
        'circle-color': '#D32F2F', 'circle-opacity': 0.06, 'circle-blur': 0.5,
      }});
      /* Sized by how many live malicious URLs the host serves. A box running
         forty payloads and one running a single sample were the same dot
         before, and they are not the same thing. */
      map.addLayer({ id: 'malware-dots', type: 'circle', source: 'malware-nodes', paint: {
        /* A zoom expression has to be the top-level input to the interpolate,
           so the activity scaling lives in the output stops rather than
           multiplying two curves together. sqrt keeps a host serving 80 URLs
           from dwarfing the map — it reads about three times the single-URL
           dot, not eighty. */
        'circle-radius': ['interpolate',['linear'],['zoom'],
          1,  ['interpolate',['linear'],['sqrt',['max',['get','url_count'],1]], 1,1.6, 3,2.4, 9,4],
          5,  ['interpolate',['linear'],['sqrt',['max',['get','url_count'],1]], 1,3.2, 3,4.8, 9,8],
          10, ['interpolate',['linear'],['sqrt',['max',['get','url_count'],1]], 1,4.8, 3,7.2, 9,12],
        ],
        'circle-color': '#D32F2F',
        'circle-opacity': 0.9,
        'circle-stroke-width': 1, 'circle-stroke-color': '#000000', 'circle-stroke-opacity': 0.8,
      }});
      /* Arrival beacon — expands and fades over the minute after a detection
         is pushed, then the feature drops out of the source entirely. */
      map.addLayer({ id: 'malware-new-ring', type: 'circle', source: 'malware-new', paint: {
        'circle-radius': 8,
        'circle-color': 'transparent',
        'circle-stroke-color': '#FF1744',
        'circle-stroke-width': 2,
        'circle-stroke-opacity': ['interpolate',['linear'],['get','age'], 0,0.9, 1,0],
      }});
      map.addLayer({ id: 'malware-label', type: 'symbol', source: 'malware-nodes', minzoom: 5, layout: {
        'text-field': ['get','malware'], 'text-size': 8, 'text-font': ['JetBrains Mono Bold', 'Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 10, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#D32F2F', 'text-halo-color': '#111', 'text-halo-width': 1.5, 'text-opacity': 0.85 }});

      // ── NETWORK INTEL MESH (SDK STYLE) ──
      map.addLayer({ id: 'network-mesh-atmo', type: 'line', source: 'network-mesh', paint: {

        'line-width': ['interpolate',['linear'],['zoom'], 1, 2, 5, 4, 10, 8],
        'line-opacity': 0.08,
        'line-blur': 4,
      }});
      map.addLayer({ id: 'network-mesh-glow', type: 'line', source: 'network-mesh', paint: {

        'line-width': ['interpolate',['linear'],['zoom'], 1, 1, 5, 2, 10, 4],
        'line-opacity': 0.2,
        'line-blur': 1.5,
      }});
      map.addLayer({ id: 'network-mesh-core', type: 'line', source: 'network-mesh', paint: {

        'line-width': ['interpolate',['linear'],['zoom'], 1, 0.2, 5, 0.5, 10, 1.5],
        'line-opacity': 0.4,
      }});

      // ══ LIVE CYBER ATTACKS — dark wire network (source → target) ══
      map.addLayer({ id: 'cyber-arcs-atmo', type: 'line', source: 'cyber-arcs', paint: {
        'line-color': '#000000', 'line-width': ['interpolate',['linear'],['zoom'], 1,4, 5,7, 10,12],
        'line-opacity': 0.12, 'line-blur': 6,
      }});
      map.addLayer({ id: 'cyber-arcs-glow', type: 'line', source: 'cyber-arcs', paint: {
        'line-color': '#111111', 'line-width': ['interpolate',['linear'],['zoom'], 1,2, 5,3.5, 10,6],
        'line-opacity': 0.3, 'line-blur': 2,
      }});
      map.addLayer({ id: 'cyber-arcs-core', type: 'line', source: 'cyber-arcs', paint: {
        'line-color': '#000000', 'line-width': ['interpolate',['linear'],['zoom'], 1,0.8, 5,1.4, 10,2.2],
        'line-opacity': 0.7,
      }});
      // Animated dashed flow line — fast marching ants in black
      map.addLayer({ id: 'cyber-arcs-flow', type: 'line', source: 'cyber-arcs', paint: {
        'line-color': '#1a1a1a', 'line-width': ['interpolate',['linear'],['zoom'], 1,1.0, 5,1.8, 10,3],
        'line-opacity': 0.55, 'line-dasharray': [2, 3],
      }});
      map.addLayer({ id: 'cyber-impacts', type: 'circle', source: 'cyber-impacts', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,12, 10,18],
        'circle-color': '#000000', 'circle-opacity': 0.08, 'circle-blur': 0.6,
      }});
      map.addLayer({ id: 'cyber-heads', type: 'circle', source: 'cyber-heads', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2.5, 5,4, 10,6],
        'circle-color': '#111111', 'circle-opacity': 0.95,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#333', 'circle-stroke-opacity': 0.9,
      }});
      map.addLayer({ id: 'cyber-labels', type: 'symbol', source: 'cyber-heads', minzoom: 3, layout: {
        'text-field': ['get','malware'], 'text-size': 9, 'text-font': ['JetBrains Mono Bold', 'Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-max-width': 10, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#333333', 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.85 }});

      map.addLayer({ id: 'gdelt-dots', type: 'circle', source: 'gdelt', paint: {
        'circle-radius': 4, 'circle-color': '#D32F2F', 'circle-opacity': 0.5, 'circle-stroke-width': 1, 'circle-stroke-color': '#D32F2F', 'circle-stroke-opacity': 0.25,
      }});

      /* ── GDELT 2.0 Events — coloured by CAMEO QuadClass so cooperation and
         conflict are separable at a glance, sized by article volume. ── */
      map.addLayer({ id: 'gdelt-events-dots', type: 'circle', source: 'gdelt-events', paint: {
        'circle-radius': ['interpolate',['linear'],['get','articles'], 1,3, 10,5, 50,8, 200,12],
        'circle-color': ['match',['get','event_category'],
          'aerial_attack','#FF1744',
          'heavy_weapons','#FF6D00',
          'bombing','#FF3D3D',
          'armed_clash','#F4511E',
          'mass_violence','#C62828',
          'assault','#E53935',
          'material_conflict','#FF5252',
          '#9B978E'],
        'circle-opacity': 0.75,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#000000',
        'circle-stroke-opacity': 0.6,
      }});

      /* ── Cloudflare Radar — internet outages (country-scoped) ── */
      map.addLayer({ id: 'cf-outage-halo', type: 'circle', source: 'cf-outages', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,14, 5,26, 10,40],
        'circle-color': '#FFB300', 'circle-opacity': 0.12, 'circle-blur': 0.9,
      }});
      map.addLayer({ id: 'cf-outage-dots', type: 'circle', source: 'cf-outages', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,9],
        // Resolved outages read cooler than ongoing ones.
        'circle-color': ['case',['get','ongoing'],'#FFB300','#8B7325'],
        'circle-opacity': 0.9,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#000000', 'circle-stroke-opacity': 0.7,
      }});
      map.addLayer({ id: 'cf-outage-label', type: 'symbol', source: 'cf-outages', minzoom: 3, layout: {
        'text-field': ['get','country_name'], 'text-size': 9, 'text-font': ['JetBrains Mono Bold', 'Open Sans Bold'],
        'text-offset': [0, 1.4], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FFB300', 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.85 }});

      /* ── Cloudflare Radar — layer-3 attack origin share ── */
      map.addLayer({ id: 'cf-attack-dots', type: 'circle', source: 'cf-attacks', paint: {
        'circle-radius': ['interpolate',['linear'],['get','share'], 0,4, 5,9, 20,16, 50,24],
        'circle-color': '#FF3D3D', 'circle-opacity': 0.35, 'circle-blur': 0.3,
        'circle-stroke-width': 1, 'circle-stroke-color': '#FF3D3D', 'circle-stroke-opacity': 0.7,
      }});
      map.addLayer({ id: 'cf-attack-label', type: 'symbol', source: 'cf-attacks', minzoom: 2, layout: {
        'text-field': ['concat',['get','country'],' ',['to-string',['get','share']],'%'],
        'text-size': 9, 'text-font': ['JetBrains Mono Bold', 'Open Sans Bold'],
        'text-offset': [0, 1.6], 'text-allow-overlap': false,
      }, paint: { 'text-color': '#FF6B6B', 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9 }});

      // Weather Events (NASA EONET) — deep violet
      map.addLayer({ id: 'weather-glow', type: 'circle', source: 'weather', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 5,20, 10,30],
        'circle-color': '#7E57C2', 'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'weather-dots', type: 'circle', source: 'weather', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,14],
        'circle-color': ['match', ['get','icon'], 'cyclone','#7E57C2', 'volcano','#D32F2F', '#7E57C2'],
        'circle-opacity': 0.75,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#7E57C2', 'circle-stroke-opacity': 0.35,
      }});
      map.addLayer({ id: 'weather-label', type: 'symbol', source: 'weather', layout: {
        'text-field': ['get','title'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#7E57C2', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

      // Nuclear Infrastructure — teal / amber risk
      map.addLayer({ id: 'infra-glow', type: 'circle', source: 'infrastructure', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,22],
        'circle-color': ['case', ['in', 'SEISMIC RISK', ['get', 'status']], '#E65100', '#26A69A'],
        'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'infra-dots', type: 'circle', source: 'infrastructure', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,10],
        'circle-color': ['case',
          ['in', 'SEISMIC RISK', ['get', 'status']], '#E65100',
          ['==', ['get','status'], 'Active Conflict Zone'], '#D32F2F',
          ['in', 'Decommission', ['get', 'status']], '#546E7A',
          ['==', ['get','status'], 'Under Construction'], '#FFA726',
          '#26A69A'
        ],
        'circle-opacity': 0.75,
        'circle-stroke-width': 1.5, 'circle-stroke-color': ['case', ['in', 'SEISMIC RISK', ['get', 'status']], '#E65100', '#26A69A'], 'circle-stroke-opacity': 0.35,
      }});
      map.addLayer({ id: 'infra-label', type: 'symbol', source: 'infrastructure', minzoom: 5, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': ['case', ['in', 'SEISMIC RISK', ['get', 'status']], '#E65100', '#26A69A'], 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

      // Satellites.
      // Every satellite is drawn once, by the custom 3D layer below, at its
      // altitude. These two circle layers are kept defined — the source feeds
      // the 3D layer and other code refers to them — but hidden: drawing the
      // same satellite both flat on the ground and again up at altitude is
      // what made the map read as half 2D and half 3D.
      // Hit-testing is handled by the 3D layer's own GPU pick pass, since
      // queryRenderedFeatures cannot see into a custom WebGL layer.
      map.addLayer({ id: 'sat-glow', type: 'circle', source: 'satellites', layout: { visibility: 'none' }, paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,6], 'circle-color': ['get','color'], 'circle-opacity': 0.3, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'sat-dots', type: 'circle', source: 'satellites', layout: { visibility: 'none' }, paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,1.5, 5,3], 'circle-color': ['get','color'], 'circle-opacity': 1.0,
      }});
      // The spacecraft themselves, lifted to their orbit.
      if (!map.getLayer('sat-3d')) {
        satLayerRef.current = createSatelliteLayer('sat-3d');
        map.addLayer(satLayerRef.current as any);
      }

      // Maritime — ports & naval bases — ocean teal
      map.addLayer({ id: 'maritime-glow', type: 'circle', source: 'maritime', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,12, 10,20],
        'circle-color': ['match', ['get','type'], 'naval','#D32F2F', 'energy','#E65100', '#26C6DA'],
        'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'maritime-dots', type: 'circle', source: 'maritime', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,9],
        'circle-color': ['match', ['get','type'], 'naval','#D32F2F', 'energy','#E65100', '#26C6DA'],
        'circle-opacity': 0.8,
        'circle-stroke-width': 1.5, 'circle-stroke-color': ['match', ['get','type'], 'naval','#D32F2F', 'energy','#E65100', '#26C6DA'], 'circle-stroke-opacity': 0.35,
      }});
      map.addLayer({ id: 'maritime-label', type: 'symbol', source: 'maritime', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#26C6DA', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

      // Maritime chokepoints — amber threat spectrum
      map.addLayer({ id: 'choke-glow', type: 'circle', source: 'maritime-choke', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,18, 10,28],
        'circle-color': '#E65100', 'circle-opacity': 0.1, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'choke-dots', type: 'circle', source: 'maritime-choke', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,7, 10,12],
        'circle-color': ['match', ['get','risk'], 'CRITICAL','#D32F2F', 'HIGH','#E65100', 'ELEVATED','#F9A825', '#26A69A'],
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#E65100', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'choke-label', type: 'symbol', source: 'maritime-choke', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#E65100', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.9 }});

      // Live News — muted rose
      map.addLayer({ id: 'news-glow', type: 'circle', source: 'live-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,22],
        'circle-color': '#EC407A', 'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'news-dots', type: 'circle', source: 'live-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,10],
        'circle-color': '#EC407A', 'circle-opacity': 0.8,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#EC407A', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'news-label', type: 'symbol', source: 'live-news', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#EC407A', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

      // ══ IP SWEEP — Neighborhood device visualization ══
      map.addLayer({ id: 'sweep-connections', type: 'line', source: 'ip-sweep-connections', paint: {
        'line-color': ['get', 'color'], 'line-width': 1, 'line-opacity': 0.3, 'line-dasharray': [2, 4],
      }});
      map.addLayer({ id: 'sweep-pulse-ring', type: 'circle', source: 'ip-sweep-pulse', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 8,40, 12,80, 16,160],
        'circle-color': 'transparent', 'circle-opacity': 0.6,
        'circle-stroke-width': 2, 'circle-stroke-color': '#FF3D3D', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'sweep-device-glow', type: 'circle', source: 'ip-sweep-devices', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 8,8, 12,16, 16,30],
        'circle-color': ['get', 'color'], 'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'sweep-device-dots', type: 'circle', source: 'ip-sweep-devices', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 8,3, 12,6, 16,10],
        'circle-color': ['get', 'color'], 'circle-opacity': 0.95,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'sweep-device-labels', type: 'symbol', source: 'ip-sweep-devices', minzoom: 13, layout: {
        'text-field': ['concat', ['get', 'device_type'], '\n', ['get', 'ip']],
        'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2.2], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: {
        'text-color': ['get', 'color'], 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9,
      }});

      // ══ SCAN TARGETS — Geolocated individual scans ══
      map.addLayer({ id: 'scan-targets-glow', type: 'circle', source: 'scan-targets', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 5,25, 10,40],
        'circle-color': '#D32F2F', 'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'scan-targets-dots', type: 'circle', source: 'scan-targets', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,12],
        'circle-color': '#D32F2F', 'circle-opacity': 0.9,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#ECEFF1', 'circle-stroke-opacity': 0.7,
      }});
      map.addLayer({ id: 'scan-targets-label', type: 'symbol', source: 'scan-targets', layout: {
        'text-field': ['get', 'id'], 'text-size': 11, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#D32F2F', 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9 }});

      // Flight layers (WebGL symbol — GPU rendered, handles 50K+ smooth)
      const flightLayers = [
        { id: 'fl-commercial', src: 'flights', icon: 'plane-cyan', color: flightCom },
        { id: 'fl-private', src: 'private-fl', icon: 'plane-green', color: flightPriv },
        { id: 'fl-jets', src: 'jets', icon: 'plane-pink', color: flightGov },
        { id: 'fl-military', src: 'military', icon: 'plane-red', color: flightMil },
      ];
      flightLayers.forEach(l => {
        map.addLayer({ id: `${l.id}-halo`, type: 'circle', source: l.src, paint: {
          'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,8],
          'circle-color': l.color,
          'circle-opacity': 0.10,
          'circle-blur': 1,
        }});
        map.addLayer({ id: l.id, type: 'symbol', source: l.src, layout: {
          'icon-image': l.icon, 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.46, 5,0.76, 10,1.08],
          'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
        }, paint: { 'icon-opacity': 0.94 }});
      });

      map.addLayer({ id: 'selected-flight-track-halo', type: 'line', source: 'selected-flight-track', layout: {
        'line-cap':'round', 'line-join':'round',
      }, paint: {
        'line-color':'#7FE9FF', 'line-width':5, 'line-opacity':0.14, 'line-blur':2,
      }});
      map.addLayer({ id: 'selected-flight-track-line', type: 'line', source: 'selected-flight-track', layout: {
        'line-cap':'round', 'line-join':'round',
      }, paint: {
        'line-color':'#D7F8FF', 'line-width':2, 'line-opacity':0.9,
      }});

      // Route layers are added later (after setMapReady) so they render on top of everything.

      // Balloons (moving entities)
      map.addLayer({ id: 'balloon-dots', type: 'circle', source: 'balloons', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,7],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.8,
        'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'balloon-label', type: 'symbol', source: 'balloons', minzoom: 4, layout: {
        'text-field': ['get','callsign'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.2], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Radiation — violet base, threat spectrum for danger/warning
      map.addLayer({ id: 'rad-glow', type: 'circle', source: 'radiation', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,20, 10,40],
        'circle-color': ['match', ['get','status'], 'DANGER','#D32F2F', 'WARNING','#E65100', '#7E57C2'],
        'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'rad-dots', type: 'circle', source: 'radiation', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,8],
        'circle-color': ['match', ['get','status'], 'DANGER','#D32F2F', 'WARNING','#E65100', '#7E57C2'],
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5, 'circle-stroke-color': ['match', ['get','status'], 'DANGER','#D32F2F', 'WARNING','#E65100', '#7E57C2'], 'circle-stroke-opacity': 0.35,
      }});
      map.addLayer({ id: 'rad-label', type: 'symbol', source: 'radiation', minzoom: 5, layout: {
        'text-field': ['concat', ['to-string', ['get','reading']], ' nSv/h'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-allow-overlap': false,
      }, paint: { 'text-color': ['match', ['get','status'], 'DANGER','#D32F2F', 'WARNING','#E65100', '#7E57C2'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // ══ M3TM.WORLD SDK — Lattice Data Mesh ══
      // Polybolos Style: Delicate, translucent, steel-blue splined mesh

      // ── SEA domain (Distinct Solid Lines) ──
      // Removed glow to match the clean, diagrammatic look of submarinecablemap.com
      map.addLayer({ id: 'sdk-sea', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'SEA'], paint: {
        'line-color': ['coalesce', ['get', 'color'], '#1976D2'], // Single solid color from properties
        'line-width': ['interpolate',['linear'],['zoom'], 1, 0.8, 5, 1.5, 10, 2.5],
        'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.3, 5, 0.5, 10, 0.7],
      }});

      // ── AIR domain (Steel Gray / Cyan) ──
      map.addLayer({ id: 'sdk-air-atmo', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'AIR'], paint: {
        'line-color': '#4DD0E1',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 1.5, 5, 5, 10, 8],
        'line-opacity': 0.04,
        'line-blur': 3,
      }});
      map.addLayer({ id: 'sdk-air-glow', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'AIR'], paint: {
        'line-color': '#80DEEA',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 0.8, 5, 2, 10, 4],
        'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.08, 5, 0.12, 10, 0.18],
        'line-blur': 1,
      }});
      map.addLayer({ id: 'sdk-air', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'AIR'], paint: {
        'line-color': '#B2EBF2',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 0.15, 5, 0.6, 10, 1.2],
        'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.2, 5, 0.35, 10, 0.5],
      }});

      // ── INTEL domain (Deep Steel / Violet) ──
      map.addLayer({ id: 'sdk-intel-atmo', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'INTEL'], paint: {
        'line-color': '#7986CB',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 2.5, 5, 7, 10, 12],
        'line-opacity': 0.06,
        'line-blur': 5,
      }});
      map.addLayer({ id: 'sdk-intel-glow', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'INTEL'], paint: {
        'line-color': '#9FA8DA',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 1.2, 5, 3, 10, 6],
        'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.12, 5, 0.18, 10, 0.25],
        'line-blur': 2,
      }});
      map.addLayer({ id: 'sdk-intel', type: 'line', source: 'sdk-links', filter: ['==',['get','domain'],'INTEL'], paint: {
        'line-color': '#C5CAE9',
        'line-width': ['interpolate',['linear'],['zoom'], 1, 0.3, 5, 1, 10, 2],
        'line-opacity': ['interpolate',['linear'],['zoom'], 1, 0.3, 5, 0.45, 10, 0.7],
      }});

      // SDK entity nodes — real AIR / SEA / INTEL observations from sdk_entities.
      map.addLayer({ id: 'sdk-air-nodes', type: 'circle', source: 'sdk-entities', filter: ['==',['get','domain'],'AIR'], paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,5],
        'circle-color': '#B2EBF2', 'circle-opacity': 0.85,
        'circle-stroke-color': '#0A0D14', 'circle-stroke-width': 1,
      }});
      map.addLayer({ id: 'sdk-sea-nodes', type: 'circle', source: 'sdk-entities', filter: ['==',['get','domain'],'SEA'], paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,5],
        'circle-color': '#26C6DA', 'circle-opacity': 0.85,
        'circle-stroke-color': '#0A0D14', 'circle-stroke-width': 1,
      }});
      map.addLayer({ id: 'sdk-intel-nodes', type: 'circle', source: 'sdk-entities', filter: ['==',['get','domain'],'INTEL'], paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,5],
        'circle-color': '#C5CAE9', 'circle-opacity': 0.85,
        'circle-stroke-color': '#0A0D14', 'circle-stroke-width': 1,
      }});
      // Maritime Ships (moving entities) — ocean teal family
      map.addLayer({ id: 'ship-dots', type: 'circle', source: 'maritime-ships', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,6],
        'circle-color': ['match', ['get','type'], 'military','#D32F2F', 'tanker','#E65100', 'cargo','#26C6DA', '#B0BEC5'],
        'circle-opacity': 0.75,
      }});
      map.addLayer({ id: 'ship-label', type: 'symbol', source: 'maritime-ships', minzoom: 5, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.2], 'text-allow-overlap': false,
      }, paint: { 'text-color': ['match', ['get','type'], 'military','#D32F2F', 'tanker','#E65100', 'cargo','#26C6DA', '#B0BEC5'], 'text-halo-color': '#000', 'text-halo-width': 1 }});


      setMapReady(true);
      // Dev-only handle. The map is otherwise unreachable from the console,
      // which makes interaction bugs guesswork rather than diagnosis.
      if (process.env.NODE_ENV === 'development') (window as any).__m3tmWorldMap = map;
    });

    // Events
    let lastMove = 0;
    map.on('mousemove', e => {
      const now = Date.now();
      if (now - lastMove > 100) {
        lastMove = now;
        onMouseCoords?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });
    map.on('contextmenu', e => { e.preventDefault(); onRightClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
    const reportViewState = () => { const c = map.getCenter(); onViewStateChange?.({ zoom: map.getZoom(), latitude: c.lat }); };
    map.on('load', reportViewState);
    map.on('moveend', reportViewState);
    // Lightweight settled-view diagnostics for camera/terrain regressions.
    const reportCamera = () => {
      const center = map.getCenter();
      container.dataset.mapCamera = JSON.stringify({ zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), lat: center.lat, lng: center.lng });
    };
    map.on('load', reportCamera);
    map.on('moveend', reportCamera);
    map.on('idle', reportCamera);
    reportCamera();

    // ── POPUP HELPER ──
    const popup = (coords: any, html: string) => {
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '420px', offset: 14 }).setLngLat(coords).setHTML(html).addTo(map);
    };
    const pStyle = `background:rgba(12,14,26,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:'JetBrains Mono',monospace;`;
    const linkStyle = `display:inline-block;margin-top:8px;padding:5px 12px;font-size:10px;letter-spacing:0.12em;text-decoration:none;border-radius:5px;font-family:'JetBrains Mono',monospace;`;

    // ── XSS PROTECTION HELPERS ──
    const htmlEsc = (s: any): string => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const idSafe = (s: any): string => String(s ?? '').replace(/[^a-zA-Z0-9_\.\-]/g, '');
    const urlSafe = (s: any): string => { const u = String(s ?? ''); return /^https?:\/\//i.test(u) ? u : '#'; };
    const arEnum = (value: any, fallback = 'غير معروف'): string => {
      const key = String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
      const labels: Record<string, string> = {
        UNKNOWN: 'غير معروف', ONLINE: 'متصل', OFFLINE: 'غير متصل',
        WAR: 'حرب', HIGH: 'مرتفعة', MEDIUM: 'متوسطة', LOW: 'منخفضة',
        ELEVATED: 'مرتفعة', CRITICAL: 'حرجة', INFO: 'معلومات',
        SEVERE: 'شديد', CONGESTED: 'مزدحم', NORMAL: 'طبيعي',
        DANGER: 'خطر', WARNING: 'تحذير', SAFE: 'آمن',
        ACTIVE: 'نشط', INACTIVE: 'غير نشط',
        CARGO: 'سفينة شحن', TANKER: 'ناقلة', VESSEL: 'سفينة',
        PASSENGER: 'سفينة ركاب', FISHING: 'سفينة صيد', TUG: 'قاطرة',
        RADIOSONDE: 'مسبار جوي', BALLOON: 'بالون',
        ASCENDING: 'صاعد', DESCENDING: 'هابط', BURST: 'انفجر',
        WILDFIRE: 'حريق بري', VOLCANO: 'بركان', FLOOD: 'فيضان',
        DROUGHT: 'جفاف', CYCLONE: 'إعصار', EARTHQUAKE: 'زلزال',
        'SEVERE STORMS': 'عواصف شديدة', 'SEA AND LAKE ICE': 'جليد بحري وبحيرات',
        'ACTIVE CONFLICT ZONE': 'منطقة نزاع نشطة',
        'UNDER CONSTRUCTION': 'قيد الإنشاء',
        DECOMMISSIONED: 'خارج الخدمة', DECOMMISSIONING: 'قيد الإخراج من الخدمة',
        OPERATIONAL: 'عامل', OPERATING: 'عامل',
        NATIONWIDE: 'على مستوى الدولة', REGIONAL: 'إقليمي', LOCAL: 'محلي',
        TECHNICAL: 'سبب تقني', POWER: 'انقطاع طاقة', GOVERNMENT: 'إجراء حكومي',
      };
      return labels[key] ?? fallback;
    };

    const formatTime = (iso: string | null) => {
      if (!iso) return '—';
      try {
        const d = new Date(iso);
        return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' });
      } catch { return '—'; }
    };

    // ── Flights (with FlightAware + ADS-B Exchange links + ROUTE VISUALIZATION) ──
    ['fl-commercial','fl-private','fl-jets','fl-military'].forEach(layer => {
      map.on('click', layer, e => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as any;
        const coords = (e.features[0].geometry as any).coordinates;
        const cs = (p.callsign||'').trim();
        const selectedTrackSource = map.getSource('selected-flight-track') as maplibregl.GeoJSONSource | undefined;
        selectedTrackSource?.setData(EMPTY_FC as never);

        // Show initial popup immediately (without route data)
        const routeLoadingId = `route-info-${Date.now()}`;
        popup(coords, `<div style="${pStyle}border:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="color:#E8E6E0;font-size:15px;font-weight:700;letter-spacing:0.08em;">${htmlEsc(cs)}</span>
            <span style="color:#5C5A54;font-size:10px;">${htmlEsc(p.icao24||'')}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px;">
            <div><span style="color:#5C5A54;font-size:9px;">الطراز</span><br/><span style="color:#B0BEC5;">${htmlEsc(p.model||'—')}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">الارتفاع</span><br/><span style="color:#B0BEC5;">${p.alt?Math.round(p.alt)+' م':'—'}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">السرعة</span><br/><span style="color:#B0BEC5;">${p.speed_knots||'—'} عقدة</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">الاتجاه</span><br/><span style="color:#B0BEC5;">${Math.round(p.heading||0)}°</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">التسجيل</span><br/><span style="color:#B0BEC5;">${htmlEsc(p.registration||'—')}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">الموقع</span><br/><span style="color:#B0BEC5;">${coords[1].toFixed(2)},${coords[0].toFixed(2)}</span></div>
          </div>
          <div id="ac-${idSafe(p.icao24||'')}" style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
            <span style="color:#5C5A54;font-size:9px;letter-spacing:0.1em;">جارٍ التحقق من بيانات الطائرة…</span>
          </div>
          <button onclick="window.m3tmWatchFlight && window.m3tmWatchFlight({ icao24: '${idSafe(p.icao24||'')}', callsign: '${idSafe(cs)}' })" style="width:100%;margin-top:8px;padding:6px 12px;background:rgba(0,229,255,0.10);border:1px solid rgba(0,229,255,0.35);color:#7FE9FF;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:bold;letter-spacing:0.05em;border-radius:4px;cursor:pointer;">+ متابعة هذه الطائرة</button>
          <div id="${routeLoadingId}" style="margin-top:8px;padding:6px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <span style="color:#5C5A54;font-size:9px;letter-spacing:0.1em;">جارٍ تحديد المسار المنشور…</span>
          </div>
          <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;">
            <a href="https://www.flightaware.com/live/flight/${encodeURIComponent(cs)}" target="_blank" style="${linkStyle}color:#78909C;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);">FLIGHTAWARE</a>
            <a href="https://globe.adsbexchange.com/?icao=${encodeURIComponent(p.icao24||'')}" target="_blank" style="${linkStyle}color:#78909C;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);">ADS-B</a>
            <a href="https://www.radarbox.com/data/flights/${encodeURIComponent(cs)}" target="_blank" style="${linkStyle}color:#78909C;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);">RADARBOX</a>
          </div>
        </div>`);

        // The transponder only reports a type code (often nothing at all), so
        // resolve the real manufacturer/model and registration out of band.
        if (p.icao24) {
          fetch(`/api/aircraft?icao24=${encodeURIComponent(p.icao24)}`)
            .then(r => (r.ok ? r.json() : null))
            .then((d) => {
              const el = document.getElementById(`ac-${p.icao24}`);
              if (!el || !d || d.error) {
                if (el) el.innerHTML = '<span style="color:#5C5A54;font-size:9px;">الطائرة غير موجودة في السجل المتاح</span>';
                return;
              }
              const track = Array.isArray(d.track)
                ? d.track.filter((point: unknown) => Array.isArray(point) && point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
                : [];
              if (track.length >= 2) {
                selectedTrackSource?.setData({
                  type: 'FeatureCollection',
                  features: [{
                    type: 'Feature',
                    properties: { icao24: p.icao24 || '', callsign: cs || '' },
                    geometry: { type: 'LineString', coordinates: track },
                  }],
                } as never);
              }
              const bits = [d.registration, d.typeCode, d.operator].filter(Boolean)
                .map((x: string) => htmlEsc(String(x))).join(' · ');
              el.innerHTML =
                `<div style="color:#E8E6E0;font-size:11px;line-height:1.35;">${htmlEsc(d.model || 'طراز غير محدد')}</div>` +
                (bits ? `<div style="color:#78909C;font-size:9px;margin-top:2px;">${bits}</div>` : '');
            })
            .catch(() => {});
        }

        // Resolve origin/destination for the readout only. The line this used
        // to draw was a straight hop between two airports, which is not the
        // path flown — watched aircraft draw their real reported track instead.
        const cleanCallsign = cs.replace(/\s+/g, '');
        const routeParams = new URLSearchParams({
          callsign: cleanCallsign,
          icao24: p.icao24 || '',
          lat: String(coords[1]),
          lng: String(coords[0]),
          speed: String(p.speed_knots || 0),
        });
        fetch(`/api/flight-route?${routeParams}`)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(routeData => {
            const el = document.getElementById(routeLoadingId);
            if (!el) return;
            if (routeData.found && routeData.origin && routeData.destination) {
              const depTime = formatTime(routeData.departureTime);
              const arrTime = formatTime(routeData.arrivalTime);
              const pct = Math.round((routeData.progress || 0) * 100);
              const distKm = routeData.totalDistanceKm || 0;
              el.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                  <div><span style="color:#5C5A54;font-size:8px;">من</span><br/><span style="color:#E8E6E0;font-size:13px;font-weight:700;">${htmlEsc(routeData.origin.iata || routeData.origin.icao)}</span> <span style="color:#5C5A54;font-size:9px;">${htmlEsc(routeData.origin.city)}</span></div>
                  <span style="color:#5C5A54;font-size:11px;">&rarr;</span>
                  <div style="text-align:right;"><span style="color:#5C5A54;font-size:8px;">إلى</span><br/><span style="color:#E8E6E0;font-size:13px;font-weight:700;">${htmlEsc(routeData.destination.iata || routeData.destination.icao)}</span> <span style="color:#5C5A54;font-size:9px;">${htmlEsc(routeData.destination.city)}</span></div>
                </div>
                <div style="height:2px;background:rgba(255,255,255,0.06);border-radius:1px;margin:6px 0;"><div style="width:${pct}%;height:100%;background:rgba(255,255,255,0.35);border-radius:1px;"></div></div>
                <div style="display:flex;justify-content:space-between;font-size:10px;color:#78909C;">
                  <span>إقلاع ${depTime}</span>
                  <span>${pct}% &middot; ${distKm.toLocaleString()}km</span>
                  <span>وصول ${arrTime}</span>
                </div>
              `;
            } else {
              el.innerHTML = `<span style="color:#5C5A54;font-size:9px;">لا يتوفر مسار مجدول منشور</span>`;
            }
          })
          .catch(() => {
            const el = document.getElementById(routeLoadingId);
            if (el) el.innerHTML = `<span style="color:#5C5A54;font-size:9px;">تعذر الحصول على المسار</span>`;
          });
      });
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    // ── CCTV (opens CameraViewer panel) ──
    map.on('click', 'cctv-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      // Emit the camera data so the CameraViewer opens
      onEntityClick?.({
        type: 'cctv',
        id: p.id,
        name: p.name,
        city: p.city,
        country: p.country,
        source: p.source,
        feed_url: p.feed_url,
        stream_url: p.stream_url,
        stream_type: p.stream_type,
        external_url: p.external_url,
        lat: coords[1],
        lng: coords[0],
      });
      // Also fly to the camera
      map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 13), duration: 1000 });
    });

    // ── Earthquakes (with USGS link) ──
    map.on('click', 'eq-circles', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,149,0,0.3);">
        <div style="color:#FF9500;font-size:14px;font-weight:700;margin-bottom:4px;">زلزال بقوة M${p.magnitude}</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;">${htmlEsc(p.place||'موقع غير محدد')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">العمق</span><br/><span style="color:#E8E6E0;">${p.depth||'—'} كم</span></div>
          <div><span style="color:#5C5A54;">الإحداثيات</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}, ${coords[0].toFixed(3)}</span></div>
        </div>
        <a href="${p.source === 'NIGGG-BAS' ? 'https://ndc.niggg.bas.bg/' : `https://earthquake.usgs.gov/earthquakes/eventpage/${encodeURIComponent(p.id||'')}`}" target="_blank" style="${linkStyle}color:#FF9500;border:1px solid rgba(255,149,0,0.4);background:rgba(255,149,0,0.1);">📊 ${p.source === 'NIGGG-BAS' ? 'NIGGG-BAS' : 'تفاصيل المصدر'}</a>
      </div>`);
    });

    // ── Satellites (SatNOGS powered) ──
    // Layers with their own click handlers. The satellite pick defers to
    // these, and to nothing else — the basemap is not a click target.
    const CLICKABLE_LAYERS = new Set(['conflict-icons','conflict-event-dots','military-activity-dots','frontlines-fill','frontlines-line','cctv-dots','eq-circles','fires-heat',
      'gdelt-dots','weather-dots','infra-dots','maritime-dots','choke-dots','news-dots',
      'balloon-dots','rad-dots','ship-dots','sweep-device-dots','scan-targets-dots',
      'sdk-sea','sdk-air','sdk-intel','malware-dots','cyber-heads','gdelt-events-dots',
      'cf-outage-dots','cf-attack-dots','flight-dots','military-dots','jet-dots','private-dots']);

    // Satellites are picked on the GPU: the pick pass runs the same vertex
    // shader as the visible one, so the target is always exactly where the
    // marker was drawn — including its altitude. A ground-projected hit test
    // would put the target under the satellite instead of on it.
    map.on('click', e => {
      const layer = satLayerRef.current;
      if (!layer) return;
      // Defer to any layer that has its own click handler, so a camera or an
      // aircraft under the cursor is not stolen by a satellite behind it.
      // Only those layers count: querying every feature matches the basemap
      // land and water fills at essentially any point on the globe, which
      // made this bail out every single time.
      const hits = map.queryRenderedFeatures(e.point);
      if (hits.some(f => f.layer?.id && CLICKABLE_LAYERS.has(f.layer.id))) return;
      const idx = layer.pick(e.point.x, e.point.y);
      const p = idx == null ? null : satRowsRef.current[idx];
      // Clicking past every satellite is how a selection is dismissed, so an
      // empty click has to clear the ring and the track rather than leave them
      // lit over nothing.
      if (idx == null || !p) { clearSat(); return; }

      // The readout is a panel, not a MapLibre popup: a popup can only anchor
      // to a ground coordinate, and these markers are drawn at altitude. Any
      // other layer's popup is still welcome to the screen, but not on top of
      // this selection.
      popupRef.current?.remove();
      layer.setOrbit(null);
      satPickedRef.current = idx;
      satSelectedIdRef.current = p.noradId ?? null;
      layer.setSelected(idx);
      setSelectedSat({ ...p, periodMinutes: null, track: p.noradId ? 'loading' : 'unavailable' });

      // Draw the selected satellite's orbit. Fetched per click rather than
      // bundled with the catalogue: that payload is already megabytes, and an
      // operator looks at one orbit at a time.
      if (p.noradId) {
        const wanted = p.noradId;
        // A slower reply for a satellite the operator has already moved on
        // from must not draw over the one they are looking at now.
        const stale = () => satSelectedIdRef.current !== wanted;
        const mark = (track: SatelliteDetail['track'], periodMinutes: number | null = null) =>
          setSelectedSat(prev => (prev && prev.noradId === wanted ? { ...prev, track, periodMinutes } : prev));
        const at = satEpochRef.current;
        fetch(`/api/satellites/orbit?id=${encodeURIComponent(wanted)}${at ? `&t=${at}` : ''}`)
          .then(r => (r.ok ? r.json() : null))
          .then(d => {
            if (stale()) return;
            if (!d?.segments?.length) { mark('unavailable'); return; }
            layer.setOrbit(
              d.segments.map((seg: number[][]) => seg.map(([lng, lat, altKm]) => ({ lng, lat, altKm }))),
              parseColor(satColorFor(p.category, p.color, paletteRef.current)),
            );
            mark('ready', typeof d.periodMinutes === 'number' ? d.periodMinutes : null);
          })
          // No track is fine; the satellite still shows — but the readout says so
          // rather than sitting on 'plotting' forever.
          .catch(() => { if (!stale()) mark('unavailable'); });
      }
    });

    // The cursor should say a satellite is clickable, like every other layer.
    // Picking re-renders the entire catalogue and reads back from the GPU.
    // Keep that work out of camera gestures and limit hover checks to 10/sec.
    // Click selection above remains immediate and full precision.
    let hoverFrame = 0;
    let lastHoverPick = -Infinity;
    map.on('mousemove', e => {
      const layer = satLayerRef.current;
      if (!layer || hoverFrame || map.isMoving() || performance.now() - lastHoverPick < 100) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0;
        if (map.isMoving()) return;
        const canvas = map.getCanvas();
        // Never fight another layer that has already claimed the cursor.
        if (canvas.style.cursor && canvas.style.cursor !== 'pointer') return;
        lastHoverPick = performance.now();
        const over = layer.pick(e.point.x, e.point.y) != null;
        if (over) canvas.style.cursor = 'pointer';
        else if (canvas.style.cursor === 'pointer') canvas.style.cursor = '';
      });
    });

    // ── Fires (with NASA FIRMS link) ──
    map.on('click', 'fires-heat', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,107,0,0.3);">
        <div style="color:#FF6B00;font-size:12px;font-weight:700;margin-bottom:6px;">🔥 تم رصد حريق نشط</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">درجة السطوع</span><br/><span style="color:#FF6B00;">${p.brightness||'—'}K</span></div>
          <div><span style="color:#5C5A54;">الإحداثيات</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <a href="https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;l:noaa20-viirs,viirs,modis_a,modis_t;@${coords[0]},${coords[1]},10z" target="_blank" style="${linkStyle}color:#FF6B00;border:1px solid rgba(255,107,0,0.4);background:rgba(255,107,0,0.1);">🛰️ خريطة NASA FIRMS</a>
      </div>`);
    });

    // ── Malware Threats (Abuse.ch) ──
    map.on('click', 'malware-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const tType = p.threat_type === 'malware_download'
        ? 'تنزيل برمجية ضارة'
        : p.threat_type === 'botnet'
          ? 'شبكة روبوتات'
          : p.threat_type === 'phishing'
            ? 'تصيد'
            : 'تهديد برمجي';
      const statusColor = p.status === 'online' ? '#39FF14' : '#FF1744';
      const place = [p.city, p.country].filter(Boolean).join(', ') || 'غير معروف';
      const host = p.as_name ? `AS${p.asn} ${p.as_name}` : '';
      const urls = Number(p.url_count) || 1;
      // Every field below is observed. Where the old popup linked to a generic
      // browse page, this links to the specific URLhaus report behind the node.
      const ref = urlSafe(p.reference);

      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,23,68,0.4);box-shadow:inset 0 0 12px rgba(255,23,68,0.1);min-width:250px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,23,68,0.3);padding-bottom:6px;margin-bottom:8px;">
          <div style="color:#FF1744;font-size:12px;font-weight:700;letter-spacing:0.1em;text-shadow:0 0 4px rgba(255,23,68,0.5);">[ ${htmlEsc(tType)} ]</div>
          <div style="color:#5C5A54;font-size:9px;">${htmlEsc(place)}</div>
        </div>
        <div style="color:#E8E6E0;font-size:11px;font-weight:bold;margin-bottom:2px;">${htmlEsc(p.malware || 'حمولة غير مصنفة')}</div>
        ${host ? `<div style="color:#5C5A54;font-size:9px;margin-bottom:10px;">${htmlEsc(host)}</div>` : '<div style="margin-bottom:10px;"></div>'}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;background:rgba(0,0,0,0.3);padding:6px;border-radius:4px;">
          <div><span style="color:#5C5A54;">المضيف</span><br/><span style="color:#00E5FF;font-family:monospace;">${htmlEsc(p.ip)}:${htmlEsc(String(p.port ?? 0))}</span></div>
          <div><span style="color:#5C5A54;">الحالة</span><br/><span style="color:${statusColor};">${arEnum(p.status)}</span></div>
          <div><span style="color:#5C5A54;">روابط نشطة</span><br/><span style="color:#E8E6E0;">${urls}</span></div>
          <div><span style="color:#5C5A54;">آخر بلاغ</span><br/><span style="color:#E8E6E0;">${htmlEsc((p.last_seen || '').split(' ')[0] || '—')}</span></div>
        </div>
        <div style="color:#5C5A54;font-size:9px;margin-bottom:10px;">أول رصد ${htmlEsc((p.first_seen || '').split(' ')[0] || '—')}${p.reporter ? ` · أبلغ عنه ${htmlEsc(p.reporter)}` : ''}</div>
        <div style="display:flex;gap:6px;">
          ${ref ? `<a href="${ref}" target="_blank" style="${linkStyle}flex:1;text-align:center;color:#E8E6E0;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);">تقرير URLhaus ↗</a>` : ''}
        </div>
      </div>`);
    });


    // ── GDELT 2.0 Events ──
    const EVENT_COLOR: Record<string, string> = {
      aerial_attack: '#FF1744',
      heavy_weapons: '#FF6D00',
      bombing: '#FF3D3D',
      armed_clash: '#F4511E',
      mass_violence: '#C62828',
      assault: '#E53935',
      material_conflict: '#FF5252',
    };
    map.on('click', 'gdelt-events-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const accent = EVENT_COLOR[String(p.event_category)] ?? '#9B978E';
      const src = urlSafe(p.url);
      const tone = Number(p.tone);
      const coverage = p.corroboration === 'multi-source-report' ? 'تغطية من عدة مصادر' : 'بلاغ من مصدر واحد';
      const precision = p.precision === 'generalized-0.25deg' ? 'موقع عام مُعمّم إلى 0.25°' : 'موقع منشور';
      popup(coords, `
      <div style="${pStyle}border:1px solid ${accent}66;min-width:270px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="width:7px;height:7px;border-radius:50%;background:${accent};box-shadow:0 0 8px ${accent};"></span>
          <span style="color:${accent};font-size:10px;font-weight:700;letter-spacing:0.08em;">${htmlEsc(p.event_label_ar || 'حدث نزاع مُبلّغ عنه')}</span>
        </div>
        <div style="color:#E8E6E0;font-size:12px;font-weight:700;margin-bottom:8px;">${htmlEsc(p.name || 'موقع منشور')}</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;color:#9B978E;">
          <span style="opacity:0.6;">CAMEO</span><span style="color:#E8E6E0;">${htmlEsc(p.event_code || p.root_code || '—')}</span>
          <span style="opacity:0.6;">التغطية</span><span style="color:#E8E6E0;">${coverage} · ${htmlEsc(p.sources || 0)} مصادر / ${htmlEsc(p.articles || 0)} مقالات</span>
          <span style="opacity:0.6;">Goldstein</span><span style="color:${Number(p.goldstein) < 0 ? '#FF3D3D' : '#00E676'};">${htmlEsc(p.goldstein)}</span>
          <span style="opacity:0.6;">متوسط النبرة</span><span style="color:${tone < 0 ? '#FF9500' : '#00E676'};">${htmlEsc(p.tone)}</span>
          <span style="opacity:0.6;">الدقة العامة</span><span style="color:#E8E6E0;">${precision}</span>
        </div>
        <div style="margin-top:8px;font-size:9px;line-height:1.5;color:#7E817C;">GDELT 2.0 · ${htmlEsc(String(p.date).slice(0, 16).replace('T', ' '))}Z<br/>التصنيف يصف ما ورد في السجل المنشور ولا يعني تحققًا مستقلاً من M3TM.WORLD أو تحديد نقطة هدف دقيقة.</div>
        ${src !== '#' ? `<a href="${src}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:${accent};border:1px solid ${accent}66;background:${accent}1a;">فتح المصدر المنشور</a>` : ''}
      </div>`);
    });

    // ── Cloudflare Radar: internet outage ──
    map.on('click', 'cf-outage-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      // MapLibre serialises feature properties, so booleans can arrive as strings.
      const ongoing = p.ongoing === true || p.ongoing === 'true';
      const accent = ongoing ? '#FFB300' : '#8B7325';
      const src = urlSafe(p.url);
      popup(coords, `
      <div style="${pStyle}border:1px solid ${accent}66;min-width:250px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="width:7px;height:7px;border-radius:50%;background:${accent};box-shadow:0 0 8px ${accent};"></span>
          <span style="color:${accent};font-size:10px;font-weight:700;letter-spacing:0.15em;">
            ${ongoing ? 'انقطاع جارٍ' : 'انقطاع منتهٍ'}
          </span>
        </div>
        <div style="color:#E8E6E0;font-size:12px;font-weight:700;margin-bottom:8px;">${htmlEsc(p.country_name)}</div>
        ${p.description ? `<div style="color:#9B978E;font-size:10px;line-height:1.6;margin-bottom:8px;">${htmlEsc(p.description)}</div>` : ''}
        <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;color:#9B978E;">
          <span style="opacity:0.6;">السبب</span><span style="color:#E8E6E0;">${arEnum(p.cause, 'غير محدد')}</span>
          <span style="opacity:0.6;">النطاق</span><span style="color:#E8E6E0;">${arEnum(p.scope, 'غير محدد')}</span>
          <span style="opacity:0.6;">بدأ</span><span style="color:#E8E6E0;">${htmlEsc(String(p.start).slice(0, 16).replace('T', ' '))}</span>
          ${p.end ? `<span style="opacity:0.6;">انتهى</span><span style="color:#E8E6E0;">${htmlEsc(String(p.end).slice(0, 16).replace('T', ' '))}</span>` : ''}
        </div>
        <div style="margin-top:8px;font-size:9px;color:#5C5A54;">Cloudflare Radar</div>
        ${src !== '#' ? `<a href="${src}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:${accent};border:1px solid ${accent}66;background:${accent}1a;">تفاصيل الرصد</a>` : ''}
      </div>`);
    });

    // ── Cloudflare Radar: attack origin share ──
    map.on('click', 'cf-attack-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `
      <div style="${pStyle}border:1px solid rgba(255,61,61,0.4);min-width:230px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="width:7px;height:7px;border-radius:50%;background:#FF3D3D;box-shadow:0 0 8px #FF3D3D;"></span>
          <span style="color:#FF3D3D;font-size:10px;font-weight:700;letter-spacing:0.15em;">مصدر هجوم طبقة 3</span>
        </div>
        <div style="color:#E8E6E0;font-size:12px;font-weight:700;margin-bottom:8px;">${htmlEsc(p.country_name)}</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;color:#9B978E;">
          <span style="opacity:0.6;">الحصة</span><span style="color:#FF6B6B;font-weight:700;">${htmlEsc(p.share)}%</span>
          <span style="opacity:0.6;">الرمز</span><span style="color:#E8E6E0;">${htmlEsc(p.country)}</span>
        </div>
        <div style="margin-top:8px;font-size:9px;color:#5C5A54;line-height:1.5;">
          حصة حركة هجمات طبقة 3 المرصودة بحسب بلد المصدر · Cloudflare Radar
        </div>
      </div>`);
    });

    // ── GDELT Conflicts (with source article) ──
    map.on('click', 'gdelt-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;

      // These are GDACS alerts and each one carries its own report URL. This
      // used to guess a Liveuamap regional war map from the coordinates
      // instead, which sent every event outside the six hardcoded boxes — all
      // of the Americas, Asia and Oceania among them — to the Ukraine map.
      const src = urlSafe(p.url);
      // GDACS is a natural-disaster feed. Every event here was headed
      // "CONFLICT EVENT" — on a live sample that mislabelled 342 of 369
      // events, nearly all of them wildfires.
      const KIND: Record<string, [string, string]> = {
        earthquake: ['🌐 زلزال', '#FF9500'],
        wildfire:   ['🔥 حريق بري', '#FF6B1A'],
        flood:      ['🌊 فيضان', '#00B0FF'],
        weather:    ['🌀 إعصار مداري', '#00E5FF'],
        volcano:    ['🌋 بركان', '#FF3D3D'],
        drought:    ['☀️ جفاف', '#FFD500'],
      };
      const [kindLabel, kindColor] = KIND[String(p.kind)] ?? ['⚠️ حدث عالمي', '#FF3D3D'];

      popup(coords, `<div style="${pStyle}border:1px solid ${kindColor}4d;">
        <div style="color:${kindColor};font-size:12px;font-weight:700;margin-bottom:6px;">${kindLabel}</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${htmlEsc(p.name||'حدث عام غير مصنف')}</div>
        ${src !== '#' ? `<a href="${src}" target="_blank" rel="noopener noreferrer" style="${linkStyle}flex:1;text-align:center;color:${kindColor};border:1px solid ${kindColor}66;background:${kindColor}26;display:inline-block;width:100%;box-sizing:border-box;margin-top:4px;">[ فتح المصدر ↗ ]</a>` : ''}
      </div>`);
    });

    // ── Global Event / Conflict Markers ──
    const onConflictClick = (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.severity === 'war' ? '#FF1744' : p.severity === 'high' ? '#FF9500' : '#FFD500';
      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:6px;">⚠️ ${htmlEsc(p.label || 'حدث مرصود')}</div>
        <div style="font-size:10px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${htmlEsc(p.description || 'بلاغ عام مرتبط بهذا الموقع.')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">الدرجة</span><br/><span style="color:${color};">${arEnum(p.severity)}</span></div>
          <div><span style="color:#5C5A54;">الإحداثيات</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        ${p.sourceUrl ? `<a href="${urlSafe(p.sourceUrl)}" target="_blank" style="${linkStyle}flex:1;text-align:center;color:${color};border:1px solid ${color}40;background:${color}15;display:inline-block;width:100%;box-sizing:border-box;margin-top:4px;">[ فتح المصدر ↗ ]</a>` : ''}
      </div>`);
    };
    map.on('click', 'conflict-icons', onConflictClick);
    map.on('click', 'conflict-event-dots', onConflictClick);

    map.on('click', 'military-activity-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const level = Number(p.level) || 1;
      const color = level >= 3 ? '#EF5350' : level >= 2 ? '#FF7043' : '#FFB74D';
      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:6px;">نشاط جوي عسكري عام</div>
        <div style="font-size:10px;color:#E8E6E0;line-height:1.5;margin-bottom:8px;">تجميع إقليمي واسع من بيانات عامة. لا تُعرض هوية الطائرات أو إحداثياتها الدقيقة أو مساراتها التشغيلية.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">مستوى النشاط</span><br/><span style="color:${color};">${htmlEsc(p.activity || 'محدود')}</span></div>
          <div><span style="color:#5C5A54;">الحجم التقريبي</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.approximate_count || '2-4')}</span></div>
        </div>
        <div style="font-size:8px;color:#7E817C;margin-top:8px;">الدقة: خلية إقليمية تقريبية ${htmlEsc(String(p.cell_degrees || 6))}°</div>
      </div>`);
    });

    const onFrontlineClick = (e: any) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = e.lngLat;
      popup([coords.lng, coords.lat], `<div style="${pStyle}border:1px solid rgba(255,209,102,.28);">
        <div style="color:#FFD166;font-size:12px;font-weight:700;margin-bottom:6px;">خط/منطقة جبهة منشورة</div>
        <div style="font-size:10px;color:#E8E6E0;line-height:1.5;">هندسة سياقية من لقطة منشورة للعامة، وليست موضعًا تكتيكيًا لحظيًا.</div>
        <div style="font-size:9px;color:#A8AAA5;margin-top:7px;">المصدر: ${htmlEsc(p.source || 'DeepStateMap.Live')}</div>
        ${p.source_label ? `<div style="font-size:8px;color:#7E817C;margin-top:3px;">وصف المصدر: ${htmlEsc(p.source_label)}</div>` : ''}
      </div>`);
    };
    map.on('click', 'frontlines-fill', onFrontlineClick);
    map.on('click', 'frontlines-line', onFrontlineClick);


    // ── M3TM.WORLD SDK link click ──
    const SDK_SOURCE_URLS: Record<string, string> = {
      'AIS Maritime': 'https://www.marinetraffic.com',
      'AIS Stream': 'https://aisstream.io',
      'AIS → Lattice': 'https://aisstream.io',
      'ADS-B / OpenSky': 'https://opensky-network.org',
      'ADS-B → Lattice': 'https://opensky-network.org',
      'Naval Public Data': 'https://www.odni.gov',
    };
    ['sdk-sea','sdk-sea-glow','sdk-air','sdk-air-glow','sdk-intel','sdk-intel-glow'].forEach(layer => {
      map.on('click', layer, e => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as any;
        const coords = e.lngLat;
        const srcUrl = p.url || SDK_SOURCE_URLS[p.source] || 'https://m3tm.world';
        const domainLabel = p.domain === 'SEA' ? '⚓ مسار بحري' : p.domain === 'AIR' ? '✈ ممر جوي' : '🛡 بيانات عامة';
        const domainColor = p.domain === 'SEA' ? '#4FC3F7' : p.domain === 'AIR' ? '#B3E5FC' : '#81D4FA';
        const linkStyle = 'text-decoration:none;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:700;letter-spacing:0.05em;';
        popup([coords.lng, coords.lat], `<div style="${pStyle}border:1px solid ${domainColor}40;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:${domainColor};box-shadow:0 0 8px ${domainColor};"></div>
            <span style="color:${domainColor};font-size:11px;font-weight:700;letter-spacing:0.1em;">${domainLabel}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;">
            <div><span style="color:#5C5A54;">من</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.fromName || 'نقطة البداية')}</span></div>
            <div><span style="color:#5C5A54;">إلى</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.toName || 'الوجهة')}</span></div>
            <div><span style="color:#5C5A54;">المجال</span><br/><span style="color:${domainColor};">${p.domain === 'SEA' ? 'بحري' : p.domain === 'AIR' ? 'جوي' : 'عام'}</span></div>
            <div><span style="color:#5C5A54;">المصدر</span><br/><a href="${urlSafe(srcUrl)}" target="_blank" style="color:${domainColor};text-decoration:underline;cursor:pointer;">${htmlEsc(p.source === 'Naval Public Data' ? 'مصدر بحري' : (p.source || 'M3TM.WORLD'))}</a></div>
          </div>
          <a href="${urlSafe(srcUrl)}" target="_blank" style="${linkStyle}color:${domainColor};border:1px solid ${domainColor}40;background:${domainColor}18;display:inline-block;margin-top:4px;">فتح المصدر ↗</a>
        </div>`);
      });
    });

    // ⚡ Live Cyber Attack Arcs (click on flying heads) ⚡
    map.on('click', 'cyber-heads', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const sevColor = (p.severity || 5) >= 8 ? '#FF1744' : (p.severity || 5) >= 6 ? '#FF6D00' : '#FFD600';
      const sevLabel = (p.severity || 5) >= 8 ? 'حرجة' : (p.severity || 5) >= 6 ? 'مرتفعة' : 'متوسطة';
      popup(coords, `<div style="${pStyle}border:1px solid ${sevColor}40;box-shadow:inset 0 0 20px ${sevColor}10, 0 0 15px ${sevColor}15;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${sevColor}30;padding-bottom:6px;margin-bottom:8px;">
          <div style="color:${sevColor};font-size:12px;font-weight:700;letter-spacing:0.12em;text-shadow:0 0 6px ${sevColor}60;">⚡ ${htmlEsc(p.action || 'هجوم')}</div>
          <div style="font-size:8px;padding:2px 6px;border-radius:3px;font-weight:700;letter-spacing:0.1em;background:${sevColor}20;color:${sevColor};border:1px solid ${sevColor}50;">${sevLabel}</div>
        </div>
        <div style="color:#E8E6E0;font-size:11px;font-weight:bold;margin-bottom:10px;">${htmlEsc(p.malware || 'حمولة غير معروفة')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;background:rgba(0,0,0,0.35);padding:8px;border-radius:4px;border:1px solid rgba(255,255,255,0.04);">
          <div><span style="color:#5C5A54;font-size:7px;letter-spacing:0.1em;">موقع المصدر</span><br/><span style="color:#FF5252;font-family:monospace;">${p.src_lat || '?'}°, ${p.src_lng || '?'}°</span></div>
          <div><span style="color:#5C5A54;font-size:7px;letter-spacing:0.1em;">الهدف</span><br/><span style="color:#00E5FF;font-family:monospace;">${htmlEsc(p.target_ip || '—')}</span></div>
          <div><span style="color:#5C5A54;font-size:7px;letter-spacing:0.1em;">دولة الهدف</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.target_country || '—')}</span></div>
          <div><span style="color:#5C5A54;font-size:7px;letter-spacing:0.1em;">المنفذ</span><br/><span style="color:#FFD600;font-family:monospace;">${p.port || '—'}</span></div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <div style="flex:1;height:3px;border-radius:2px;background:linear-gradient(90deg, ${sevColor}00, ${sevColor});opacity:0.5;"></div>
          <span style="font-size:7px;color:#5C5A54;letter-spacing:0.15em;">الشدة ${p.severity || '?'}/10</span>
          <div style="flex:1;height:3px;border-radius:2px;background:linear-gradient(90deg, ${sevColor}, ${sevColor}00);opacity:0.5;"></div>
        </div>
        <div style="margin-top:8px;font-size:7px;color:#5C5A54;text-align:center;letter-spacing:0.1em;">المصدر: ABUSE.CH FEODO TRACKER</div>
      </div>`);
    });

    // ── Generic hover for clickables ──
    ['conflict-icons','conflict-event-dots','military-activity-dots','frontlines-fill','frontlines-line','cctv-dots','eq-circles','fires-heat','gdelt-dots','weather-dots','infra-dots','maritime-dots','choke-dots','news-dots','balloon-dots','rad-dots','ship-dots','sweep-device-dots','scan-targets-dots','sdk-sea','sdk-sea-glow','sdk-sea-atmo','sdk-air','sdk-air-glow','sdk-air-atmo','sdk-intel','sdk-intel-glow','sdk-intel-atmo','malware-dots','cyber-heads','gdelt-events-dots','cf-outage-dots','cf-attack-dots'].forEach(layer => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    // ── Scan Targets click ──
    map.on('click', 'scan-targets-dots', (e: any) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = e.features[0].geometry.coordinates.slice();
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,61,61,0.5);">
        <div style="color:#FF3D3D;font-size:12px;font-weight:700;margin-bottom:6px;">🎯 الهدف: ${htmlEsc(p.id)}</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;">${htmlEsc(p.city || 'غير معروف')}, ${htmlEsc(p.country || 'غير معروف')} — ${htmlEsc(p.isp || 'مزود غير معروف')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">النوع</span><br/><span style="color:#00E5FF;">${arEnum(p.type, 'غير معروف')}</span></div>
          <div><span style="color:#5C5A54;">الإحداثيات</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
      </div>`);
    });

    // ── SCM Suppliers ──
    map.on('click', 'scm-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.risk_level === 'CRITICAL' ? '#FF1744' : p.risk_level === 'HIGH' ? '#FF9500' : '#00BCD4';
      const activeThreats = p.active_threats ? JSON.parse(p.active_threats) : [];

      let threatsHtml = '';
      if (activeThreats.length > 0) {
        threatsHtml = `<div style="margin-top:8px;padding-top:6px;border-top:1px solid ${color}40;color:${color};font-size:9px;font-weight:bold;">
          تهديدات نشطة:<br/>${activeThreats.map((t: string) => `⚠ ${htmlEsc(t)}`).join('<br/>')}
        </div>`;
      }

      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">🏢 ${htmlEsc(p.name)}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${htmlEsc(p.category)} | ${htmlEsc(p.city)}, ${htmlEsc(p.country)}</div>
        <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:11px;">
          <div><span style="color:#5C5A54;font-size:9px;">مستوى مخاطر سلسلة الإمداد</span><br/><span style="color:${color};font-weight:bold;">${arEnum(p.risk_level)}</span></div>
        </div>
        ${threatsHtml}
      </div>`);
    });

    // ── IP Sweep device click ──
    map.on('click', 'sweep-device-dots', (e: any) => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = e.features[0].geometry.coordinates.slice();
      const ports = JSON.parse(p.ports || '[]');
      const vulns = JSON.parse(p.vulns || '[]');
      const hostnames = JSON.parse(p.hostnames || '[]');
      const riskColors: Record<string, string> = { CRITICAL: '#FF3D3D', HIGH: '#FF6B00', MEDIUM: '#FFD700', LOW: '#76FF03', INFO: '#5C5A54' };
      popup(coords, `<div style="font-family:monospace;font-size:11px;color:#E8E6E0;">
        <div style="font-size:13px;font-weight:bold;margin-bottom:6px;color:${p.color};">${p.device_type}</div>
        <div style="font-size:12px;margin-bottom:8px;color:#fff;">${p.ip}</div>
        ${hostnames.length > 0 ? `<div style="font-size:9px;color:#8A8880;margin-bottom:6px;">${hostnames.join(', ')}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">المنافذ</span><br/><span style="color:#E8E6E0;">${ports.length}</span></div>
          <div><span style="color:#5C5A54;">المخاطر</span><br/><span style="color:${riskColors[p.risk_level] || '#666'};">${arEnum(p.risk_level)}</span></div>
        </div>
        <div style="font-size:9px;color:#8A8880;margin-bottom:6px;">المفتوحة: ${ports.slice(0, 12).join(', ')}${ports.length > 12 ? ' ...' : ''}</div>
        ${vulns.length > 0 ? `<div style="font-size:9px;color:#FF3D3D;margin-bottom:6px;">⚠ الثغرات: ${vulns.slice(0, 5).join(', ')}${vulns.length > 5 ? ` +${vulns.length - 5} إضافية` : ''}</div>` : ''}
      </div>`);
    });

    // ── Balloons / Sondes ──
    map.on('click', 'balloon-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      popup(coords, `<div style="${pStyle}border:1px solid ${p.color}40;">
        <div style="color:${p.color};font-size:12px;font-weight:700;letter-spacing:0.1em;margin-bottom:4px;">🎈 ${p.callsign}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">النوع: ${arEnum(p.type, 'مسبار جوي')} · الحالة: ${arEnum(p.status)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">الارتفاع</span><br/><span style="color:#E8E6E0;">${p.altitude} m</span></div>
          <div><span style="color:#5C5A54;">السرعة</span><br/><span style="color:#E8E6E0;">${Math.round(p.speed)} كم/س</span></div>
          <div><span style="color:#5C5A54;">معدل الصعود</span><br/><span style="color:${p.verticalRate > 0 ? '#00E676' : '#FF3D3D'};">${p.verticalRate.toFixed(1)} م/ث</span></div>
          <div><span style="color:#5C5A54;">الحرارة</span><br/><span style="color:#E8E6E0;">${p.temperature}°C</span></div>
        </div>
      </div>`);
    });

    // ── Radiation ──
    map.on('click', 'rad-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.status === 'DANGER' ? '#FF1744' : p.status === 'WARNING' ? '#FF9500' : '#AB47BC';
      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">☢️ ${p.name}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${p.city}, ${p.country}</div>
        <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:11px;">
          <div><span style="color:#5C5A54;font-size:9px;">القراءة</span><br/><span style="color:${color};font-weight:bold;">${p.reading} nSv/h</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">الحالة</span><br/><span style="color:${color};">${arEnum(p.status)}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">الشبكة</span><br/><span style="color:#E8E6E0;">${p.network}</span></div>
        </div>
      </div>`);
    });

    // ── Maritime Ships ──
    map.on('click', 'ship-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const color = p.type === 'military' ? '#FF1744' : p.type === 'tanker' ? '#FF9500' : '#00E5FF';
      const icon = p.type === 'military' ? '⚔️' : p.type === 'tanker' ? '🛢️' : '🚢';

      popup(coords, `<div style="${pStyle}border:1px solid ${color}60;box-shadow:inset 0 0 12px ${color}15;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${color}40;padding-bottom:6px;margin-bottom:8px;">
          <div style="color:${color};font-size:12px;font-weight:700;letter-spacing:0.1em;">${icon} [ ${arEnum(p.type, 'سفينة')} ]</div>
          <div style="color:#5C5A54;font-size:9px;">العلم: ${htmlEsc(p.flag||'—')}</div>
        </div>
        <div style="color:#E8E6E0;font-size:11px;font-weight:bold;margin-bottom:10px;">${p.name || 'سفينة غير معرّفة'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;background:rgba(0,0,0,0.3);padding:6px;border-radius:4px;">
          <div><span style="color:#5C5A54;">السرعة</span><br/><span style="color:${color};font-family:monospace;">${Number(p.speed).toFixed(1)} عقدة</span></div>
          <div><span style="color:#5C5A54;">الاتجاه</span><br/><span style="color:${color};font-family:monospace;">${Number(p.heading).toFixed(0)}°</span></div>
          <div><span style="color:#5C5A54;">خط العرض</span><br/><span style="color:#E8E6E0;font-family:monospace;">${coords[1].toFixed(4)}°</span></div>
          <div><span style="color:#5C5A54;">خط الطول</span><br/><span style="color:#E8E6E0;font-family:monospace;">${coords[0].toFixed(4)}°</span></div>
        </div>
        <div><span style="color:#5C5A54;font-size:9px;">الوجهة: </span><span style="color:#E8E6E0;font-size:9px;">${p.destination || 'غير معروفة'}</span></div>
        <a href="https://www.marinetraffic.com/en/ais/details/ships/mmsi:${p.mmsi}" target="_blank" style="${linkStyle}flex:1;text-align:center;color:${color};border:1px solid ${color}40;background:${color}15;display:inline-block;width:100%;box-sizing:border-box;margin-top:4px;">[ فتح المصدر ↗ ]</a>
      </div>`);
    });

    // ── Weather Events (NASA EONET + NOAA/NWS + GDACS) ──
    map.on('click', 'weather-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const iconEmoji = p.icon === 'cyclone' ? '🌀' : p.icon === 'volcano' ? '🌋' : p.icon === 'flood' ? '🌊' : p.icon === 'drought' ? '🏜️' : p.icon === 'ice' ? '🧊' : p.icon === 'weather' ? '⚠️' : '⚡';
      popup(coords, `<div style="${pStyle}border:1px solid rgba(224,64,251,0.3);">
        <div style="color:#E040FB;font-size:14px;font-weight:700;margin-bottom:6px;">${iconEmoji} ${arEnum(p.type, 'حدث جوي')}</div>
        <div style="font-size:10px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${p.title || 'حدث غير محدد'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">الدرجة</span><br/><span style="color:${p.severity === 'high' ? '#FF1744' : '#FFD700'};">${arEnum(p.severity, 'منخفضة')}</span></div>
          <div><span style="color:#5C5A54;">الإحداثيات</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <div style="display:flex;gap:6px;">
          ${p.source ? `<a href="${p.source}" target="_blank" style="${linkStyle}color:#E040FB;border:1px solid rgba(224,64,251,0.4);background:rgba(224,64,251,0.1);">📡 المصدر</a>` : ''}
        </div>
      </div>`);
    });

    // ── Nuclear Infrastructure ──
    map.on('click', 'infra-dots', e => {
      if (!e.features?.length) return;
      const p = e.features[0].properties as any;
      const coords = (e.features[0].geometry as any).coordinates;
      const status = String(p.status ?? '');

      // Same order and colours as the infra-dots paint expression above, so the
      // popup's accent always matches the dot the user just clicked.
      const accent =
        status.includes('SEISMIC RISK') ? '#E65100' :
        status === 'Active Conflict Zone' ? '#D32F2F' :
        status.includes('Decommission') ? '#546E7A' :
        status === 'Under Construction' ? '#FFA726' :
        '#26A69A';

      // A facility with no reactor (waste storage, enrichment) and a research
      // reactor rated in thermal MW both carry 0 here — neither is an electrical
      // figure, so both render as "—" rather than as a real 0 MWe.
      const row = (label: string, value: string, color = '#E8E6E0') =>
        `<div><span style="color:#5C5A54;">${label}</span><br/><span style="color:${color};">${value}</span></div>`;

      const ref = p.sourceUrl
        ? `<a href="${htmlEsc(p.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:${accent};border:1px solid ${accent}66;background:${accent}1A;">المرجع</a>`
        : '';

      popup(coords, `<div style="${pStyle}border:1px solid ${accent}4D;">
        <div style="color:${accent};font-size:14px;font-weight:700;margin-bottom:2px;">☢️ ${htmlEsc(p.name || 'منشأة نووية')}</div>
        <div style="color:#5C5A54;font-size:9px;letter-spacing:0.1em;margin-bottom:10px;">${htmlEsc([p.city, p.country].filter(Boolean).join(', ')) || '—'}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 6px;font-size:9px;">
          ${row('الحالة', arEnum(status, 'غير محددة'), accent)}
          ${row('المالك', htmlEsc(p.owner) || '—')}
          ${row('المفاعلات', p.reactors ? htmlEsc(p.reactors) : '—', accent)}
          ${row('القدرة', p.capacityMW ? `${Number(p.capacityMW).toLocaleString()} MWe` : '—')}
        </div>
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);font-size:9px;color:#5C5A54;">
          ${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${ref}
          <a href="https://www.google.com/maps/@${coords[1]},${coords[0]},14z/data=!3m1!1e3" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:#8A8880;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.04);">عرض القمر الصناعي</a>
        </div>
      </div>`);
    });

    // ── Maritime Ports & Naval Bases ──
    map.on('click', 'maritime-dots', e => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = (e.features![0].geometry as any).coordinates;
      const typeColor = p.type === 'naval' ? '#FF3D3D' : p.type === 'energy' ? '#FF9500' : '#00BCD4';
      const typeLabel = p.type === 'naval' ? 'قاعدة بحرية' : p.type === 'energy' ? 'ميناء طاقة' : 'ميناء حاويات';

      const congestionHtml = p.congestion ? `
        <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <div><span style="color:#5C5A54;font-size:9px;">الازدحام</span><br/><span style="color:${p.congestion === 'SEVERE' ? '#FF1744' : p.congestion === 'CONGESTED' ? '#FF9500' : '#00E676'};font-weight:bold;font-size:10px;">${arEnum(p.congestion)}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">زمن الانتظار التقديري</span><br/><span style="color:#E8E6E0;font-weight:bold;font-size:10px;">${p.dwell_time || 'غير معروف'}</span></div>
          </div>
        </div>` : '';

      popup(coords, `<div style="${pStyle}border:1px solid ${typeColor}40;">
        <div style="color:${typeColor};font-weight:bold;font-size:11px;margin-bottom:4px;">${p.name}</div>
        <div style="color:#999;font-size:9px;margin-bottom:6px;">${typeLabel} — ${p.country}</div>
        ${p.volume ? `<div style="font-size:9px;color:#aaa;">الحجم: <span style="color:${typeColor};font-weight:bold;">${p.volume}</span></div>` : ''}
        ${p.fleet ? `<div style="font-size:9px;color:#aaa;">الأسطول: <span style="color:${typeColor};font-weight:bold;">${p.fleet}</span></div>` : ''}
        ${p.rank ? `<div style="font-size:9px;color:#aaa;">الترتيب العالمي: <span style="color:${typeColor};font-weight:bold;">#${p.rank}</span></div>` : ''}
        ${congestionHtml}
      </div>`);
    });

    // ── Maritime Chokepoints ──
    map.on('click', 'choke-dots', e => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      const coords = (e.features![0].geometry as any).coordinates;
      const riskCol = p.risk === 'CRITICAL' ? '#FF1744' : p.risk === 'HIGH' ? '#FF9500' : p.risk === 'ELEVATED' ? '#FFD700' : '#00E676';
      popup(coords, `<div style="${pStyle}border:1px solid ${riskCol}40;">
        <div style="color:#FF9500;font-weight:bold;font-size:11px;margin-bottom:4px;">${p.name}</div>
        <div style="font-size:9px;color:#aaa;">الحركة: <span style="color:#fff;">${p.traffic}</span></div>
        <div style="font-size:9px;color:#aaa;">المخاطر: <span style="color:${riskCol};font-weight:bold;">${arEnum(p.risk)}</span></div>
      </div>`);
    });

    // ── Live News (opens feed viewer) ──
    map.on('click', 'news-dots', e => {
      const p = e.features?.[0]?.properties;
      if (!p) return;
      onEntityClick?.({
        type: 'live_news',
        id: p.bridge_id || undefined,
        name: p.name,
        city: p.city,
        country: p.country,
        url: p.url,
        category: p.category,
        embed_allowed: p.embed_allowed !== false && p.embed_allowed !== 'false',
      });
    });

    return () => { cancelAnimationFrame(hoverFrame); map.remove(); mapRef.current = null; };
  }, []);

  // Day/Night
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const update = () => {
      const src = map.getSource('day-night') as any;
      if (!src) return;
      if (!activeLayers.day_night) { src.setData(EMPTY_FC); return; }
      src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [computeSolarTerminator()] }, properties: {} }] });
    };
    update();
    const iv = setInterval(update, 300000); // 5 min (was 1 min — shadow barely moves)
    return () => clearInterval(iv);
  }, [mapReady, activeLayers.day_night]);

  // Helper to set GeoJSON
  const setGeo = useCallback((source: string, features: any[]) => {
    const src = mapRef.current?.getSource(source) as any;
    if (src) src.setData({ type: 'FeatureCollection', features });
  }, []);

  const setVis = useCallback((ids: string[], visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    ids.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); });
  }, []);

  // Flight data → GeoJSON (GPU rendered)
  useEffect(() => {
    if (!mapReady) return;
    const toFeatures = (arr: any[], decimate: number = 1) => {
      let filtered = arr || [];
      if (decimate > 1) {
        filtered = filtered.filter((_, i) => i % decimate === 0);
      }
      return filtered.map((f: any) => ({
        type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
        properties: { callsign: f.callsign, heading: f.heading || 0, alt: f.alt, model: f.model, speed_knots: f.speed_knots, registration: f.registration, icao24: f.icao24 },
      }));
    };
    setGeo('flights', activeLayers.flights ? toFeatures(data.commercial_flights, 10) : []);
    setGeo('private-fl', activeLayers.private ? toFeatures(data.private_flights, 2) : []);
    setGeo('jets', activeLayers.jets ? toFeatures(data.private_jets, 2) : []);
    setGeo('military', activeLayers.military ? toFeatures(data.military_flights) : []);
    setGeo('military-activity', (activeLayers as any).military_activity && data.military_activity
      ? data.military_activity.map((cell: any) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [cell.lng, cell.lat] },
          properties: {
            level: cell.level,
            activity: cell.activity,
            approximate_count: cell.approximate_count,
            cell_degrees: cell.cell_degrees,
            precision: cell.precision,
          },
        }))
      : []);
  }, [mapReady, data.commercial_flights, data.private_flights, data.private_jets, data.military_flights, data.military_activity, activeLayers.flights, activeLayers.private, activeLayers.jets, activeLayers.military, (activeLayers as any).military_activity, setGeo]);

  /**
   * Pull the palette out of the document whenever it can have changed.
   *
   * Two triggers, and they need different timing. The Style Studio writes the
   * properties and then dispatches, so reading straight away is correct. A
   * theme switch flips a class on <body> from an effect in the page component
   * — a parent, so it runs *after* this one — and reading now would return the
   * outgoing theme. The extra frame covers that case.
   */
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.body);
      const next = readMapPalette(name => cs.getPropertyValue(name));
      setPalette(prev => (MAP_PALETTE_KEYS.every(k => prev[k] === next[k]) ? prev : next));
    };
    read();
    const raf = requestAnimationFrame(read);
    window.addEventListener(STYLE_EVENT, read);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener(STYLE_EVENT, read);
    };
  }, [theme]);

    // Update aircraft icon colors dynamically on theme switch
    useEffect(() => {
      if (!mapReady || !mapRef.current) return;
      const map = mapRef.current;

      const updateMapIcon = (id: string, color: string, size: number) => {
        if (!map.hasImage(id)) return;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2, cy = size / 2;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = Math.max(1, size * 0.055);
    ctx.shadowColor = 'rgba(0,0,0,0.72)';
    ctx.shadowBlur = Math.max(2, size * 0.14);
    ctx.shadowOffsetY = 1;
    ctx.beginPath();
        ctx.moveTo(cx, cy - size * 0.4);
        ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
        ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
        ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
        ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
        ctx.lineTo(cx, cy + size * 0.35);
        ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
        ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
        ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
        ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();
        map.updateImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
      };

      updateMapIcon('plane-cyan', palette.flightCivil, 24);
      updateMapIcon('plane-green', palette.flightPrivate, 24);
      updateMapIcon('plane-pink', palette.flightGov, 24);
      updateMapIcon('plane-red', palette.flightMilitary, 24);
      updateMapIcon('plane-grey', palette.flightUnknown, 24);
    }, [mapReady, palette]);

    /* Cameras are circles and a label, so no image to rebuild — the colour is
       a paint property on each. */
    useEffect(() => {
      if (!mapReady || !mapRef.current) return;
      const map = mapRef.current;
      if (map.getLayer('cctv-dots')) map.setPaintProperty('cctv-dots', 'circle-color', palette.cctv);
      if (map.getLayer('cctv-label')) map.setPaintProperty('cctv-label', 'text-color', palette.cctv);
    }, [mapReady, palette.cctv]);

  // ── DECOUPLED LAYER RENDERERS (Performance Optimized) ──

  useEffect(() => {
    if (!mapReady) return;
    setGeo('earthquakes', activeLayers.earthquakes && data.earthquakes ? data.earthquakes.map((eq: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [eq.lng, eq.lat] }, properties: { id: eq.id, magnitude: eq.magnitude, place: eq.place, depth: eq.depth, source: eq.source } })) : []);
  }, [mapReady, data.earthquakes, activeLayers.earthquakes, setGeo]);

  /** Catalogue rows -> the packed form the 3D layer draws. */
  const toSatPoints = useCallback((rows: SatelliteRow[]): SatPoint[] => rows.map((s) => ({
    lng: s.lng,
    lat: s.lat,
    altKm: s.alt,
    color: parseColor(satColorFor(s.category, s.color, palette)),
    // Stations are the ones an operator is usually looking for, so they get
    // to be findable in a field of several hundred identical dots.
    size: s.category === 'science' || /ISS|TIANGONG/i.test(s.name || '') ? 2.2 : 1,
  })), [palette]);

  /**
   * Re-points the selection at the same satellite after a refresh.
   *
   * pick() returns an index into the last setPoints() array, and every poll
   * rebuilds that array — a filtered one changes length as well as order. Left
   * as a bare index the highlight ring quietly slides onto whichever satellite
   * now sits at that slot, taking the readout with it.
   */
  const resyncSatSelection = useCallback((rows: SatelliteRow[]) => {
    const id = satSelectedIdRef.current;
    if (!id) return;
    const i = rows.findIndex(r => r.noradId === id);
    // Filtered out, or gone from the catalogue: there is nothing to point at.
    if (i < 0) { clearSat(); return; }
    satPickedRef.current = i;
    satLayerRef.current?.setSelected(i);
    // The satellite has moved since it was clicked; the readout should say where
    // it is now, not where it was.
    setSelectedSat(prev => (prev ? { ...prev, lat: rows[i].lat, lng: rows[i].lng, alt: rows[i].alt } : prev));
  }, [clearSat]);

  useEffect(() => {
    if (!mapReady) return;
    const sats = data.satellites || [];
    const al = activeLayers as any;
    const at = Date.parse(data.satellites_at ?? '');
    satEpochRef.current = Number.isFinite(at) ? at : null;

    // If 'All Satellites' is on, show everything
    if (al.satellites) {
      setGeo('satellites', sats.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, color: satColorFor(s.category, s.color, palette), mission: s.mission, alt: s.alt, noradId: s.noradId, category: s.category } })));
      satRowsRef.current = sats;
      satLayerRef.current?.setPoints(toSatPoints(sats));
      resyncSatSelection(sats);
      return;
    }

    // Otherwise filter by enabled sub-layers
    const enabledCategories: string[] = [];
    if (al.sat_comms) enabledCategories.push('comms');
    if (al.sat_military) enabledCategories.push('military');
    if (al.sat_navigation) enabledCategories.push('navigation');
    if (al.sat_earth) enabledCategories.push('earth_obs');
    if (al.sat_science) enabledCategories.push('science');

    if (enabledCategories.length === 0) {
      setGeo('satellites', []);
      satRowsRef.current = [];
      satLayerRef.current?.setPoints([]);
      clearSat();
      return;
    }

    const filtered = sats.filter((s: any) => enabledCategories.includes(s.category));
    setGeo('satellites', filtered.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, color: satColorFor(s.category, s.color, palette), mission: s.mission, alt: s.alt, noradId: s.noradId, category: s.category } })));
    satRowsRef.current = filtered;
    satLayerRef.current?.setPoints(toSatPoints(filtered));
    resyncSatSelection(filtered);
  }, [mapReady, data.satellites, activeLayers.satellites, (activeLayers as any).sat_comms, (activeLayers as any).sat_military, (activeLayers as any).sat_navigation, (activeLayers as any).sat_earth, (activeLayers as any).sat_science, data.satellites_at, setGeo, toSatPoints, resyncSatSelection, clearSat]);

  useEffect(() => {
    if (!mapReady) return;
    // url has to travel with the feature: /api/gdelt gives every event its own
    // GDACS report link, and dropping it here is what left the popup with
    // nothing to link to.
    setGeo('gdelt', activeLayers.global_incidents && data.gdelt ? data.gdelt.map((e: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.lng, e.lat] }, properties: { name: e.name, url: e.url, kind: e.type } })) : []);
  }, [mapReady, data.gdelt, activeLayers.global_incidents, setGeo]);

  /* ── GDELT 2.0 Events ── */
  useEffect(() => {
    if (!mapReady) return;
    const al = activeLayers as any;
    setGeo('gdelt-events', al.gdelt_events && data.gdelt_events ? data.gdelt_events.map((e: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      properties: {
        name: e.name, country: e.country, quad: e.quad, quad_label: e.quad_label,
        event_code: e.event_code, root_code: e.root_code, event_category: e.event_category,
        event_label_ar: e.event_label_ar, corroboration: e.corroboration, precision: e.precision,
        tone: e.tone, goldstein: e.goldstein, articles: e.articles, sources: e.sources, url: e.url, date: e.date,
      },
    })) : []);
  }, [mapReady, data.gdelt_events, (activeLayers as any).gdelt_events, setGeo]);

  /* ── Cloudflare Radar: outages ── */
  useEffect(() => {
    if (!mapReady) return;
    const al = activeLayers as any;
    setGeo('cf-outages', al.cf_outages && data.cf_outages ? data.cf_outages.map((o: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [o.lng, o.lat] },
      properties: {
        country: o.country, country_name: o.country_name, scope: o.scope, cause: o.cause,
        event_type: o.event_type, description: o.description, start: o.start, end: o.end,
        ongoing: !!o.ongoing, url: o.url,
      },
    })) : []);
  }, [mapReady, data.cf_outages, (activeLayers as any).cf_outages, setGeo]);

  /* ── Cloudflare Radar: attack origins ── */
  useEffect(() => {
    if (!mapReady) return;
    const al = activeLayers as any;
    setGeo('cf-attacks', al.cf_attacks && data.cf_attack_origins ? data.cf_attack_origins.map((a: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: { country: a.country, country_name: a.country_name, share: a.share },
    })) : []);
  }, [mapReady, data.cf_attack_origins, (activeLayers as any).cf_attacks, setGeo]);

  // Malware Threats
  useEffect(() => {
    if (!mapReady) return;
    setGeo('malware-nodes', activeLayers.malware && data.malware_threats ? data.malware_threats.map((t: any) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
      properties: {
        ip: t.ip, malware: t.malware, status: t.status, threat_type: t.threat_type,
        country: t.country, city: t.city, port: t.port,
        asn: t.asn, as_name: t.as_name,
        // How many live malicious URLs this host serves — the dot is sized by
        // it, so a box distributing forty payloads reads bigger than one.
        url_count: t.url_count ?? 1,
        first_seen: t.first_seen, last_seen: t.last_seen,
        reference: t.reference, reporter: t.reporter,
        detected_at: t.detected_at ?? 0,
      },
    })) : []);
  }, [mapReady, data.malware_threats, activeLayers.malware, setGeo]);

  /* Detections that landed while the operator was watching get a ring for a
     minute. Without it a pushed feed is indistinguishable from a static one —
     nodes simply appear, and the thing that makes it live goes unseen. */
  useEffect(() => {
    if (!mapReady || !mapRef.current || !activeLayers.malware) return;
    const map = mapRef.current;

    /* Arrivals are rare — a handful an hour — so the common case is that there
       is nothing to draw. Tracking whether the last tick drew anything keeps
       this from pushing an empty collection into the source five times a
       second for the entire time the layer is on. */
    let drawing = false;

    const tick = () => {
      const now = Date.now();
      const beacons = arrivalBeacons(data.malware_threats ?? [], now);

      if (beacons.length === 0) {
        if (drawing) { setGeo('malware-new', []); drawing = false; }
        return;
      }

      setGeo('malware-new', beacons.map(b => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [b.lng, b.lat] },
        properties: { age: b.age },
      })));
      drawing = true;

      try {
        // One shared pulse, so the ring reads as a beacon rather than each
        // node breathing on its own schedule.
        map.setPaintProperty('malware-new-ring', 'circle-radius',
          ['interpolate', ['linear'], ['get', 'age'], 0, 6 + Math.sin(now / 200) * 2, 1, 26]);
      } catch { /* style not settled yet */ }
    };

    tick();
    const timer = setInterval(tick, 200);
    return () => { clearInterval(timer); setGeo('malware-new', []); };
  }, [mapReady, data.malware_threats, activeLayers.malware, setGeo]);

  // Network Mesh Generation (Nearest Neighbor Lattice)
  useEffect(() => {
    if (!mapReady) return;
    const meshLinks: any[] = [];

    // Generate Malware Botnet Mesh
    if (activeLayers.malware && data.malware_threats && data.malware_threats.length > 1) {
      const nodes = data.malware_threats;
      for (let i = 0; i < nodes.length; i++) {
        // Connect each to next 2 for a global web
        for (let j = 1; j <= 2; j++) {
          const target = nodes[(i + j) % nodes.length];
          meshLinks.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [[nodes[i].lng, nodes[i].lat], [target.lng, target.lat]] },
            properties: { threat_type: 'malware' }
          });
        }
      }
    }
    setGeo('network-mesh', meshLinks);
  }, [mapReady, activeLayers.malware, data.malware_threats, setGeo]);

  // ══ LIVE CYBER ATTACKS — Threat network with real-time flow animation ══
  const cyberAnimRef = useRef<number>(0);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const al = activeLayers as any;
    const attacks = data.cyber_attacks;

    // Clean up when toggled off or no data
    if (!al.cyber_attacks || !attacks?.length) {
      cancelAnimationFrame(cyberAnimRef.current);
      setGeo('cyber-arcs', []);
      setGeo('cyber-heads', []);
      setGeo('cyber-impacts', []);
      return;
    }

    // Build static GeoJSON features (dots stay clickable)
    const dots: any[] = [];
    const srcGlows: any[] = [];
    const lines: any[] = [];

    for (const a of attacks) {
      dots.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [a.dst_lng, a.dst_lat] },
        properties: {
          malware: a.malware, action: a.action, target_ip: a.target_ip,
          target_country: a.target_country, port: a.port, severity: a.severity,
          status: a.status,
          src_lat: a.src_lat.toFixed(2), src_lng: a.src_lng.toFixed(2),
          dst_lat: a.dst_lat.toFixed(2), dst_lng: a.dst_lng.toFixed(2),
        },
      });
      srcGlows.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [a.src_lng, a.src_lat] },
        properties: { severity: a.severity },
      });
      lines.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[a.src_lng, a.src_lat], [a.dst_lng, a.dst_lat]] },
        properties: { malware: a.malware, severity: a.severity },
      });
    }

    setGeo('cyber-heads', dots);
    setGeo('cyber-impacts', srcGlows);
    setGeo('cyber-arcs', lines);

    // Animate: aggressive marching-ants with fast dash cycling
    const map = mapRef.current;
    let step = 0;
    function animateFlow() {
      step++;
      if (!map) return;
      try {
        // Fast cycling dash pattern — creates visible movement along the line
        const phase = (step * 0.15) % 6;
        map.setPaintProperty('cyber-arcs-flow', 'line-dasharray', [2, 3 + phase * 0.4]);

        // Alternate opacity on the core line for flicker effect
        const coreFlicker = 0.55 + Math.sin(step * 0.05) * 0.15;
        map.setPaintProperty('cyber-arcs-core', 'line-opacity', coreFlicker);

        // Pulse target dots — breathing black nodes
        const pulse = 1.5 + Math.sin(step * 0.1) * 0.6;
        map.setPaintProperty('cyber-heads', 'circle-stroke-width', pulse);
        map.setPaintProperty('cyber-heads', 'circle-stroke-color',
          step % 30 < 15 ? '#222222' : '#444444'
        );

        // Pulse source glow — dark breathing aura
        const glowPulse = 0.06 + Math.sin(step * 0.07) * 0.04;
        map.setPaintProperty('cyber-impacts', 'circle-opacity', glowPulse);
      } catch {}
      cyberAnimRef.current = requestAnimationFrame(animateFlow);
    }
    cyberAnimRef.current = requestAnimationFrame(animateFlow);

    return () => cancelAnimationFrame(cyberAnimRef.current);
  }, [mapReady, (activeLayers as any).cyber_attacks, data.cyber_attacks, setGeo]);



  useEffect(() => {
    if (!mapReady) return;
    setGeo('cctv', activeLayers.cctv && data.cameras ? data.cameras.map((c: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { id: c.id, name: c.name, city: c.city, country: c.country, source: c.source, feed_url: c.feed_url, stream_url: c.stream_url, stream_type: c.stream_type, external_url: c.external_url } })) : []);
  }, [mapReady, data.cameras, activeLayers.cctv, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('fires', activeLayers.fires && data.fires ? data.fires.map((f: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, properties: { brightness: f.brightness } })) : []);
  }, [mapReady, data.fires, activeLayers.fires, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('weather', activeLayers.weather && data.weather_events ? data.weather_events.map((w: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [w.lng, w.lat] }, properties: { title: w.title, type: w.type, icon: w.icon, severity: w.severity, source: w.source, id: w.id } })) : []);
  }, [mapReady, data.weather_events, activeLayers.weather, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('infrastructure', activeLayers.infrastructure && data.infrastructure ? data.infrastructure.map((i: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [i.lng, i.lat] }, properties: { name: i.name, city: i.city, country: i.country, status: i.status, reactors: i.reactors, capacityMW: i.capacityMW, owner: i.owner, sourceUrl: i.sourceUrl ?? null } })) : []);
  }, [mapReady, data.infrastructure, activeLayers.infrastructure, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('maritime', activeLayers.maritime && data.maritime_ports ? data.maritime_ports.map((p: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { name: p.name, country: p.country, type: p.type, volume: p.volume, fleet: p.fleet, rank: p.rank } })) : []);
    setGeo('maritime-choke', activeLayers.maritime && data.maritime_chokepoints ? data.maritime_chokepoints.map((c: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { name: c.name, traffic: c.traffic, risk: c.risk } })) : []);
    setGeo('maritime-ships', activeLayers.maritime && data.maritime_ships ? data.maritime_ships.map((s: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name || s.mmsi?.toString(), type: s.type || 'cargo', speed: s.speed, heading: s.heading, destination: s.destination, flag: s.flag } })) : []);
  }, [mapReady, data.maritime_ports, data.maritime_chokepoints, data.maritime_ships, activeLayers.maritime, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('balloons', activeLayers.balloons && data.balloons ? data.balloons.map((b: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [b.lng, b.lat] }, properties: { callsign: b.callsign, type: b.type, status: b.status, altitude: b.altitude, speed: b.speed, verticalRate: b.verticalRate, temperature: b.temperature, color: b.color } })) : []);
  }, [mapReady, data.balloons, activeLayers.balloons, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('radiation', activeLayers.radiation && data.radiation ? data.radiation.map((r: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lng, r.lat] }, properties: { name: r.name, city: r.city, country: r.country, reading: r.reading, status: r.status, network: r.network } })) : []);
  }, [mapReady, data.radiation, activeLayers.radiation, setGeo]);

  // ══ M3TM.WORLD SDK — Lattice Sensor Mesh ══
  // Uses real submarine cable data for SEA domain, curated routes for AIR/INTEL
  useEffect(() => {
    if (!mapReady) return;
    setGeo('sdk-entities', Array.isArray(data.sdk_entities) ? data.sdk_entities : []);

    const anySDK = activeLayers.sdk_sea || activeLayers.sdk_air || activeLayers.sdk_naval;
    if (!anySDK) {
      setGeo('sdk-links', []);
      return;
    }

    const links: any[] = [];

    // ── SEA DOMAIN: Real submarine cable data (1-for-1 Match) ──
    // Accept cable data from either the legacy submarine_cables key
    // (populated by the standalone cables toggle) or the new
    // sdk_sea_cables key (populated when sdk_sea is toggled on).
    const cableData = (data.submarine_cables?.length ? data.submarine_cables : data.sdk_sea_cables?.length ? data.sdk_sea_cables : null);
    if (activeLayers.sdk_sea && cableData) {
      const ignoredColors = new Set(['#9BB5CC', '#A0B8CD', '#8EABC2', '#9bb5cc', '#a0b8cd', '#8eabc2']);
      for (const cable of cableData) {
        if (!cable.geometry) continue;

        // Remove the light blue background arcs
        if (cable.properties?.color && ignoredColors.has(cable.properties.color)) continue;

        links.push({
          type: 'Feature',
          geometry: cable.geometry, // Raw topographic paths exactly from Submarine Map
          properties: {
            domain: 'SEA',
            fromName: cable.properties?.name || 'Submarine Cable',
            toName: cable.properties?.landing_points || '',
            source: 'Global Subsea Cable Network',
            url: 'https://www.submarinecablemap.com/',
            ...cable.properties,
            color: '#1976D2', // Darker blue as requested, with extra transparency in layer paint
          },
        });
      }
    }

    setGeo('sdk-links', links);
  }, [mapReady, activeLayers.sdk_sea, activeLayers.sdk_air, activeLayers.sdk_naval, data.submarine_cables, data.sdk_sea_cables, data.sdk_entities, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('live-news', activeLayers.live_news && data.live_feeds ? data.live_feeds.map((f: any) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, properties: { bridge_id: f.bridge_id || '', name: f.name, city: f.city, country: f.country, url: f.url, category: f.category, embed_allowed: f.embed_allowed !== false } })) : []);
  }, [mapReady, data.live_feeds, activeLayers.live_news, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const bridgeRoutes = (activeLayers as any).reported_routes && data.live_feeds
      ? data.live_feeds.flatMap((f: any) => {
          const originLat = Number(f.origin_lat);
          const originLng = Number(f.origin_lng);
          const targetLat = Number(f.lat);
          const targetLng = Number(f.lng);
          if (f.route_status !== 'verified' || ![originLat, originLng, targetLat, targetLng].every(Number.isFinite)) return [];
          return [{
            type: 'Feature' as const,
            geometry: buildAntimeridianSafeLine(originLng, originLat, targetLng, targetLat),
            properties: { bridge_id: f.bridge_id || '', name: f.name || 'مسار حدث منشور', source: f.country || '', route_status: 'verified', route_kind: 'published-evidence-route', not_trajectory: true },
          }];
        })
      : [];
    const gdeltRoutes = (activeLayers as any).reported_routes && Array.isArray(data.reported_routes)
      ? data.reported_routes.flatMap((route: Record<string, unknown>) => {
          const originLat = Number(route.origin_lat);
          const originLng = Number(route.origin_lng);
          const targetLat = Number(route.target_lat);
          const targetLng = Number(route.target_lng);
          if (![originLat, originLng, targetLat, targetLng].every(Number.isFinite)) return [];
          return [{
            type: 'Feature' as const,
            geometry: buildAntimeridianSafeLine(originLng, originLat, targetLng, targetLat),
            properties: {
              bridge_id: route.id || '',
              name: `${route.origin_label || 'موقع منشور'} ← ${route.target_label || 'حدث منشور'}`,
              source: 'GDELT',
              source_url: route.source_url || '',
              route_status: 'reported',
              route_kind: route.route_kind || 'public-event-link',
              precision: route.precision || 'generalized-0.25deg',
              not_trajectory: true,
            },
          }];
        })
      : [];
    setGeo('reported-routes', [...bridgeRoutes, ...gdeltRoutes]);
  }, [mapReady, data.live_feeds, data.reported_routes, (activeLayers as any).reported_routes, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    const safeCollection = data.frontlines?.type === 'FeatureCollection' && Array.isArray(data.frontlines.features)
      ? data.frontlines
      : EMPTY_FC;
    setGeo('frontlines', (activeLayers as any).frontlines ? safeCollection : EMPTY_FC);
  }, [mapReady, data.frontlines, (activeLayers as any).frontlines, setGeo]);


  useEffect(() => {
    if (!mapReady) return;
    // 🔴 CONFLICT ZONES - Live from /api/conflicts 🔴
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/conflicts');
        if (cancelled) return;
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const conflictData = await res.json();
        if (cancelled) return;

        // Zone anchor markers (war/high/elevated labels)
        const zoneFeatures = (conflictData.zones || []).map((z: any) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [z.lng, z.lat] },
          properties: {
            kind: 'zone',
            label: z.labelAr || z.label,
            severity: z.severity,
            description: `${z.descriptionAr || z.description}${z.eventCount > 0 ? ` · ${z.eventCount} بلاغ حديث` : ''}`,
            sourceUrl: z.sourceUrl,
            eventCount: z.eventCount,
          },
        }));

        // Individual live conflict events (scatter dots across conflict zones)
        const eventFeatures = (conflictData.liveEvents || [])
          .filter((e: any) => e.lat && e.lng)
          .map((e: any) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] },
            properties: {
              kind: 'event',
              label: e.title || 'حدث نزاع مُبلّغ عنه',
              severity: e.type === 'aerial_attack' || e.type === 'mass_violence' ? 'war' : 'high',
              description: `${e.location || 'موقع منشور'} · ${e.sources || 0} مصادر · ${e.articles || 0} مقالات · ${e.precision === 'generalized-0.25deg' ? 'موقع عام مُعمّم' : 'موقع منشور'}`,
              sourceUrl: e.url || '',
              eventCategory: e.type || 'material_conflict',
              corroboration: e.corroboration || 'single-source-report',
              eventCode: e.eventCode || '',
            },
          }));

        setGeo('conflict-zones', [...zoneFeatures, ...eventFeatures]);
      } catch (e) {
        // Fallback: if API fails, use minimal known zones
        const FALLBACK_ZONES = [
          { label: 'الحرب في أوكرانيا', severity: 'war', lat: 48.5, lng: 31.2, description: 'منطقة نزاع مسلح مستمر وفق المصادر العامة.', sourceUrl: 'https://liveuamap.com/' },
          { label: 'نزاع غزة', severity: 'war', lat: 31.35, lng: 34.35, description: 'منطقة نزاع وأزمة إنسانية وفق المصادر العامة.', sourceUrl: 'https://israelpalestine.liveuamap.com/' },
          { label: 'الحرب في السودان', severity: 'war', lat: 15.0, lng: 30.0, description: 'نزاع مسلح مستمر وفق المصادر العامة.', sourceUrl: 'https://sudan.liveuamap.com/' },
          { label: 'نزاع اليمن', severity: 'war', lat: 15.5, lng: 48.0, description: 'نزاع مستمر ومخاطر إقليمية وبحرية وفق المصادر العامة.', sourceUrl: 'https://yemen.liveuamap.com/' },
          { label: 'نزاع ميانمار', severity: 'war', lat: 19.5, lng: 96.5, description: 'نزاع داخلي مستمر وفق المصادر العامة.', sourceUrl: 'https://myanmar.liveuamap.com/' },
          { label: 'نزاع سوريا', severity: 'high', lat: 35.0, lng: 38.5, description: 'نزاع داخلي وبلاغات أمنية متفرقة وفق المصادر العامة.', sourceUrl: 'https://syria.liveuamap.com/' },
        ];
        const fallbackFeatures = FALLBACK_ZONES.map(z => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [z.lng, z.lat] },
          properties: { kind: 'zone', label: z.label, severity: z.severity, description: z.description, sourceUrl: z.sourceUrl },
        }));
        setGeo('conflict-zones', fallbackFeatures);
      }
    })();
    return () => { cancelled = true; };
  }, [mapReady, setGeo]);

  // Page-level polling keeps the same conflict source fresh after initial map
  // load. The map's own request above remains the cold-load fallback.
  useEffect(() => {
    if (!mapReady || !Array.isArray(data.conflict_zones)) return;
    const zones = data.conflict_zones.map((z: any) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [z.lng, z.lat] },
      properties: {
        kind: 'zone',
        label: z.labelAr || z.label,
        severity: z.severity,
        description: `${z.descriptionAr || z.description || ''}${z.eventCount > 0 ? ` · ${z.eventCount} بلاغ حديث` : ''}`,
        sourceUrl: z.sourceUrl || '',
        eventCount: z.eventCount || 0,
      },
    }));
    const events = (data.conflict_live_events || [])
      .filter((e: any) => Number.isFinite(Number(e.lat)) && Number.isFinite(Number(e.lng)))
      .map((e: any) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [Number(e.lng), Number(e.lat)] },
        properties: {
          kind: 'event',
          label: e.title || 'حدث نزاع مُبلّغ عنه',
          severity: e.type === 'aerial_attack' || e.type === 'mass_violence' ? 'war' : 'high',
          description: `${e.location || 'موقع منشور'} · ${e.sources || 0} مصادر · ${e.articles || 0} مقالات · ${e.precision === 'generalized-0.25deg' ? 'موقع عام مُعمّم' : 'موقع منشور'}`,
          sourceUrl: e.url || '',
          eventCategory: e.type || 'material_conflict',
          corroboration: e.corroboration || 'single-source-report',
          eventCode: e.eventCode || '',
        },
      }));
    setGeo('conflict-zones', [...zones, ...events]);
  }, [mapReady, data.conflict_zones, data.conflict_live_events, setGeo]);


  // Visibility
  useEffect(() => {
    if (!mapReady) return;
    setVis(['eq-circles','eq-label'], activeLayers.earthquakes);
    const anySat = activeLayers.satellites || (activeLayers as any).sat_comms || (activeLayers as any).sat_military || (activeLayers as any).sat_navigation || (activeLayers as any).sat_earth || (activeLayers as any).sat_science;
    // The circle layers stay hidden whatever the toggles say — the 3D layer
    // is the single representation, and showing both drew every satellite
    // twice, once flat on the ground and once at altitude.
    setVis(['sat-glow','sat-dots'], false);
    // Clearing the 3D layer is what actually turns satellites off.
    if (!anySat) { satRowsRef.current = []; satLayerRef.current?.setPoints([]); }
    setVis(['gdelt-dots'], activeLayers.global_incidents);
    setVis(['gdelt-events-dots'], (activeLayers as any).gdelt_events);
    setVis(['cf-outage-halo','cf-outage-dots','cf-outage-label'], (activeLayers as any).cf_outages);
    setVis(['cf-attack-dots','cf-attack-label'], (activeLayers as any).cf_attacks);

    setVis(['malware-glow','malware-dots','malware-label','malware-new-ring'], activeLayers.malware);
    setVis(['network-mesh-atmo', 'network-mesh-glow', 'network-mesh-core'], activeLayers.internet_outages || activeLayers.malware);
    setVis(['cyber-arcs-atmo','cyber-arcs-glow','cyber-arcs-core','cyber-arcs-flow','cyber-heads','cyber-impacts','cyber-labels'], (activeLayers as any).cyber_attacks);
    setVis(['day-night-fill'], activeLayers.day_night);
    setVis(['fl-commercial-halo','fl-commercial'], activeLayers.flights);
    setVis(['fl-private-halo','fl-private'], activeLayers.private);
    setVis(['fl-jets-halo','fl-jets'], activeLayers.jets);
    setVis(['fl-military-halo','fl-military'], activeLayers.military);
    setVis(['military-activity-halo','military-activity-dots','military-activity-label'], (activeLayers as any).military_activity);
    setVis(['cctv-glow','cctv-dots','cctv-label'], activeLayers.cctv);
    setVis(['fires-heat'], activeLayers.fires);
    setVis(['weather-glow','weather-dots','weather-label'], activeLayers.weather);
    setVis(['infra-glow','infra-dots','infra-label'], activeLayers.infrastructure);
    setVis(['maritime-glow','maritime-dots','maritime-label'], activeLayers.maritime);
    setVis(['choke-glow','choke-dots','choke-label'], activeLayers.maritime);
    setVis(['ship-dots','ship-label'], activeLayers.maritime);
    setVis(['news-glow','news-dots','news-label'], activeLayers.live_news);
    setVis(['conflict-zone-halo','conflict-event-dots','conflict-icons'], activeLayers.conflict_zones !== false);
    setVis(['reported-routes-halo','reported-routes-core'], (activeLayers as any).reported_routes);
    setVis(['frontlines-fill','frontlines-line'], (activeLayers as any).frontlines);

    setVis(['balloon-dots','balloon-label'], activeLayers.balloons);
    setVis(['rad-glow','rad-dots','rad-label'], activeLayers.radiation);
    setVis(['sdk-sea','sdk-sea-glow','sdk-sea-atmo','sdk-sea-nodes'], activeLayers.sdk_sea !== false);
    setVis(['sdk-air','sdk-air-glow','sdk-air-atmo','sdk-air-nodes'], activeLayers.sdk_air !== false);
    setVis(['sdk-intel','sdk-intel-glow','sdk-intel-atmo','sdk-intel-nodes'], activeLayers.sdk_naval !== false);
    // Sweep layers always visible when data is present (controlled by useEffect)
    setVis(['sweep-connections','sweep-pulse-ring','sweep-device-glow','sweep-device-dots','sweep-device-labels'], true);
  }, [mapReady, activeLayers, setVis]);

  // IP Sweep visualization
  useEffect(() => {
    if (!mapReady) return;
    if (!sweepData?.devices?.length) {
      setGeo('ip-sweep-devices', []);
      setGeo('ip-sweep-pulse', []);
      setGeo('ip-sweep-connections', []);
      return;
    }

    const map = mapRef.current;
    if (!map) return;

    const { center, devices } = sweepData;
    const centerCoord: [number, number] = [center.lng, center.lat];

    // Switch to globe and fly to the sweep location
    try {
      applyMapProjection(map, 'globe');
      map.setSky({ 'sky-color': '#0A0A0F', 'sky-horizon-blend': 0.02, 'horizon-color': '#0A0A0F', 'horizon-fog-blend': 0.02 });
    } catch { /* projection may not be supported */ }

    map.flyTo({ center: centerCoord, zoom: 14, pitch: 50, bearing: -20, duration: 3000, essential: true });

    // Set center pulse
    setGeo('ip-sweep-pulse', [{
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: centerCoord },
      properties: { ip: sweepData.target_ip },
    }]);

    // Build device features spread in a circle around center
    const allDeviceFeatures = devices.map((d: any, i: number) => {
      const angle = (i / devices.length) * Math.PI * 2;
      const radius = 0.001 + ((i % 7 + 1) * 0.0004);
      const dLng = centerCoord[0] + Math.cos(angle) * radius * (1 / Math.cos(center.lat * Math.PI / 180));
      const dLat = centerCoord[1] + Math.sin(angle) * radius;
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [dLng, dLat] },
        properties: {
          ip: d.ip, device_type: d.device_type, device_icon: d.device_icon,
          color: d.device_color, risk_level: d.risk_level,
          ports: JSON.stringify(d.ports), hostnames: JSON.stringify(d.hostnames),
          vulns: JSON.stringify(d.vulns), cpes: JSON.stringify(d.cpes), tags: JSON.stringify(d.tags),
        },
      };
    });

    // Connection lines from center to each device
    const connectionFeatures = allDeviceFeatures.map((f: any) => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: [centerCoord, f.geometry.coordinates] },
      properties: { color: f.properties.color },
    }));

    // Stagger the appearance after 3s flyTo completes
    const timer = setTimeout(() => {
      setGeo('ip-sweep-connections', connectionFeatures);
      const batchSize = 5;
      const batches = Math.ceil(allDeviceFeatures.length / batchSize);
      for (let b = 0; b < batches; b++) {
        setTimeout(() => {
          setGeo('ip-sweep-devices', allDeviceFeatures.slice(0, (b + 1) * batchSize));
        }, b * 100);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [mapReady, sweepData, setGeo]);

  // Scan Targets visualization
  useEffect(() => {
    if (!mapReady || !mapRef.current || !scanTargets) return;
    const map = mapRef.current;

    const features = scanTargets.map(t => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [t.lng, t.lat] },
      properties: { ...t }
    }));

    const src = map.getSource('scan-targets') as maplibregl.GeoJSONSource;
    if (src) src.setData({ type: 'FeatureCollection', features });
  }, [scanTargets, mapReady]);

  // Projection changes are independent of terrain. Toggling elevation must not
  // zoom, tilt, or reposition the camera the user has already chosen.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    try {
      const projectionChanged = applyMapProjection(map, projection, terrainEnabled);
      const configureSky = projectionChanged || !containerRef.current?.dataset.mapProjection;
      if (containerRef.current) containerRef.current.dataset.mapProjection = projection;
      if (projection === 'globe') {
        // The overview globe's resting tilt, which used to be the initial
        // pitch. Only on a real projection change, so toggling terrain never
        // re-tilts a camera the user has already placed.
        if (configureSky && map.getPitch() < 0.5) map.easeTo({ pitch: 20, duration: 1200 });
        try {
          if (configureSky) map.setSky({
            'sky-color': '#04040A',
            'sky-horizon-blend': 0.5,
            'horizon-color': '#0a0a1a',
            'horizon-fog-blend': 0.3,
            'fog-color': '#04040A',
            'fog-ground-blend': 0.9,
          });
        } catch (e) { console.warn('[M3TM.WORLD] Suppressed error:', e instanceof Error ? e.message : e); }
      } else {
        if (map.getPitch() > 0.5) map.easeTo({ pitch: 0, duration: 350 });
      }
    } catch (e) {
      console.warn('Projection switch failed:', e);
    }
  }, [mapReady, projection, terrainEnabled]);

  // Terrain loads only at regional zooms; globe overview stays inexpensive.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !terrainEnabled) return;
    const map = mapRef.current;
    installTerrainTileProtocol(maplibregl.addProtocol);
    const dispose = attachTerrain(map, status => onTerrainStatusChange?.(status));
    return () => {
      // The map constructor effect removes the entire map first on unmount.
      if (mapRef.current === map) dispose();
    };
  }, [mapReady, terrainEnabled, terrainRetry, onTerrainStatusChange]);

  // A user-requested close-up keeps the current location and avoids a fly-out arc.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !terrainFocus || !terrainEnabled || lastTerrainFocus.current === terrainFocus) return;
    lastTerrainFocus.current = terrainFocus;
    const map = mapRef.current;
    map.easeTo({ zoom: Math.max(10.5, map.getZoom()), pitch: 45, duration: 650 });
  }, [mapReady, terrainFocus, terrainEnabled]);

  // Fly-to
  useEffect(() => {
    if (!mapReady || !mapRef.current || !flyToLocation) return;
    mapRef.current.flyTo({ center: [flyToLocation.lng, flyToLocation.lat], zoom: flyToLocation.zoom ?? 8, duration: 2000 });
  }, [mapReady, flyToLocation]);

  // 3D buildings are independent of the elevation renderer.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const enabled = activeLayers.terrain_3d;

    try {
      if (enabled) {
        // CARTO's already-loaded vector tiles include the building footprints
        // and render heights. No second worldwide vector source is needed.

        // ── 3D BUILDING EXTRUSION LAYER ──
        if (!map.getLayer('m3tm-3d-buildings')) {
          map.addLayer({
            id: 'm3tm-3d-buildings',
            source: 'carto',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 14.5,
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'render_height'],
                0, '#1a1a2e',
                20, '#16213e',
                50, '#0f3460',
                120, '#533483',
                300, '#e94560',
              ],
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0,
                15.5, ['get', 'render_height']
              ],
              'fill-extrusion-base': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0,
                15.5, ['get', 'render_min_height']
              ],
              'fill-extrusion-opacity': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0,
                15, 0.7,
              ],
            },
          });
        }

        // Pitch the camera to reveal the 3D skyline
        if (map.getPitch() < 40) {
          map.easeTo({ pitch: 50, duration: 1200 });
        }

      } else {
        // ── DISABLE 3D ──
        if (map.getLayer('m3tm-3d-buildings')) map.removeLayer('m3tm-3d-buildings');
      }
    } catch (e) {
      console.warn('[M3TM.WORLD] 3D terrain toggle error:', e);
    }
  }, [mapReady, activeLayers.terrain_3d]);

  // Satellite / Dark style switching
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    try {
      if (mapStyle !== 'dark') {
        // Add satellite raster tiles
        if (!map.getSource('satellite-tiles')) {
          map.addSource('satellite-tiles', {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 18,
          });
        }
        if (!map.getLayer('satellite-layer')) {
          map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', paint: { 'raster-opacity': 0.85 } }, 'day-night-fill');
        } else {
          map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
        }
      } else {
        if (map.getLayer('satellite-layer')) {
          map.setLayoutProperty('satellite-layer', 'visibility', 'none');
        }
      }
    } catch (e) {
      console.warn('Style switch failed:', e);
    }
  }, [mapReady, mapStyle]);

  // ── DRAWN POLYGONS ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const currentPolygons = drawnPolygons || [];
    const currentIds = currentPolygons.map(p => p.id);

    prevDrawnPolygonsRef.current.forEach(id => {
      if (!currentIds.includes(id)) {
        if (map.getLayer(`drawn-polygon-label-${id}`)) map.removeLayer(`drawn-polygon-label-${id}`);
        if (map.getLayer(`drawn-polygon-line-${id}`)) map.removeLayer(`drawn-polygon-line-${id}`);
        if (map.getLayer(`drawn-polygon-fill-${id}`)) map.removeLayer(`drawn-polygon-fill-${id}`);
        if (map.getSource(`drawn-polygon-${id}-label`)) map.removeSource(`drawn-polygon-${id}-label`);
        if (map.getSource(`drawn-polygon-${id}`)) map.removeSource(`drawn-polygon-${id}`);
      }
    });
    prevDrawnPolygonsRef.current = currentIds;

    currentPolygons.forEach(poly => {
      const sourceId = `drawn-polygon-${poly.id}`;
      const fillLayerId = `drawn-polygon-fill-${poly.id}`;
      const lineLayerId = `drawn-polygon-line-${poly.id}`;
      const labelLayerId = `drawn-polygon-label-${poly.id}`;

      // Build a centroid point feature for the label. A Polygon nests its ring
      // one level deeper than a LineString, so the label of a path would sit at
      // 0,0 if both were read the same way.
      const geom: any = poly.geojson.geometry;
      const ring: number[][] = geom?.type === 'LineString' ? (geom.coordinates || []) : (geom?.coordinates?.[0] || []);
      const centroid = ring.length > 0 ? [
        ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length,
        ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length,
      ] : [0, 0];
      const labelFC = { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, properties: { name: poly.name }, geometry: { type: 'Point' as const, coordinates: centroid } }] };

      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: 'geojson', data: poly.geojson });
      } else {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(poly.geojson);
      }
      if (!map.getSource(`${sourceId}-label`)) {
        map.addSource(`${sourceId}-label`, { type: 'geojson', data: labelFC as any });
      } else {
        (map.getSource(`${sourceId}-label`) as maplibregl.GeoJSONSource).setData(labelFC as any);
      }

      if (!map.getLayer(fillLayerId)) {
        map.addLayer({ id: fillLayerId, type: 'fill', source: sourceId, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': poly.color, 'fill-opacity': 0.12 } });
      }
      if (!map.getLayer(lineLayerId)) {
        map.addLayer({ id: lineLayerId, type: 'line', source: sourceId, paint: { 'line-color': poly.color, 'line-width': 2.5, 'line-dasharray': [6, 3] } });
      }
      if (!map.getLayer(labelLayerId)) {
        map.addLayer({ id: labelLayerId, type: 'symbol', source: `${sourceId}-label`, layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': poly.color, 'text-halo-color': '#000000', 'text-halo-width': 2 } });
      }
    });
  }, [mapReady, drawnPolygons]);

  // ── DIRECTIONS ROUTE ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const SRC = 'directions-route';
    const SRC_ALT = 'directions-alternates';
    const SRC_ACTIVE = 'directions-active-step';
    const SRC_ENDS = 'directions-endpoints';
    const IDS = [
      'directions-alt-line', 'directions-line-casing', 'directions-line',
      'directions-active-line', 'directions-endpoint-halo', 'directions-endpoint',
    ];

    const teardown = () => {
      IDS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      [SRC, SRC_ALT, SRC_ACTIVE, SRC_ENDS].forEach(id => { if (map.getSource(id)) map.removeSource(id); });
    };

    if (!route?.geometry?.coordinates?.length) { teardown(); return; }

    const fc = (features: GeoJSON.Feature[]) => ({ type: 'FeatureCollection' as const, features });
    const line = (coords: [number, number][]): GeoJSON.Feature => ({
      type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    });
    const setData = (id: string, data: unknown) => {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: data as never });
      else (map.getSource(id) as maplibregl.GeoJSONSource).setData(data as never);
    };

    setData(SRC, fc([line(route.geometry.coordinates)]));
    setData(SRC_ALT, fc((route.alternates || []).map(a => line(a.coordinates))));
    setData(SRC_ACTIVE, fc(route.activeSegment?.length ? [line(route.activeSegment)] : []));
    setData(SRC_ENDS, fc([
      { type: 'Feature', properties: { kind: 'origin' }, geometry: { type: 'Point', coordinates: [route.from.lng, route.from.lat] } },
      { type: 'Feature', properties: { kind: 'destination' }, geometry: { type: 'Point', coordinates: [route.to.lng, route.to.lat] } },
    ]));

    // Alternatives sit underneath, muted, so the chosen line stays unambiguous.
    if (!map.getLayer('directions-alt-line')) {
      map.addLayer({
        id: 'directions-alt-line', type: 'line', source: SRC_ALT,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#5C6470',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 14, 5],
          'line-opacity': 0.55,
        },
      });
    }
    if (!map.getLayer('directions-line-casing')) {
      map.addLayer({
        id: 'directions-line-casing', type: 'line', source: SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#001014', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 5, 14, 11], 'line-opacity': 0.9 },
      });
    }
    if (!map.getLayer('directions-line')) {
      map.addLayer({
        id: 'directions-line', type: 'line', source: SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#00E5FF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 14, 6],
          'line-opacity': 0.95,
        },
      });
    }
    if (!map.getLayer('directions-active-line')) {
      map.addLayer({
        id: 'directions-active-line', type: 'line', source: SRC_ACTIVE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#D4AF37',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 4, 14, 9],
          'line-opacity': 0.95,
        },
      });
    }
    if (!map.getLayer('directions-endpoint-halo')) {
      map.addLayer({
        id: 'directions-endpoint-halo', type: 'circle', source: SRC_ENDS,
        paint: {
          'circle-radius': 9,
          'circle-color': ['match', ['get', 'kind'], 'origin', '#00FF88', '#FF3B30'],
          'circle-opacity': 0.18,
        },
      });
    }
    if (!map.getLayer('directions-endpoint')) {
      map.addLayer({
        id: 'directions-endpoint', type: 'circle', source: SRC_ENDS,
        paint: {
          'circle-radius': 5,
          'circle-color': ['match', ['get', 'kind'], 'origin', '#00FF88', '#FF3B30'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#001014',
        },
      });
    }
  }, [mapReady, route]);

  // ── ROUTE FRAMING ──
  // Kept apart from drawing so picking a step or an alternative redraws without
  // yanking the camera back out to the whole route.
  const routeFrameKey = route
    ? `${route.from.lat},${route.from.lng},${route.to.lat},${route.to.lng},${route.geometry.coordinates.length}`
    : null;
  useEffect(() => {
    if (!mapReady || !mapRef.current || !route?.geometry?.coordinates?.length) return;
    const coords = route.geometry.coordinates;
    let [west, south, east, north] = [coords[0][0], coords[0][1], coords[0][0], coords[0][1]];
    for (const [lng, lat] of coords) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
    mapRef.current.fitBounds([[west, south], [east, north]], { padding: 90, duration: 900, maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, routeFrameKey]);

  // ── LIVE USER LOCATION ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const SRC = 'user-location';
    const SRC_ACC = 'user-location-accuracy';
    const IDS = ['user-accuracy-fill', 'user-accuracy-line', 'user-dot-pulse', 'user-dot', 'user-dot-core'];

    if (!userLocation) {
      IDS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      [SRC, SRC_ACC].forEach(id => { if (map.getSource(id)) map.removeSource(id); });
      return;
    }

    const { lat, lng, accuracy } = userLocation;

    // Accuracy is a real-world radius, so it must be a polygon in degrees
    // rather than a fixed pixel circle — it has to shrink as you zoom out.
    const ring: [number, number][] = [];
    const r = Math.min(Math.max(accuracy ?? 0, 0), 5000);
    if (r > 0) {
      const dLat = r / 111320;
      const dLng = r / (111320 * Math.cos((lat * Math.PI) / 180) || 1);
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * 2 * Math.PI;
        ring.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
      }
    }

    const point = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } }],
    };
    const accFc = {
      type: 'FeatureCollection',
      features: ring.length
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }]
        : [],
    };

    if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: point as never });
    else (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(point as never);
    if (!map.getSource(SRC_ACC)) map.addSource(SRC_ACC, { type: 'geojson', data: accFc as never });
    else (map.getSource(SRC_ACC) as maplibregl.GeoJSONSource).setData(accFc as never);

    if (!map.getLayer('user-accuracy-fill')) {
      map.addLayer({ id: 'user-accuracy-fill', type: 'fill', source: SRC_ACC, paint: { 'fill-color': '#4285F4', 'fill-opacity': 0.12 } });
    }
    if (!map.getLayer('user-accuracy-line')) {
      map.addLayer({ id: 'user-accuracy-line', type: 'line', source: SRC_ACC, paint: { 'line-color': '#4285F4', 'line-width': 1, 'line-opacity': 0.35 } });
    }
    if (!map.getLayer('user-dot-pulse')) {
      map.addLayer({ id: 'user-dot-pulse', type: 'circle', source: SRC, paint: { 'circle-radius': 8, 'circle-color': '#4285F4', 'circle-opacity': 0.35 } });
    }
    if (!map.getLayer('user-dot')) {
      map.addLayer({ id: 'user-dot', type: 'circle', source: SRC, paint: { 'circle-radius': 7, 'circle-color': '#FFFFFF' } });
    }
    if (!map.getLayer('user-dot-core')) {
      map.addLayer({ id: 'user-dot-core', type: 'circle', source: SRC, paint: { 'circle-radius': 5, 'circle-color': '#4285F4' } });
    }
  }, [mapReady, userLocation]);

  // Pulse the halo. rAF-driven, so it stops when the tab is backgrounded.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !userLocation) return;
    const map = mapRef.current;
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      if (map.getLayer('user-dot-pulse')) {
        const t = ((now - started) % 2000) / 2000;
        map.setPaintProperty('user-dot-pulse', 'circle-radius', 8 + t * 22);
        map.setPaintProperty('user-dot-pulse', 'circle-opacity', 0.35 * (1 - t));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mapReady, userLocation]);

  // ── FOLLOW MODE ──
  useEffect(() => {
    if (!mapReady || !mapRef.current || !followUser) return;
    const map = mapRef.current;
    // originalEvent is only set when a real input device drove the change, so
    // the easeTo below cannot trip this and cancel its own follow.
    const onGesture = (e: any) => { if (e?.originalEvent) onFollowInterrupt?.(); };
    map.on('dragstart', onGesture);
    map.on('zoomstart', onGesture);
    map.on('rotatestart', onGesture);
    map.on('pitchstart', onGesture);
    return () => {
      map.off('dragstart', onGesture);
      map.off('zoomstart', onGesture);
      map.off('rotatestart', onGesture);
      map.off('pitchstart', onGesture);
    };
  }, [mapReady, followUser, onFollowInterrupt]);

  // Recentering runs on every position fix, so without the handover above the
  // map fights the operator: zoom out to look ahead and the next GPS tick drags
  // the camera back to 16.5. Follow itself is unchanged and resumes on recenter.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !followUser || !userLocation) return;
    // While navigating, sit close in and rotate the map so travel direction is
    // "up" — reading a turn off a north-locked map at speed does not work.
    mapRef.current.easeTo({
      center: [userLocation.lng, userLocation.lat],
      ...(navigating
        ? {
            zoom: Math.max(mapRef.current.getZoom(), 16.5),
            pitch: 50,
            ...(typeof userLocation.heading === 'number' && !Number.isNaN(userLocation.heading)
              ? { bearing: userLocation.heading }
              : {}),
          }
        : {}),
      duration: 700,
    });
  }, [mapReady, followUser, userLocation, navigating]);

  // Restore the selected view only when guidance ends, not on first map load.
  useEffect(() => {
    const ended = wasNavigating.current && !navigating;
    wasNavigating.current = navigating;
    if (!mapReady || !mapRef.current || !ended) return;
    const map = mapRef.current;
    const pitch = projection === 'mercator' ? 0 : activeLayers.terrain_3d ? 50 : terrainEnabled && map.getZoom() >= 10 ? 45 : 20;
    map.easeTo({ pitch, bearing: 0, duration: 600 });
  }, [mapReady, navigating, projection, terrainEnabled, activeLayers.terrain_3d]);

  // ── AIRPORTS FOR WATCHED AIRCRAFT ──
  // The endpoints that survived corroboration against the aircraft's reported
  // track — where the leg began and where it is booked to end.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const SRC = 'watched-airports';
    const IDS = ['watched-airport-glow', 'watched-airport-dot', 'watched-airport-label'];

    // The same airport can serve several watched aircraft — draw it once.
    const seen = new Set<string>();
    const features = Object.values(aircraftAirports).flat()
      .filter((a) => {
        if (!a || seen.has(a.icao)) return false;
        seen.add(a.icao);
        return true;
      })
      .map((a) => ({
        type: 'Feature' as const,
        properties: { label: a.iata || a.icao, city: a.city || '' },
        geometry: { type: 'Point' as const, coordinates: [a.lng, a.lat] },
      }));

    if (features.length === 0) {
      IDS.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SRC)) map.removeSource(SRC);
      return;
    }

    const fc = { type: 'FeatureCollection' as const, features };
    if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: fc as never });
    else (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(fc as never);

    if (!map.getLayer('watched-airport-glow')) {
      map.addLayer({
        id: 'watched-airport-glow', type: 'circle', source: SRC,
        paint: { 'circle-radius': 13, 'circle-color': '#FFB300', 'circle-opacity': 0.16, 'circle-blur': 0.8 },
      });
    }
    if (!map.getLayer('watched-airport-dot')) {
      map.addLayer({
        id: 'watched-airport-dot', type: 'circle', source: SRC,
        paint: {
          'circle-radius': 5,
          'circle-color': '#FFFFFF',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFB300',
        },
      });
    }
    if (!map.getLayer('watched-airport-label')) {
      map.addLayer({
        id: 'watched-airport-label', type: 'symbol', source: SRC,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-font': ['Open Sans Bold'],
          'text-offset': [0, 1.6],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#FFB300', 'text-halo-color': '#0C0E1A', 'text-halo-width': 1.5 },
      });
    }
  }, [mapReady, aircraftAirports]);

  // ── ARCGIS LAYERS ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const currentLayers = arcgisLayers || [];
    const currentIds = currentLayers.map(l => l.id);

    prevArcgisLayersRef.current.forEach(id => {
      if (!currentIds.includes(id)) {
        const sourceId = `arcgis-${id}`;
        if (map.getLayer(`${sourceId}-fill`)) map.removeLayer(`${sourceId}-fill`);
        if (map.getLayer(`${sourceId}-line`)) map.removeLayer(`${sourceId}-line`);
        if (map.getLayer(`${sourceId}-circle`)) map.removeLayer(`${sourceId}-circle`);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
    });
    prevArcgisLayersRef.current = currentIds;

    currentLayers.forEach(layer => {
      const sourceId = `arcgis-${layer.id}`;
      const c = layer.color || '#D4AF37';
      const o = layer.opacity ?? 0.8;
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: 'geojson', data: layer.geojson });
        // A fill layer with no geometry filter is applied to LineStrings too,
        // and maplibre fills an open path by closing it — which is what draws
        // the triangular wedges across a pipeline or railway dataset. Fill is
        // only ever meaningful for polygons.
        map.addLayer({ id: `${sourceId}-fill`, type: 'fill', source: sourceId, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': c, 'fill-opacity': o * 0.15, 'fill-outline-color': c } });
        map.addLayer({ id: `${sourceId}-line`, type: 'line', source: sourceId, filter: ['match', ['geometry-type'], ['LineString', 'Polygon'], true, false], paint: { 'line-color': c, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 1.4, 14, 2, 18, 3], 'line-opacity': o } });
        // A fixed radius does not survive a dense dataset: ~1.2k points at
        // city zoom merge into one blob. Scaling with zoom keeps them as
        // discrete stations when you are far out, and readable up close.
        map.addLayer({ id: `${sourceId}-circle`, type: 'circle', source: sourceId, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': c, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 8, 2.5, 11, 4, 14, 6, 18, 9], 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 14, 1.2], 'circle-stroke-color': '#000', 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.55, 12, 0.85] } });
      } else {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(layer.geojson);
        // Update paint properties for color/opacity changes
        if (map.getLayer(`${sourceId}-fill`)) {
          map.setPaintProperty(`${sourceId}-fill`, 'fill-color', c);
          map.setPaintProperty(`${sourceId}-fill`, 'fill-opacity', o * 0.15);
          map.setPaintProperty(`${sourceId}-fill`, 'fill-outline-color', c);
        }
        if (map.getLayer(`${sourceId}-line`)) {
          map.setPaintProperty(`${sourceId}-line`, 'line-color', c);
          map.setPaintProperty(`${sourceId}-line`, 'line-opacity', o);
        }
        if (map.getLayer(`${sourceId}-circle`)) {
          map.setPaintProperty(`${sourceId}-circle`, 'circle-color', c);
          map.setPaintProperty(`${sourceId}-circle`, 'circle-opacity', o);
        }
      }
    });
  }, [mapReady, arcgisLayers]);

  const drawCbRef = useRef({ onDrawComplete, onDrawProgress, onDrawCancel });
  /** Set by the drawing effect so on-screen buttons can dispatch into it. */
  const drawApplyRef = useRef<((a: DrawAction) => void) | null>(null);
  drawCbRef.current = { onDrawComplete, onDrawProgress, onDrawCancel };

  // ── DRAWING MODE ──
  // A four-mode state machine over one set of map handlers.
  //
  // Every mode collects points; what differs is how many are needed and what
  // geometry they produce. Rectangle and circle are two-click shapes, so the
  // cursor stands in for their second point until it is committed — which is
  // what makes the preview and the final shape come from the same code path
  // instead of two that can disagree.
  //
  // Escape cancels, Backspace removes the last vertex, Enter or a double click
  // finishes. Drawing without an undo is the difference between a tool and a
  // demo: a misplaced vertex twenty clicks in should not cost the whole shape.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const SRC = 'draw-temp-source';
    const IDS = ['draw-fill-temp', 'draw-line-temp', 'draw-points-temp'];

    const teardown = () => {
      IDS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SRC)) map.removeSource(SRC);
      drawingCoordsRef.current = [];
      map.getCanvas().style.cursor = '';
      map.doubleClickZoom.enable();
    };

    if (!drawMode) {
      teardown();
      drawCbRef.current.onDrawProgress?.(null);
      return;
    }

    map.doubleClickZoom.disable();
    map.getCanvas().style.cursor = 'crosshair';
    drawingCoordsRef.current = [];

    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'draw-fill-temp', type: 'fill', source: SRC,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#00E5FF', 'fill-opacity': 0.12 },
      });
      map.addLayer({
        id: 'draw-line-temp', type: 'line', source: SRC,
        filter: ['match', ['geometry-type'], ['LineString', 'Polygon'], true, false],
        paint: { 'line-color': '#00E5FF', 'line-width': 2, 'line-dasharray': [3, 2] },
      });
      map.addLayer({
        id: 'draw-points-temp', type: 'circle', source: SRC,
        filter: ['==', ['geometry-type'], 'MultiPoint'],
        paint: { 'circle-color': '#00E5FF', 'circle-radius': 4, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#04040A' },
      });
    }

    // Declared before paint(), which closes over it. Leaving it below would
    // work only while no call happens in between — a temporal-dead-zone crash
    // waiting for someone to add one.
    let state: DrawState = initialDrawState(drawMode);

    /** Redraw the preview from committed points plus an optional cursor point. */
    const paint = (cursor?: [number, number]) => {
      const committed = state.points;
      const pts = cursor ? [...committed, cursor] : committed;
      const src = map.getSource(SRC) as maplibregl.GeoJSONSource;
      if (!src) return;

      drawCbRef.current.onDrawProgress?.(pts.length ? measure(drawMode, pts) : null);

      if (pts.length === 0) {
        src.setData({ type: 'FeatureCollection', features: [] });
        return;
      }

      const features: any[] = [
        { type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: committed } },
      ];

      const geom = buildGeometry(drawMode, pts);
      if (drawMode === 'line') {
        if (pts.length > 1) {
          features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: geom } });
        }
      } else if (geom.length >= 3) {
        // Show the enclosed area as it will be, not just its outline.
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [closeRing(geom)] } });
      } else if (geom.length === 2) {
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: geom } });
      }

      src.setData({ type: 'FeatureCollection', features });
    };

    // The interaction lives in drawReducer, which is unit tested. This is the
    // adapter: map events in, reducer out, preview repainted.
    const apply = (action: DrawAction) => {
      const t = drawReducer(state, action);
      state = t.state;
      drawingCoordsRef.current = state.points;
      if (t.result) drawCbRef.current.onDrawComplete?.(t.result);
      if (t.cancelled) drawCbRef.current.onDrawCancel?.();
      paint();
    };

    let dblGuard = false;

    const onClick = (e: any) => {
      if (dblGuard) return;
      apply({ type: 'click', at: [e.lngLat.lng, e.lngLat.lat] });
    };

    const onMove = (e: any) => {
      if (state.points.length === 0) return;
      paint([e.lngLat.lng, e.lngLat.lat]);
    };

    const onDblClick = (e: any) => {
      e.preventDefault();
      dblGuard = true;
      setTimeout(() => { dblGuard = false; }, 300);
      apply({ type: 'dblclick' });
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.preventDefault(); apply({ type: 'cancel' }); }
      else if (ev.key === 'Backspace' || ev.key === 'Delete') { ev.preventDefault(); apply({ type: 'undo' }); }
      else if (ev.key === 'Enter') { ev.preventDefault(); apply({ type: 'finish' }); }
    };
    drawApplyRef.current = apply;

    map.on('click', onClick);
    map.on('mousemove', onMove);
    map.on('dblclick', onDblClick);
    window.addEventListener('keydown', onKey);

    return () => {
      map.off('click', onClick);
      map.off('mousemove', onMove);
      map.off('dblclick', onDblClick);
      window.removeEventListener('keydown', onKey);
      drawApplyRef.current = null;
      teardown();
    };
  }, [mapReady, drawMode]);

  // Buttons dispatch into the same reducer the map events use, so a shape
  // finished by clicking "Finish" is identical to one finished by Enter.
  const lastCmdSeq = useRef(-1);
  useEffect(() => {
    if (!drawCommand || drawCommand.seq === lastCmdSeq.current) return;
    lastCmdSeq.current = drawCommand.seq;
    drawApplyRef.current?.({ type: drawCommand.action } as DrawAction);
  }, [drawCommand]);

  // ── MAP CENTER REPORTING ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const reportCenter = () => {
      const c = map.getCenter();
      const b = map.getBounds();
      onMapCenter?.({
        lat: c.lat,
        lng: c.lng,
        bounds: b ? { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() } : undefined,
      });
    };

    // Fire immediately so panels get initial coordinates
    reportCenter();

    map.on('moveend', reportCenter);
    return () => { map.off('moveend', reportCenter); };
  }, [mapReady, onMapCenter]);

  // Escape clears the selection, the way it cancels a draw — an overlay that
  // can only be dismissed by hitting a 14px target is one that stays open.
  useEffect(() => {
    if (!selectedSat) return;
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') clearSat(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedSat, clearSat]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {mapReady && mapRef.current && (
        <CctvPreviews
          mapRef={mapRef}
          active={!!activeLayers.cctv && !!activeLayers.cctv_previews}
          onOpen={(cam: PreviewCamera) => onEntityClick?.({ type: 'cctv', ...cam })}
        />
      )}
      {mapReady && (
        <LiveNewsPreviews
          mapRef={mapRef}
          active={!!activeLayers.live_news}
          feeds={data.live_feeds}
          onOpen={(feed: PreviewFeed) => onEntityClick?.({
            type: 'live_news',
            name: feed.name,
            city: feed.city,
            country: feed.country,
            url: feed.url,
            category: feed.category,
            embed_allowed: true,
          })}
        />
      )}
      {selectedSat && <SatelliteCard sat={selectedSat} onClose={clearSat} />}
      {mapReady && <MapControls mapRef={mapRef} onInteract={onFollowInterrupt} />}
    </>
  );
}

export default memo(WorldMap);
