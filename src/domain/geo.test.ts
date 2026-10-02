import { describe, it, expect } from 'bun:test';
import {
  haversineKm,
  distanceBand,
  formatBand,
  FEEDBACK_MODE,
  formatGuessFeedback,
} from './geo';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(0, 0, 0, 0)).toBe(0);
  });

  it('calculates London to Paris distance (~344 km)', () => {
    const london = { lat: 51.5074, lng: -0.1278 };
    const paris = { lat: 48.8566, lng: 2.3522 };
    const distance = haversineKm(london.lat, london.lng, paris.lat, paris.lng);
    // Should be approximately 344 km, tolerance ±5 km
    expect(distance).toBeGreaterThan(339);
    expect(distance).toBeLessThan(349);
  });

  it('calculates antipodal points distance (~20015 km)', () => {
    const distance = haversineKm(0, 0, 0, 180);
    // Antipodal distance should be approximately half Earth's circumference
    expect(distance).toBeGreaterThan(20000);
    expect(distance).toBeLessThan(20030);
  });

  it('handles both hemispheres correctly', () => {
    // New York to Sydney
    const newYork = { lat: 40.7128, lng: -74.006 };
    const sydney = { lat: -33.8688, lng: 151.2093 };
    const distance = haversineKm(
      newYork.lat,
      newYork.lng,
      sydney.lat,
      sydney.lng
    );
    // Should be approximately 16000 km
    expect(distance).toBeGreaterThan(15900);
    expect(distance).toBeLessThan(16100);
  });

  it('handles dateline crossing correctly (Anchorage to Petropavlovsk)', () => {
    // Anchorage: 61.22°N, 149.90°W
    // Petropavlovsk-Kamchatsky: 53.02°N, 158.65°E
    const anchorage = { lat: 61.22, lng: -149.9 };
    const petropavlovsk = { lat: 53.02, lng: 158.65 };
    const distance = haversineKm(
      anchorage.lat,
      anchorage.lng,
      petropavlovsk.lat,
      petropavlovsk.lng
    );
    // Should be under 4000 km (short way across the Pacific)
    // NOT a near-circumference value (which would indicate a longitude-wrapping bug)
    expect(distance).toBeLessThan(4000);
    expect(distance).toBeGreaterThan(2000);
  });
});

describe('distanceBand', () => {
  it('classifies 0 km as very-close', () => {
    expect(distanceBand(0)).toBe('very-close');
  });

  it('classifies 249 km as very-close (exclusive upper bound)', () => {
    expect(distanceBand(249)).toBe('very-close');
  });

  it('classifies 250 km as close (boundary is exclusive)', () => {
    expect(distanceBand(250)).toBe('close');
  });

  it('classifies 749 km as close', () => {
    expect(distanceBand(749)).toBe('close');
  });

  it('classifies 750 km as far (boundary is exclusive)', () => {
    expect(distanceBand(750)).toBe('far');
  });

  it('classifies 1999 km as far', () => {
    expect(distanceBand(1999)).toBe('far');
  });

  it('classifies 2000 km as very-far (boundary is exclusive)', () => {
    expect(distanceBand(2000)).toBe('very-far');
  });

  it('classifies 20000 km as very-far', () => {
    expect(distanceBand(20000)).toBe('very-far');
  });
});

describe('formatBand', () => {
  it('formats very-close band', () => {
    const formatted = formatBand('very-close');
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });

  it('formats close band', () => {
    const formatted = formatBand('close');
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });

  it('formats far band', () => {
    const formatted = formatBand('far');
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });

  it('formats very-far band', () => {
    const formatted = formatBand('very-far');
    expect(formatted).toBeTruthy();
    expect(typeof formatted).toBe('string');
  });
});

describe('formatGuessFeedback', () => {
  it('returns exact distance when mode is exact', () => {
    const feedback = formatGuessFeedback(344, 'exact');
    expect(feedback).toContain('344');
  });

  it('returns band description when mode is bands', () => {
    const feedback = formatGuessFeedback(344, 'bands');
    expect(feedback).toBeTruthy();
    expect(typeof feedback).toBe('string');
  });

  it('uses default FEEDBACK_MODE when not specified', () => {
    const feedback = formatGuessFeedback(344);
    expect(feedback).toBeTruthy();
    expect(typeof feedback).toBe('string');
  });
});
