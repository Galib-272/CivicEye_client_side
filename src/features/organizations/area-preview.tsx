type Ring = number[][];

interface MultiPolygon {
  coordinates: Ring[][];
}

/**
 * Draws a service-area outline as SVG without a map provider (Phase 4 adds the real map).
 * Uses an equirectangular projection scaled by cos(latitude), which is accurate enough to
 * recognise a city-sized shape.
 */
export function AreaPreview({
  geometry,
  label,
  size = 160,
}: {
  geometry: MultiPolygon;
  label: string;
  size?: number;
}) {
  const points = geometry.coordinates.flat(2) as Array<[number, number]>;
  if (points.length === 0) return null;

  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const xScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const width = Math.max((maxLon - minLon) * xScale, 1e-9);
  const height = Math.max(maxLat - minLat, 1e-9);
  const scale = (size - 8) / Math.max(width, height);

  const project = ([lon, lat]: number[]) =>
    `${(4 + ((lon ?? 0) - minLon) * xScale * scale).toFixed(1)},${(4 + (maxLat - (lat ?? 0)) * scale).toFixed(1)}`;

  const path = geometry.coordinates
    .flatMap((polygon) => polygon.map((ring) => `M${ring.map(project).join('L')}Z`))
    .join(' ');

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="border-border bg-surface rounded-md border"
    >
      <path
        d={path}
        fillRule="evenodd"
        className="fill-accent/20 stroke-accent"
        strokeWidth={1.5}
      />
    </svg>
  );
}
