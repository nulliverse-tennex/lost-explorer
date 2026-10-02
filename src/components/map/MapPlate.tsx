'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import {
  geoClipAntimeridian,
  geoGraticule,
  geoNaturalEarth1,
  geoPath,
} from 'd3-geo';
import type { GeoSphere } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';
import { buildRoutes, formatKm, type MapPlace } from './arcs';
import styles from './map.module.css';

const ATLAS_URL = '/data/countries-110m.json';

const PLATE_WIDTH = 960;
const PLATE_HEIGHT = 500;
const PLATE_INSET = 14;

const SPHERE: GeoSphere = { type: 'Sphere' };

/* preclip is the single line standing between this map and a dateline-crossing
   route drawn as a horizontal smear across the full plate width. d3 defaults to
   it, but a projection is a mutable object and this must never be left to luck.
   Order matters: fitExtent measures through the clipped stream. */
const projection = geoNaturalEarth1()
  .precision(0.3)
  .preclip(geoClipAntimeridian)
  .fitExtent(
    [
      [PLATE_INSET, PLATE_INSET],
      [PLATE_WIDTH - PLATE_INSET, PLATE_HEIGHT - PLATE_INSET],
    ],
    SPHERE
  );

const drawGeo = geoPath(projection);

const SPHERE_PATH = drawGeo(SPHERE) ?? '';
const GRATICULE_PATH = drawGeo(geoGraticule().step([15, 15])()) ?? '';
const ROSE_ORIGIN = projection([-141, -46]);

const ROSE_MAJOR = 'M0 -26L5 -5L26 0L5 5L0 26L-5 5L-26 0L-5 -5Z';
const ROSE_MINOR = 'M0 -17L3.4 -3.4L17 0L3.4 3.4L0 17L-3.4 3.4L-17 0L-3.4 -3.4Z';
const STATION_TICKS = 'M0 -16V-11M0 11V16M-16 0H-11M11 0H16';
const CROSS = 'M-2.4 -2.4L2.4 2.4M2.4 -2.4L-2.4 2.4';

const NO_GUESSES: readonly MapPlace[] = [];

type WorldAtlas = Topology<{
  countries: GeometryCollection;
  land: GeometryObject;
}>;

interface Atlas {
  readonly countries: readonly string[];
  readonly coast: string;
}

function readAtlas(topology: WorldAtlas): Atlas {
  return {
    countries: feature(topology, topology.objects.countries)
      .features.map((shape) => drawGeo(shape) ?? '')
      .filter((d) => d.length > 0),
    coast: drawGeo(mesh(topology, topology.objects.land)) ?? '',
  };
}

export interface MapPlateProps {
  readonly trueCity: MapPlace;
  readonly wrongGuesses?: readonly MapPlace[];
  readonly className?: string;
}

