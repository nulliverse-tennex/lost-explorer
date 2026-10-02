// CC BY 4.0 requires this attribution wherever GeoNames data is used, not
// only in the README. Mirrors scripts/build-city-pool.ts's
// GEONAMES_ATTRIBUTION constant — duplicated, not imported, because that
// script's top-level code runs a live GeoNames download on import.

const GEONAMES_ATTRIBUTION = "City data \u00a9 GeoNames.org, licensed under CC BY 4.0";

export function Footer() {
  return (
    <p className="face-ui">
      <a href="https://www.geonames.org/" rel="noreferrer noopener" target="_blank">
        {GEONAMES_ATTRIBUTION}
      </a>
      {" \u00b7 "}
      Borders:{" "}
      <a
        href="https://github.com/topojson/world-atlas"
        rel="noreferrer noopener"
        target="_blank"
      >
        Natural Earth via world-atlas
      </a>
      {" \u00b7 "}
      Flags:{" "}
      <a href="https://github.com/lipis/flag-icons" rel="noreferrer noopener" target="_blank">
        flag-icons (MIT)
      </a>
      {" \u00b7 "}
      Type: Rye &amp; Caveat &amp; Inter (OFL), Special Elite (Apache-2.0), Noto (OFL)
    </p>
  );
}
