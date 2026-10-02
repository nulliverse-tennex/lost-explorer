/* One fixed-id <defs> sprite rather than a filter per component instance:
   duplicate SVG ids are invalid, and generating unique ones needs useId(),
   which would force every primitive to become a client component.

   Both feTurbulence nodes carry an explicit `seed` and neither is animated:
   animated baseFrequency re-renders the chain every frame on the CPU
   (6-15ms for a 600x400 area) — Firefox regression 1879590, iOS Safari tab
   crashes. Static, and only ever on small elements.
   Structure after modern_mermaid Preview.tsx#L1264: coarse pass, then fine. */
export function PaperFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter
          id="le-rough-edge"
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
          filterUnits="objectBoundingBox"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.022"
            numOctaves="3"
            seed="7"
            result="coarseNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="coarseNoise"
            scale="4"
            xChannelSelector="R"
            yChannelSelector="G"
            result="coarsePass"
          />
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.11"
            numOctaves="2"
            seed="19"
            result="fineNoise"
          />
          <feDisplacementMap
            in="coarsePass"
            in2="fineNoise"
            scale="1.8"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