export default function MapPlate({
  trueCity,
  wrongGuesses = NO_GUESSES,
  className,
}: MapPlateProps) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    let live = true;

    fetch(ATLAS_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`atlas responded ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        if (live) {
          setAtlas(readAtlas(payload as WorldAtlas));
        }
      })
      .catch(() => {
        if (live) {
          setUnreachable(true);
        }
      });

    return () => {
      live = false;
    };
  }, []);

  const routes = useMemo(
    () => buildRoutes(trueCity, wrongGuesses),
    [trueCity, wrongGuesses]
  );

  const truePoint = projection([trueCity.lng, trueCity.lat]);
  const state = atlas ? 'ready' : unreachable ? 'unreachable' : 'loading';

  const summary = routes
    .map((route) => `${route.destination.name}, ${formatKm(route.km)} away`)
    .join('; ');

  return (
    <svg
      className={[styles.plate, className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${PLATE_WIDTH} ${PLATE_HEIGHT}`}
      role="img"
      aria-labelledby={`${uid}-title ${uid}-desc`}
      data-testid="antique-world-map"
      data-map-state={state}
      data-country-count={atlas ? atlas.countries.length : 0}
    >
      <title id={`${uid}-title`}>
        Chart of the world showing {trueCity.name}
      </title>
      <desc id={`${uid}-desc`}>
        {routes.length > 0
          ? `${trueCity.name} is marked, with routes traced to each incorrect guess: ${summary}.`
          : `${trueCity.name} is marked on a Natural Earth projection of the world.`}
      </desc>

      <defs>
        <pattern
          id={`${uid}-swell`}
          width="9"
          height="9"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(21)"
        >
          <rect width="9" height="9" fill="var(--le-ocean)" />
          <circle cx="2" cy="2.4" r="0.62" fill="var(--le-stipple)" />
          <circle cx="6.6" cy="6" r="0.44" fill="var(--le-stipple)" />
          <circle cx="7.1" cy="1.6" r="0.3" fill="var(--le-stipple)" />
        </pattern>
        <clipPath id={`${uid}-plate`}>
          <path d={SPHERE_PATH} />
        </clipPath>
      </defs>

      <g clipPath={`url(#${uid}-plate)`}>
        <path d={SPHERE_PATH} fill={`url(#${uid}-swell)`} />
        <path className={styles.graticule} d={GRATICULE_PATH} />
        {atlas ? (
          <>
            <path className={styles.coastWash} d={atlas.coast} />
            {atlas.countries.map((d, index) => (
              <path
                key={index}
                className={styles.country}
                d={d}
                data-country=""
              />
            ))}
          </>
        ) : null}
      </g>

      <path className={styles.neatline} d={SPHERE_PATH} />

      {ROSE_ORIGIN ? (
        <g
          transform={`translate(${ROSE_ORIGIN[0]} ${ROSE_ORIGIN[1]}) scale(0.72)`}
          aria-hidden="true"
        >
          <circle className={styles.roseRing} r="30" />
          <circle className={styles.roseRing} r="20" />
          <path className={styles.roseMinor} d={ROSE_MINOR} transform="rotate(45)" />
          <path className={styles.roseMajor} d={ROSE_MAJOR} />
          <text className={`${styles.roseLabel} face-stamp`} y="-36">
            N
          </text>
        </g>
      ) : null}

      {routes.map((route) => {
        const outlines = route.strokes.map((stroke) => drawGeo(stroke) ?? '');
        return (
          <g key={route.id} data-testid="route" data-route={route.id}>
            {outlines.map((d, index) => (
              <path key={`casing-${index}`} className={styles.routeCasing} d={d} />
            ))}
            {outlines.map((d, index) => (
              <path
                key={`arc-${index}`}
                className={styles.route}
                d={d}
                data-testid="route-arc"
              />
            ))}
          </g>
        );
      })}

      {routes.map((route) => (
        <WrongGuessMark key={route.id} place={route.destination} />
      ))}

      {truePoint ? (
        <g
          transform={`translate(${truePoint[0]} ${truePoint[1]})`}
          data-testid="true-city-marker"
        >
          <circle className={styles.trueRing} r="10" />
          <circle className={styles.trueCore} r="3.4" />
          <path className={styles.trueTicks} d={STATION_TICKS} />
        </g>
      ) : null}

      {unreachable ? (
        <text
          className={`${styles.note} face-stamp`}
          x={PLATE_WIDTH / 2}
          y={PLATE_HEIGHT - 26}
        >
          The chart could not be unrolled
        </text>
      ) : null}
    </svg>
  );
}

function WrongGuessMark({ place }: { readonly place: MapPlace }) {
  const point: [number, number] | null = projection([place.lng, place.lat]);
  if (!point) {
    return null;
  }

  return (
    <g
      transform={`translate(${point[0]} ${point[1]})`}
      data-testid="wrong-guess-marker"
      data-place={place.id}
    >
      <circle className={styles.wrongRing} r="4.6" />
      <path className={styles.wrongCross} d={CROSS} />
    </g>
  );
}
