const R = 6371;

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type DistanceBand = 'very-close' | 'close' | 'far' | 'very-far';

export function distanceBand(km: number): DistanceBand {
  if (km < 250) return 'very-close';
  if (km < 750) return 'close';
  if (km < 2000) return 'far';
  return 'very-far';
}

export function formatBand(band: DistanceBand): string {
  const descriptions: Record<DistanceBand, string> = {
    'very-close': 'Very close — under 250 km',
    close: 'Close — under 750 km',
    far: 'Far — under 2,000 km',
    'very-far': 'Very far — over 2,000 km',
  };
  return descriptions[band];
}

export type FeedbackMode = 'bands' | 'exact';

export const FEEDBACK_MODE: FeedbackMode = 'bands';

export function formatGuessFeedback(km: number, mode: FeedbackMode = FEEDBACK_MODE): string {
  if (mode === 'exact') {
    return `${Math.round(km)} km away`;
  }
  const band = distanceBand(km);
  return formatBand(band);
}
