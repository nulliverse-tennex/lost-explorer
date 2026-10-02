import type { ReactNode } from "react";
import type { Puzzle } from "@/domain/puzzle";

export type Landscape = Puzzle["day1"]["landscape"];

export type HorizonMotif = {
  observation: string;
  sketch: ReactNode;
};

const near = { fill: "none", stroke: "currentColor", strokeWidth: 2.1 };
const mid = { fill: "none", stroke: "currentColor", strokeWidth: 1.6 };
const far = { fill: "none", stroke: "currentColor", strokeWidth: 1.1 };

const horizonMotifs: Record<Landscape, HorizonMotif> = {
  flat: {
    observation:
      "The landscape seems mostly flat — I can see for miles in every direction.",
    sketch: (
      <>
        <path {...near} d="M4 72C40 70.6 78 73.2 118 71.4S196 73.6 236 71.8" />
        <path {...far} d="M4 80C60 78.6 150 81 236 79" opacity="0.5" />
        <path {...far} d="M60 72l-1-6M64 72l2-5M152 72l-2-5M156 72l1-6" />
        <path {...mid} d="M196 72V58M192 61h8M192 65h8" />
      </>
    ),
  },

  hilly: {
    observation: "The city is built across a cluster of low, rounded hills.",
    sketch: (
      <>
        <path
          {...near}
          d="M2 72C26 52 52 50 76 70c16-14 38-16 58 0 18-10 44-12 64 1 14 5 22 7 36 1"
        />
        <path {...far} d="M20 66c8-7 18-9 26-6M96 64c9-7 20-8 28-3M164 66c9-6 19-7 26-3" />
        <path {...mid} d="M44 70l4-5 4 5M118 71l4-4 3 4M186 71l3-4 3 4" />
      </>
    ),
  },

  mountainous: {
    observation: "Serious mountains on every side. Nothing here is level.",
    sketch: (
      <>
        <path
          {...near}
          d="M2 74l28-36 14 14 22-34 22 32 16-12 20 22 18-16 22-20 22 30 18-12 20 20 14 12"
        />
        <path {...far} d="M60 24l7 8M72 26l-5 7M156 30l8 9M168 32l-6 8" />
        <path {...far} d="M106 46l6 7M122 50l5 6M202 48l6 7" opacity="0.7" />
      </>
    ),
  },

  "mountains-visible": {
    observation:
      "Level ground underfoot, with mountains visible away to one side.",
    sketch: (
      <>
        <path {...near} d="M2 73C50 71.6 104 73.4 148 72.2" />
        <path {...far} d="M4 80C56 79 104 81 150 79.6" opacity="0.45" />
        <path
          {...mid}
          d="M148 72l20-26 12 11 20-26 16 21 12-9 20 18 8 13"
          opacity="0.6"
        />
        <path {...far} d="M194 44l6 6M204 46l-5 6" opacity="0.5" />
        <path {...far} d="M48 73l-1-5M52 73l2-4M110 73l-2-4" />
      </>
    ),
  },

  "mountains-surrounding": {
    observation:
      "The city sits in a bowl, with mountains ringing it on every side.",
    sketch: (
      <>
        <path {...near} d="M2 73l18-29 12 12 18-26 16 24 12-9 16 25" />
        <path {...near} d="M154 73l14-24 12 11 18-27 16 24 12-9 16 25" />
        <path {...mid} d="M94 73C116 71.4 134 73.4 154 72.4" />
        <path {...mid} d="M104 72l6-7 6 7M120 72l5-6 5 6M136 72l5-6 4 6" />
        <path {...far} d="M44 34l6 7M56 36l-5 7M190 32l6 7M202 34l-6 7" />
      </>
    ),
  },

  coastal: {
    observation: "There's a coastline not far off — I can smell the sea.",
    sketch: (
      <>
        <path {...near} d="M2 62C16 50 34 48 48 60c8 7 14 11 24 12" />
        <path {...far} d="M92 56h144" opacity="0.6" />
        <path {...near} d="M72 72C100 74 132 70 164 72.6S214 71 236 73" />
        <path {...mid} d="M106 64h18M138 66h16M178 63h20M204 67h20" opacity="0.8" />
        <path {...mid} d="M118 79h22M158 81h20M196 78h22" opacity="0.6" />
        <path {...far} d="M20 58l6-5 6 5" />
      </>
    ),
  },

  lakeside: {
    observation: "A large lake sits right against the edge of the city.",
    sketch: (
      <>
        <path {...far} d="M2 50C50 44 110 48 170 43c30-2 54 2 66 0" opacity="0.6" />
        <path {...mid} d="M44 48l5-5 5 5M120 45l5-5 4 5" opacity="0.6" />
        <path
          {...near}
          d="M24 68C62 58 122 56 172 64c26 4 42 10 30 16-50 8-138 6-172-2-12-4-12-7-6-10Z"
        />
        <path {...mid} d="M60 70h20M96 74h24M140 70h18" opacity="0.7" />
        <path {...far} d="M12 70l-2-9M16 70l2-8M200 62l2-8" />
      </>
    ),
  },

  river: {
    observation: "A major river runs straight through the middle of the city.",
    sketch: (
      <>
        <path {...far} d="M2 48C60 45 120 49 238 46" opacity="0.6" />
        <path {...near} d="M98 48C94 60 76 70 48 82 36 87 24 90 10 92" />
        <path {...near} d="M118 48c2 14 18 24 46 34 14 5 28 8 42 10" />
        <path {...mid} d="M78 68h56" />
        <path {...mid} d="M84 68c10-8 30-8 40 0" />
        <path {...far} d="M90 68v-5M104 68v-6M118 68v-5" />
        <path {...mid} d="M94 78h22M86 86h30M78 92h38" opacity="0.6" />
      </>
    ),
  },

  dry: {
    observation: "The land is dry and hard — scrub, dust and very little green.",
    sketch: (
      <>
        <path {...mid} d="M148 70l4-15 44-1 6 16" />
        <path {...near} d="M2 70C60 68.6 140 71 238 69.4" />
        <path {...far} d="M30 76l8 6M72 74l-6 7M110 77l9 5M170 75l-7 6M206 77l8 6" opacity="0.6" />
        <path {...near} d="M48 70c-4-6-1-10 2-11M50 70c4-5 8-6 10-4M50 70v-8" />
        <path {...near} d="M114 70c-3-5-1-8 1-9M116 70c3-4 7-5 8-3" />
        <path {...mid} d="M156 55h40" opacity="0.5" />
      </>
    ),
  },

  tropical: {
    observation:
      "The vegetation is thick and tropical, and the air is heavy with it.",
    sketch: (
      <>
        <path
          {...mid}
          d="M2 64c18-10 28-6 42-12s28 4 44-2 32 8 48 2 32 8 48 3 36 5 54 1"
          opacity="0.7"
        />
        <path {...near} d="M2 78C70 76 160 80 238 77" />
        <path {...near} d="M62 78c-4-14-6-26 2-36" />
        <path
          {...mid}
          d="M64 42c-10-6-20-4-24 4M64 42c-12 1-18 8-18 16M64 42c10-7 20-6 24 2M64 42c12 2 17 9 16 17M64 42c0-9 4-15 10-18"
        />
        <path {...far} d="M190 78c-2-9-4-17 2-23" />
        <path
          {...far}
          d="M192 55c-7-4-14-3-17 3M192 55c-8 1-12 6-12 11M192 55c7-5 14-4 17 2M192 55c8 2 11 6 11 12"
        />
      </>
    ),
  },

  "green-hills": {
    observation: "Dense green hills crowd in around the rooftops.",
    sketch: (
      <>
        <path
          {...far}
          d="M2 56C40 42 86 40 124 50c36 9 76-8 112 4"
          opacity="0.55"
        />
        <path
          {...near}
          d="M2 70C26 48 52 46 76 66c20-16 48-20 72-2 22-12 52-10 72 4 8 3 12 3 16 2"
        />
        <path
          {...far}
          d="M16 66l6-8M28 62l5-8M40 60l5-7M54 59l5-7M66 62l5-7M92 60l5-8M104 56l5-7M116 54l5-7M128 55l5-7M140 58l5-7M164 60l5-8M176 57l5-7M188 57l5-7M200 60l5-7M212 64l5-7"
          opacity="0.75"
        />
      </>
    ),
  },

  desert: {
    observation: "Desert starts where the buildings stop — dunes all the way out.",
    sketch: (
      <>
        <path {...near} d="M2 76C40 60 80 58 118 70" />
        <path {...mid} d="M88 72C124 56 170 54 210 68c12 4 20 5 28 6" />
        <path {...far} d="M24 72c22-10 48-12 70-4" opacity="0.6" />
        <path {...far} d="M110 72c26-11 56-12 82-2" opacity="0.6" />
        <path {...far} d="M8 84c34-8 72-8 104 0M126 88c32-7 70-6 100 2" opacity="0.5" />
        <path {...far} d="M62 62l3-5M160 60l3-5" opacity="0.5" />
      </>
    ),
  },

  "high-altitude": {
    observation: "The air is thin up here. This place sits a long way above the sea.",
    sketch: (
      <>
        <path {...near} d="M66 90l30-56 12 14 18-28 22 32 14-10 18 48" />
        <path {...far} d="M120 26l8 10M134 30l-7 9" />
        <path {...mid} d="M8 70l14-16 14 16M202 70l16-18 16 18" opacity="0.55" />
        <path
          {...far}
          d="M2 72h52M74 74h30M152 72h40M198 76h36M14 80h46M96 82h40M164 80h40"
          opacity="0.7"
        />
      </>
    ),
  },
};

function landscapeKeys(motifs: Record<Landscape, HorizonMotif>): readonly Landscape[] {
  return Object.keys(motifs) as Landscape[];
}

export const LANDSCAPES = landscapeKeys(horizonMotifs);

export function horizonMotif(landscape: Landscape): HorizonMotif {
  return horizonMotifs[landscape];
}
