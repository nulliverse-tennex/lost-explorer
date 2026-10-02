import { geoInterpolate } from 'd3-geo';
import type { LineString } from 'geojson';
import { haversineKm } from '@/domain/geo';

export type LngLat = [number, number];

export interface MapPlace {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
}

export interface Route {
  readonly id: string;
  readonly destination: MapPlace;
  readonly km: number;
  readonly strokes: readonly LineString[];
  readonly labelAnchor: LngLat;
}

type Interpolator = (t: number) => LngLat;

interface Run {
  readonly head: LngLat;
  readonly tail: LngLat;
}

interface SeamCrossing {
  readonly t: number;
  readonly exitSign: number;
}

/* 180 exactly sits ON d3's antimeridian clip boundary, where a vertex is
   ambiguous and the clipper can emit a spurious edge joining both plate edges.
   Nudging inside is the whole reason dateline routes do not smear. */
const SEAM_LNG = 180 - 1e-6;
const SCAN_STEPS = 512;
const BISECT_STEPS = 48;

function locateSeam(
  interpolate: Interpolator,
  before: number,
  after: number,
  exitSign: number
): number {
  let low = before;
  let high = after;
  for (let i = 0; i < BISECT_STEPS; i += 1) {
    const mid = (low + high) / 2;
    if (Math.sign(interpolate(mid)[0]) === exitSign) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) / 2;
}

function seamCrossings(
  interpolate: Interpolator,
  start: LngLat,
  end: LngLat
): SeamCrossing[] {
  const crossings: SeamCrossing[] = [];
  let previous = start;
  let previousT = 0;

  for (let step = 1; step <= SCAN_STEPS; step += 1) {
    const t = step / SCAN_STEPS;
    const point = step === SCAN_STEPS ? end : interpolate(t);
    if (Math.abs(point[0] - previous[0]) > 180) {
      const exitSign = Math.sign(previous[0]);
      crossings.push({ t: locateSeam(interpolate, previousT, t, exitSign), exitSign });
    }
    previous = point;
    previousT = t;
  }

  return crossings;
}

/* A run carries only its two endpoints: geoPath adaptively resamples a 2-point
   LineString into a true great-circle curve, so interior points buy nothing but
   bytes. Runs exist solely to break the stroke at the edge of the plate. */
function greatCircleRuns(from: MapPlace, to: MapPlace): Run[] {
  const start: LngLat = [from.lng, from.lat];
  const end: LngLat = [to.lng, to.lat];
  const interpolate = geoInterpolate(start, end);

  const runs: Run[] = [];
  let head = start;

  for (const crossing of seamCrossings(interpolate, start, end)) {
    const seamLat = interpolate(crossing.t)[1];
    const exitLng = SEAM_LNG * crossing.exitSign;
    runs.push({ head, tail: [exitLng, seamLat] });
    head = [-exitLng, seamLat];
  }
  runs.push({ head, tail: end });

  return runs;
}

function toLineString(run: Run): LineString {
  return { type: 'LineString', coordinates: [run.head, run.tail] };
}

function runKm(run: Run): number {
  return haversineKm(run.head[1], run.head[0], run.tail[1], run.tail[0]);
}

export function greatCircleStrokes(from: MapPlace, to: MapPlace): LineString[] {
  return greatCircleRuns(from, to).map(toLineString);
}

export function buildRoutes(
  origin: MapPlace,
  destinations: readonly MapPlace[]
): Route[] {
  return destinations.map((destination) => {
    const runs = greatCircleRuns(origin, destination);
    const longest = runs.reduce((a, b) => (runKm(b) > runKm(a) ? b : a));

    return {
      id: destination.id,
      destination,
      km: haversineKm(origin.lat, origin.lng, destination.lat, destination.lng),
      strokes: runs.map(toLineString),
      labelAnchor: geoInterpolate(longest.head, longest.tail)(0.5),
    };
  });
}

export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}
