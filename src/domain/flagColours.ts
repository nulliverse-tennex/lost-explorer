import { z } from 'zod';
import path from 'path';

/**
 * Colour enum matching the schema in puzzle.ts.
 * These are the colours that can appear in flag palettes.
 */
export const ColourEnum = z.enum([
  'red',
  'white',
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'black',
  'brown',
  'pink',
  'gray',
  'gold',
  'silver',
  'cyan',
  'magenta',
]);

export type Colour = z.infer<typeof ColourEnum>;

/**
 * Hex values for each colour, sourced from the actual flag SVGs.
 * Used when rendering the torn cloth swatch.
 */
export const colourHexMap: Record<Colour, string> = {
  red: '#DA251D',      // Vietnam, Peru, Iceland, Bosnia red
  white: '#FFFFFF',    // Georgia, Peru, Iceland, Bosnia white
  blue: '#003897',     // Iceland blue
  green: '#058E6E',    // Spain (decorative element)
  yellow: '#FFD700',   // Vietnam, Spain, Bosnia yellow/gold
  orange: '#FF8C00',   // Not in v1 flags, but in enum
  purple: '#800080',   // Not in v1 flags, but in enum
  black: '#000000',    // Not in v1 flags, but in enum
  brown: '#8B4513',    // Not in v1 flags, but in enum
  pink: '#FFC0CB',     // Not in v1 flags, but in enum
  gray: '#808080',     // Not in v1 flags, but in enum
  gold: '#FFD700',     // Spain, Bosnia gold
  silver: '#C0C0C0',   // Not in v1 flags, but in enum
  cyan: '#00FFFF',     // Not in v1 flags, but in enum
  magenta: '#FF00FF',  // Not in v1 flags, but in enum
};

/**
 * Per-country-code flag colour allowlist.
 * Each entry is the complete palette of colours that appear in that country's flag.
 * This is the data that puzzle-lint (Task 17) validates declared colours against.
 */
export const flagColourAllowlist: Record<string, Colour[]> = {
  GE: ['white', 'red'],
  ES: ['red', 'yellow'],
  VN: ['red', 'yellow'],
  PE: ['red', 'white'],
  IS: ['blue', 'white', 'red'],
  BA: ['blue', 'yellow', 'white'],
};

/**
 * Resolve the local flag-icons SVG path for a country code.
 * The flag-icons package (MIT) provides SVGs at flags/4x3/{cc}.svg.
 * No remote fetching occurs — all assets are local.
 *
 * @param cc - Two-letter country code (lowercase)
 * @returns Absolute path to the flag SVG file
 */
export function flagAssetPath(cc: string): string {
  // Resolve to the package root, then navigate to flags/4x3
  const flagIconsPath = require.resolve('flag-icons/package.json');
  const flagIconsDir = path.dirname(flagIconsPath);
  return path.join(flagIconsDir, 'flags', '4x3', `${cc.toLowerCase()}.svg`);
}
