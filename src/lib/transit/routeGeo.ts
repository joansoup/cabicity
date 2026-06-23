// Genera coordenadas deterministas para una opción de viaje, ancladas en Madrid.
import type { Opcion, Tramo } from "./engine";

export type LngLat = [number, number];

const SOL: LngLat = [-3.7038, 40.4168];

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  const x = s.trim().toLowerCase();
  for (let i = 0; i < x.length; i++) {
    h ^= x.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function kmToDeg(km: number, lat: number): { dLng: number; dLat: number } {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180));
  return { dLng, dLat };
}

// Avanza desde un punto a una distancia y bearing (grados), con jitter por km.
function advance(from: LngLat, km: number, bearingDeg: number, seed: number, jitter = 0.4): LngLat[] {
  const points: LngLat[] = [from];
  const steps = Math.max(2, Math.min(40, Math.ceil(km * 2)));
  const segKm = km / steps;
  let cur: LngLat = from;
  let bear = bearingDeg;
  for (let i = 1; i <= steps; i++) {
    // pequeña oscilación de rumbo para que la línea no sea recta
    bear += (((seed + i * 97) % 31) - 15) * (jitter * 0.6);
    const rad = (bear * Math.PI) / 180;
    const { dLng, dLat } = kmToDeg(segKm, cur[1]);
    const next: LngLat = [
      cur[0] + Math.sin(rad) * dLng,
      cur[1] + Math.cos(rad) * dLat,
    ];
    points.push(next);
    cur = next;
  }
  return points;
}

export interface SegmentGeo {
  tramoIdx: number;
  tipo: Tramo["tipo"];
  color: string;
  coords: LngLat[];
}

export interface RouteGeo {
  origen: LngLat;
  destino: LngLat;
  segments: SegmentGeo[];
  stops: LngLat[]; // inicio + transbordos + fin
  flat: LngLat[];  // polyline completa
  stepPositions: LngLat[]; // una posición por paso (acumulado por duración)
}

export function buildRouteGeo(op: Opcion, destinoTexto: string): RouteGeo {
  const seed = hashStr(destinoTexto || op.id);
  // Rumbo base 0-360 según destino
  let bearing = seed % 360;
  // Distancia interurbana real fuera de Madrid: la dejamos en escala visual ≤ 6 km equivalentes
  // para que el mapa no se aleje a otra ciudad. AVE/Cercanías se representan a escala urbana.
  const escala = (km: number) => {
    if (km <= 8) return km;
    if (km <= 30) return 4 + km * 0.15;
    return 6 + Math.log10(km) * 1.5;
  };

  const segments: SegmentGeo[] = [];
  const stops: LngLat[] = [SOL];
  const flat: LngLat[] = [SOL];
  let cursor: LngLat = SOL;

  op.tramos.forEach((t, i) => {
    const km = escala(t.distanciaKm);
    // pequeño giro entre tramos para representar transbordo
    if (i > 0) bearing += ((seed >> (i * 3)) % 60) - 30;
    const pts = advance(cursor, km, bearing, seed + i, t.tipo === "andando" ? 0.2 : 0.5);
    const segCoords = pts;
    segments.push({
      tramoIdx: i,
      tipo: t.tipo,
      color: t.color,
      coords: segCoords,
    });
    // añadir al flat sin duplicar el primer punto
    for (let k = 1; k < segCoords.length; k++) flat.push(segCoords[k]);
    cursor = segCoords[segCoords.length - 1];
    stops.push(cursor);
  });

  // Posiciones por paso: distribuir por duración acumulada sobre flat
  const totalDur = op.tramos.reduce((s, t) => s + t.duracionMin, 0) || 1;
  let acc = 0;
  const stepPositions: LngLat[] = [];
  op.tramos.forEach((t) => {
    t.pasos.forEach((p) => {
      acc += p.duracionMin;
      const frac = Math.min(1, acc / totalDur);
      const idx = Math.min(flat.length - 1, Math.max(0, Math.round(frac * (flat.length - 1))));
      stepPositions.push(flat[idx]);
    });
  });

  return {
    origen: SOL,
    destino: cursor,
    segments,
    stops,
    flat,
    stepPositions,
  };
}

// Token PÚBLICO (pk) de Mapbox. Se prefiere la variable de entorno si Lovable la
// inyecta en el cliente; si no, este fallback hace que el mapa funcione igualmente
// en el preview de Lovable. Es un token público (va de por sí en el bundle del
// cliente); el secreto (sk) NUNCA debe ir aquí.
const FALLBACK_MAPBOX_PK =
  "pk.eyJ1Ijoiam9hbnNvdXAiLCJhIjoiY21xcWh5MmVkMDMweTJxcXJpc3l6bnQ1ayJ9.h607bIuTu3CC6lfEkpv1-w";

export function getMapboxToken(): string | undefined {
  const env = (import.meta.env as Record<string, string | undefined>) || {};
  const t = env.VITE_MAPBOX_TOKEN;
  return t && t.trim() ? t.trim() : FALLBACK_MAPBOX_PK;
}
