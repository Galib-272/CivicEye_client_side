'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { FormAlert } from '@/components/ui/form-alert';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { useCategories } from '@/features/organizations/api';
import { categoryName } from '@/features/organizations/categories-panel';
import { DEFAULT_CENTER, MAP_STYLE_URL, MAP_WORKER_URL } from '@/features/reports/location-map';
import { Link } from '@/i18n/navigation';
import {
  isTooWide,
  useMapReports,
  useOrganizationAreas,
  type Bounds,
  type MapFilters,
  type MapPoint,
  type OrganizationArea,
} from './api';

const STATUSES: MapPoint['status'][] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_INFORMATION',
  'ACCEPTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'RESOLVED',
  'REOPENED',
  'CLOSED',
  'REJECTED',
];

/** Pin colour by stage; the popup and the legend always say the status in words too. */
function stage(status: MapPoint['status']): 'open' | 'work' | 'done' {
  if (status === 'RESOLVED' || status === 'CLOSED' || status === 'REJECTED') return 'done';
  if (['ASSIGNED', 'IN_PROGRESS', 'WORK_COMPLETED', 'PENDING_VERIFICATION'].includes(status)) {
    return 'work';
  }
  return 'open';
}
const STAGE_COLORS = { open: '#c2410c', work: '#0b5cad', done: '#15803d' } as const;

function toFeatures(points: MapPoint[]) {
  return {
    type: 'FeatureCollection' as const,
    features: points.map((point) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.longitude, point.latitude] },
      properties: {
        publicId: point.publicId,
        title: point.title,
        status: point.status,
        stage: stage(point.status),
      },
    })),
  };
}

function toAreas(areas: OrganizationArea[]) {
  return {
    type: 'FeatureCollection' as const,
    features: areas.map((area) => ({
      type: 'Feature' as const,
      geometry: area.geometry as GeoJSON.MultiPolygon,
      properties: { name: area.name },
    })),
  };
}

/**
 * MapLibre map of public reports: pins grouped into numbered circles when zoomed out, a popup
 * per report, and optional organization areas. Locations are already rounded by the API.
 */
function ReportsMap({
  points,
  areas,
  onBounds,
  statusLabel,
  openLabel,
  label,
  unavailableText,
  attribution,
}: {
  points: MapPoint[];
  areas: OrganizationArea[] | null;
  onBounds: (bounds: Bounds) => void;
  statusLabel: (status: MapPoint['status']) => string;
  openLabel: string;
  label: string;
  unavailableText: string;
  attribution: string;
}) {
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const ready = useRef(false);
  const latest = useRef({ points, areas, onBounds, statusLabel, openLabel });
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    latest.current = { points, areas, onBounds, statusLabel, openLabel };
  });

  useEffect(() => {
    let cancelled = false;
    void import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !container.current) return;
      let instance: MapLibreMap;
      try {
        maplibregl.setWorkerUrl(MAP_WORKER_URL);
        instance = new maplibregl.Map({
          container: container.current,
          style: MAP_STYLE_URL,
          center: DEFAULT_CENTER,
          zoom: 11,
          attributionControl: { compact: true, customAttribution: attribution },
        });
      } catch {
        setUnavailable(true);
        return;
      }
      map.current = instance;
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      const reportBounds = () => {
        const b = instance.getBounds();
        latest.current.onBounds({
          minLng: b.getWest(),
          minLat: b.getSouth(),
          maxLng: b.getEast(),
          maxLat: b.getNorth(),
        });
      };

      instance.on('load', () => {
        instance.addSource('areas', { type: 'geojson', data: toAreas(latest.current.areas ?? []) });
        instance.addLayer({
          id: 'areas-fill',
          type: 'fill',
          source: 'areas',
          paint: { 'fill-color': '#0b5cad', 'fill-opacity': 0.08 },
        });
        instance.addLayer({
          id: 'areas-line',
          type: 'line',
          source: 'areas',
          paint: { 'line-color': '#0b5cad', 'line-width': 1.5, 'line-dasharray': [2, 2] },
        });
        instance.addSource('reports', {
          type: 'geojson',
          data: toFeatures(latest.current.points),
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 16,
        });
        instance.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'reports',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#1f2937',
            'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
        instance.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'reports',
          filter: ['has', 'point_count'],
          layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13 },
          paint: { 'text-color': '#ffffff' },
        });
        instance.addLayer({
          id: 'points',
          type: 'circle',
          source: 'reports',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'match',
              ['get', 'stage'],
              'work',
              STAGE_COLORS.work,
              'done',
              STAGE_COLORS.done,
              STAGE_COLORS.open,
            ],
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
        ready.current = true;
        reportBounds();
      });
      instance.on('moveend', reportBounds);
      // Report the starting area at once: the data must not wait for the tile server.
      reportBounds();

      instance.on('click', 'clusters', (event: MapMouseEvent) => {
        const [feature] = instance.queryRenderedFeatures(event.point, { layers: ['clusters'] });
        const clusterId = feature?.properties?.['cluster_id'] as number | undefined;
        if (clusterId === undefined || feature?.geometry.type !== 'Point') return;
        const center = feature.geometry.coordinates as [number, number];
        void (instance.getSource('reports') as GeoJSONSource)
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => instance.easeTo({ center, zoom }));
      });

      instance.on('click', 'points', (event: MapMouseEvent) => {
        const [feature] = instance.queryRenderedFeatures(event.point, { layers: ['points'] });
        if (!feature || feature.geometry.type !== 'Point') return;
        const props = feature.properties as {
          publicId: string;
          title: string;
          status: MapPoint['status'];
        };
        // Built with textContent: report titles are user content and must never become HTML.
        const body = document.createElement('div');
        const title = document.createElement('p');
        title.style.fontWeight = '600';
        title.style.margin = '0 0 4px';
        title.textContent = props.title;
        const status = document.createElement('p');
        status.style.margin = '0 0 6px';
        status.textContent = latest.current.statusLabel(props.status);
        const link = document.createElement('a');
        link.href = `/${locale}/reports/${props.publicId}`;
        link.textContent = latest.current.openLabel;
        link.style.textDecoration = 'underline';
        body.append(title, status, link);
        new maplibregl.Popup({ offset: 12 })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .setDOMContent(body)
          .addTo(instance);
      });
      for (const layer of ['clusters', 'points']) {
        instance.on('mouseenter', layer, () => (instance.getCanvas().style.cursor = 'pointer'));
        instance.on('mouseleave', layer, () => (instance.getCanvas().style.cursor = ''));
      }
    });
    return () => {
      cancelled = true;
      ready.current = false;
      map.current?.remove();
      map.current = null;
    };
  }, [attribution, locale]);

  useEffect(() => {
    if (!ready.current) return;
    (map.current?.getSource('reports') as GeoJSONSource | undefined)?.setData(toFeatures(points));
  }, [points]);

  useEffect(() => {
    if (!ready.current) return;
    const instance = map.current;
    (instance?.getSource('areas') as GeoJSONSource | undefined)?.setData(toAreas(areas ?? []));
    for (const layer of ['areas-fill', 'areas-line']) {
      if (instance?.getLayer(layer)) {
        instance.setLayoutProperty(layer, 'visibility', areas ? 'visible' : 'none');
      }
    }
  }, [areas]);

  if (unavailable) {
    return (
      <p role="status" className="border-border bg-surface rounded-md border p-4 text-sm">
        {unavailableText}
      </p>
    );
  }
  return (
    <div
      ref={container}
      role="region"
      aria-label={label}
      className="border-border bg-surface h-[65vh] min-h-80 overflow-hidden rounded-md border"
    />
  );
}

