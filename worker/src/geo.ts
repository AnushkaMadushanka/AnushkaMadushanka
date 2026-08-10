export const EARTH_RADIUS_KM = 6371;
export const LAP_KM = 40075; // one circumnavigation at the equator
export const MOON_KM = 384400; // mean Earth–Moon distance

export interface Place {
  city: string;
  region: string | null;
  country: string;
  lat: number;
  lon: number;
}

export interface Hop extends Place {
  n: number;
  km: number; // distance from the previous holder
  totalKm: number;
  at: string;
}

export interface TorchData {
  version: 1;
  hops: Hop[];
  /** Map file currently referenced by the README, so it can be replaced. */
  map?: string;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: Place, b: Place): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * ~1km of precision. `request.cf.latitude` is sharper than that, and this ends
 * up in a public repo permanently, so it gets blunted before it is written.
 */
export function blunt(n: number): number {
  return Math.round(n * 100) / 100;
}

export function placeFromRequest(request: Request): Place | null {
  const cf = (request as unknown as { cf?: Record<string, unknown> }).cf;
  if (!cf) return null;

  const city = typeof cf.city === "string" ? cf.city.trim() : "";
  const country = typeof cf.country === "string" ? cf.country.trim() : "";
  const lat = Number(cf.latitude);
  const lon = Number(cf.longitude);

  if (!city || !country) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (country === "T1" || country === "XX") return null;

  return {
    city,
    region: typeof cf.region === "string" && cf.region ? cf.region : null,
    country,
    lat: blunt(lat),
    lon: blunt(lon),
  };
}

export function samePlace(a: Place, b: Place): boolean {
  return a.city === b.city && a.country === b.country;
}

export function label(p: Place): string {
  return `${p.city}, ${p.country}`;
}
