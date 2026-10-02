import { describe, it, expect } from 'bun:test';
import { buildRoutes, greatCircleStrokes, formatKm, type MapPlace } from './arcs';

const tbilisi: MapPlace = { id: 'tbilisi', name: 'Tbilisi', lat: 41.72, lng: 44.83 };
const paris: MapPlace = { id: 'paris', name: 'Paris', lat: 48.86, lng: 2.35 };
const anchorage: MapPlace = { id: 'anc', name: 'Anchorage', lat: 61.22, lng: -149.9 };
const petropavlovsk: MapPlace = { id: 'pkc', name: 'Petropavlovsk', lat: 53.02, lng: 158.65 };

describe('greatCircleStrokes', () => {
  it('keeps a route that never reaches the dateline as one stroke', () => {
    const strokes = greatCircleStrokes(tbilisi, paris);
    expect(strokes).toHaveLength(1);
    expect(strokes[0]?.coordinates).toEqual([
      [44.83, 41.72],
      [2.35, 48.86],
    ]);
  });

  it('breaks a dateline-crossing route into two strokes at opposite plate edges', () => {
    const strokes = greatCircleStrokes(anchorage, petropavlovsk);
    expect(strokes).toHaveLength(2);

    const exit = strokes[0]?.coordinates[1];
    const entry = strokes[1]?.coordinates[0];
    expect(exit?.[0]).toBeCloseTo(-180, 4);
    expect(entry?.[0]).toBeCloseTo(180, 4);
    expect(Math.abs(exit?.[0] ?? 0)).toBeLessThan(180);
    expect(Math.abs(entry?.[0] ?? 0)).toBeLessThan(180);
  });

  it('hands both edge vertices the same latitude so the stroke reads as continuous', () => {
    const strokes = greatCircleStrokes(anchorage, petropavlovsk);
    expect(strokes[0]?.coordinates[1]?.[1]).toBeCloseTo(
      strokes[1]?.coordinates[0]?.[1] ?? 0,
      6
    );
  });

  it('crosses north of where a linear lerp on longitude would put it', () => {
    const strokes = greatCircleStrokes(anchorage, petropavlovsk);
    const seamLat = strokes[0]?.coordinates[1]?.[1] ?? 0;

    const westwardSpan = 360 - (petropavlovsk.lng - anchorage.lng);
    const fractionToSeam = (anchorage.lng + 180) / westwardSpan;
    const lerped =
      anchorage.lat + fractionToSeam * (petropavlovsk.lat - anchorage.lat);

    expect(lerped).toBeCloseTo(56.42, 1);
    expect(seamLat).toBeGreaterThan(lerped + 2);
    expect(seamLat).toBeLessThan(anchorage.lat);
  });

  it('never splits a route whose shortest path stays off the dateline', () => {
    const sydney: MapPlace = { id: 'syd', name: 'Sydney', lat: -33.87, lng: 151.21 };
    expect(greatCircleStrokes(tbilisi, sydney)).toHaveLength(1);
  });
});

describe('buildRoutes', () => {
  it('measures each destination and anchors its label on the longest stroke', () => {
    const [route] = buildRoutes(tbilisi, [paris]);
    expect(route?.km).toBeGreaterThan(3340);
    expect(route?.km).toBeLessThan(3400);
    expect(route?.labelAnchor[0]).toBeGreaterThan(2.35);
    expect(route?.labelAnchor[0]).toBeLessThan(44.83);
  });

  it('anchors a dateline route inside one of its two pieces, not at the seam midpoint', () => {
    const [route] = buildRoutes(anchorage, [petropavlovsk]);
    expect(route?.strokes).toHaveLength(2);
    expect(Math.abs(route?.labelAnchor[0] ?? 0)).toBeLessThan(180);
  });

  it('returns nothing when there are no wrong guesses', () => {
    expect(buildRoutes(tbilisi, [])).toEqual([]);
  });
});

describe('formatKm', () => {
  it('rounds and groups thousands', () => {
    expect(formatKm(1056.6)).toBe('1,057 km');
    expect(formatKm(42.2)).toBe('42 km');
  });
});
