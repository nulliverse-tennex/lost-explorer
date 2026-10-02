/* Not `flagAssetPath` from src/domain/flagColours.ts: that resolves a node_modules
   filesystem path via require.resolve, which webpack rewrites to a module id in a
   browser bundle. The same flag-icons SVGs are vendored to public/flags/4x3. */
export function flagSvgUrl(countryCode: string): string {
  return `/flags/4x3/${countryCode.toLowerCase()}.svg`;
}
