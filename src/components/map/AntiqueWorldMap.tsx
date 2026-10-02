'use client';

import dynamic from 'next/dynamic';
import styles from './map.module.css';

export type { LngLat, MapPlace, Route } from './arcs';
export { buildRoutes, formatKm, greatCircleStrokes } from './arcs';
export type { MapPlateProps as AntiqueWorldMapProps } from './MapPlate';

/* ssr: false keeps d3-geo and topojson-client out of the server render and off
   every route that never shows the chart. The 108 KB atlas is fetched at
   runtime, never bundled — see ATLAS_URL in MapPlate. */
const AntiqueWorldMap = dynamic(() => import('./MapPlate'), {
  ssr: false,
  loading: () => <div className={styles.placeholder} aria-hidden="true" />,
});

export default AntiqueWorldMap;