export function PublicMapPage() {
  const t = useTranslations('Map');
  const tStatus = useTranslations('ReportStatus');
  const tForm = useTranslations('ReportForm');
  const tPublic = useTranslations('PublicReports');
  const locale = useLocale();
  const categories = useCategories();
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [filters, setFilters] = useState<MapFilters>({});
  const [showAreas, setShowAreas] = useState(false);
  const reports = useMapReports(bounds, filters);
  const areas = useOrganizationAreas(showAreas);
  const points = reports.data?.reports ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/reports" className="text-accent underline underline-offset-4">
          {t('listView')}
        </Link>
      </div>
      <p className="text-muted">{t('intro')}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          label={t('category')}
          value={filters.categoryId ?? ''}
          options={[
            { value: '', label: tPublic('allCategories') },
            ...(categories.data ?? []).map((category) => ({
              value: category.id,
              label: category.parentId
                ? `— ${categoryName(category, locale)}`
                : categoryName(category, locale),
            })),
          ]}
          onChange={(event) =>
            setFilters({ ...filters, categoryId: event.target.value || undefined })
          }
        />
        <SelectField
          label={t('status')}
          value={filters.status ?? ''}
          options={[
            { value: '', label: tPublic('allStatuses') },
            ...STATUSES.map((value) => ({ value, label: tStatus(value) })),
          ]}
          onChange={(event) =>
            setFilters({
              ...filters,
              status: (event.target.value || undefined) as MapPoint['status'] | undefined,
            })
          }
        />
        <TextField
          label={t('from')}
          type="date"
          value={filters.from ?? ''}
          onChange={(event) => setFilters({ ...filters, from: event.target.value || undefined })}
        />
        <TextField
          label={t('to')}
          type="date"
          value={filters.to ?? ''}
          onChange={(event) => setFilters({ ...filters, to: event.target.value || undefined })}
        />
      </div>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={showAreas}
          onChange={(event) => setShowAreas(event.target.checked)}
        />
        <span>{t('showAreas')}</span>
      </label>
      <p aria-live="polite" className="text-sm">
        {bounds && isTooWide(bounds) ? t('zoomIn') : t('inView', { count: points.length })}
        {reports.data?.truncated && ` ${t('truncated')}`}
      </p>
      {reports.isError && <FormAlert tone="error">{t('loadFailed')}</FormAlert>}
      <ReportsMap
        points={points}
        areas={showAreas ? (areas.data ?? []) : null}
        onBounds={setBounds}
        statusLabel={(status) => tStatus(status)}
        openLabel={t('openReport')}
        label={t('mapLabel')}
        unavailableText={t('unavailable')}
        attribution={tForm('mapAttribution')}
      />
      <ul className="flex flex-wrap gap-4 text-sm" aria-label={t('legend')}>
        {(['open', 'work', 'done'] as const).map((key) => (
          <li key={key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: STAGE_COLORS[key] }}
            />
            {t(`stages.${key}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
