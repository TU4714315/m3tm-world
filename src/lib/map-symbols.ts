import type { Map as MapLibreMap, SymbolLayerSpecification } from 'maplibre-gl';

/** Crisp device-independent symbols. Shape carries meaning; no glow or pulses. */
export function registerEditorialMapSymbols(map: MapLibreMap) {
  for (const [id, kind] of [['editorial-stack', 'stack'], ['reference-pin', 'pin'], ['editorial-report', 'report']] as const) {
    if (map.hasImage(id)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = kind === 'stack' ? 80 : 48;
    canvas.height = kind === 'stack' ? 64 : 48;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#101B25';
    ctx.strokeStyle = '#9EB6BF';
    if (kind === 'stack') {
      // Stacked sheets communicate a collection without putting numbers on the map.
      for (const offset of [12, 6, 0]) {
        ctx.beginPath(); ctx.moveTo(20, 10 + offset); ctx.lineTo(49, 10 + offset);
        ctx.lineTo(60, 20 + offset); ctx.lineTo(60, 44 + offset); ctx.lineTo(20, 44 + offset); ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      ctx.strokeStyle = '#D3E0E5'; ctx.beginPath(); ctx.moveTo(28, 23); ctx.lineTo(50, 23); ctx.moveTo(28, 30); ctx.lineTo(45, 30); ctx.stroke();
    } else if (kind === 'pin') {
      ctx.beginPath(); ctx.moveTo(24, 5); ctx.lineTo(40, 14); ctx.lineTo(37, 29); ctx.lineTo(24, 42); ctx.lineTo(11, 29); ctx.lineTo(8, 14); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#C5DCE2'; ctx.beginPath(); ctx.moveTo(16, 17); ctx.lineTo(24, 12); ctx.lineTo(32, 17); ctx.lineTo(24, 23); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = '#708E9A'; ctx.beginPath(); ctx.moveTo(16, 24); ctx.lineTo(24, 30); ctx.lineTo(32, 24); ctx.stroke();
    } else {
      ctx.strokeStyle = '#C4B99E'; ctx.beginPath(); ctx.moveTo(12, 7); ctx.lineTo(29, 7); ctx.lineTo(37, 15); ctx.lineTo(37, 40); ctx.lineTo(12, 40); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(28, 7); ctx.lineTo(28, 16); ctx.lineTo(37, 16); ctx.moveTo(18, 23); ctx.lineTo(31, 23); ctx.moveTo(18, 29); ctx.lineTo(28, 29); ctx.stroke();
    }
    map.addImage(id, { width: canvas.width, height: canvas.height, data: new Uint8Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data) }, { pixelRatio: 2 });
  }
}

export function editorialClusterLayer(id: string, source: string): SymbolLayerSpecification {
  return { id, source, type: 'symbol', filter: ['has', 'point_count'], layout: {
    'icon-image': 'editorial-stack', 'icon-size': .78,
    'icon-allow-overlap': false, 'text-allow-overlap': false, 'icon-padding': 3,
    'icon-optional': false,
  } };
}

export function territoryWave(color: string, phase = 0) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.globalAlpha = .38;
  for (let y = -24; y <= 120; y += 24) {
    ctx.beginPath();
    for (let x = 0; x <= 96; x += 2) {
      const yy = y + Math.sin(x / 96 * Math.PI * 2 + phase) * 4;
      if (!x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  return { width: 96, height: 96, data: new Uint8Array(ctx.getImageData(0, 0, 96, 96).data) };
}
