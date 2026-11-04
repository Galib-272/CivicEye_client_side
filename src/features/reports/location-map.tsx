'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import type { Map as MapLibreMap, MapMouseEvent, Marker } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

/**
 * OpenFreeMap vector tiles (OpenStreetMap data): free, no API key, commercial use allowed,
 * but with no service-level guarantee. The tile provider must be confirmed before launch.
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
/** Dhaka (approved launch area). */
export const DEFAULT_CENTER: [number, number] = [90.4125, 23.8103];

export interface MapPoint {
  latitude: number;
  longitude: number;
}

type MarkerRef = { current: Marker | null };
type ChangeRef = { current: ((point: MapPoint) => void) | undefined };

/** Returns the map's single marker, creating it (draggable when interactive) on first use. */
function placeMarker(
  maplibregl: typeof import('maplibre-gl'),
  instance: MapLibreMap,
  marker: MarkerRef,
  onChange: ChangeRef,
  draggable: boolean,
): Marker {
  if (marker.current) return marker.current;
  const created = new maplibregl.Marker({ draggable, color: '#0b5cad' })
    .setLngLat(instance.getCenter())
    .addTo(instance);
  created.on('dragend', () => {
    const lngLat = created.getLngLat();
    onChange.current?.({ latitude: lngLat.lat, longitude: lngLat.lng });
  });
  marker.current = created;
  return created;
}

/**
 * MapLibre map with one marker. Interactive mode lets the user tap to place the marker and
 * drag it; read-only mode just shows the point. Loaded only in the browser.
 */
export function LocationMap({
  value,
  onChange,
  label,
  attribution,
  unavailableText,
  interactive = true,
  zoom = 13,
  className,
}: {
  value: MapPoint | null;
  onChange?: (point: MapPoint) => void;
  label: string;
  attribution: string;
  /** Shown when the map cannot start (e.g. no WebGL); the other inputs still work. */
  unavailableText: string;
  interactive?: boolean;
  zoom?: number;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const initial = useRef(value);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    void import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !container.current) return;
      const start = initial.current;
      let instance: MapLibreMap;
      try {
        instance = new maplibregl.Map({
          container: container.current,
          style: MAP_STYLE_URL,
          center: start ? [start.longitude, start.latitude] : DEFAULT_CENTER,
          zoom: start ? zoom + 3 : zoom,
          interactive,
          attributionControl: { compact: true, customAttribution: attribution },
        });
      } catch {
        setUnavailable(true);
        return;
      }
      map.current = instance;
      if (interactive) {
        instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        instance.on('click', (event: MapMouseEvent) =>
          onChangeRef.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }),
        );
      }
      const point = initial.current;
      if (point)
        placeMarker(maplibregl, instance, marker, onChangeRef, interactive).setLngLat([
          point.longitude,
          point.latitude,
        ]);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [interactive, zoom, attribution]);

  // Keep the marker in sync with the value (tap, drag, "use my location" or typed coordinates).
  useEffect(() => {
    const instance = map.current;
    if (!instance || !value) return;
    void import('maplibre-gl').then((maplibregl) => {
      placeMarker(maplibregl, instance, marker, onChangeRef, interactive).setLngLat([
        value.longitude,
        value.latitude,
      ]);
      if (!instance.getBounds().contains([value.longitude, value.latitude])) {
        instance.easeTo({
          center: [value.longitude, value.latitude],
          zoom: Math.max(instance.getZoom(), 15),
        });
      }
    });
  }, [value, interactive]);

  if (unavailable) {
    return (
      <p role="status" className={`border-border bg-surface rounded-md border p-4 text-sm`}>
        {unavailableText}
      </p>
    );
  }
  return (
    <div
      ref={container}
      role="region"
      aria-label={label}
      className={`border-border bg-surface overflow-hidden rounded-md border ${className ?? 'h-72'}`}
    />
  );
}
