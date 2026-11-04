'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { LocationMap, type MapPoint } from './location-map';

/** Same bounds the API enforces (launch country: Bangladesh). */
export const SERVICE_BOUNDS = { minLat: 20.3, maxLat: 26.8, minLng: 88.0, maxLng: 92.8 } as const;

export function inServiceBounds(point: MapPoint): boolean {
  return (
    point.latitude >= SERVICE_BOUNDS.minLat &&
    point.latitude <= SERVICE_BOUNDS.maxLat &&
    point.longitude >= SERVICE_BOUNDS.minLng &&
    point.longitude <= SERVICE_BOUNDS.maxLng
  );
}

export interface PickedLocation extends MapPoint {
  accuracyM: number | null;
}

/**
 * Location input with three equivalent ways in: tapping/dragging on the map, the device's
 * location (only after the user asks, and never required), or typed coordinates, which also
 * keeps the control usable with a keyboard or screen reader.
 */
export function LocationPicker({
  value,
  onChange,
  error,
}: {
  value: PickedLocation | null;
  onChange: (location: PickedLocation) => void;
  error?: string;
}) {
  const t = useTranslations('ReportForm');
  const format = useFormatter();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string>();

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoError(t('locationUnavailable'));
      return;
    }
    setLocating(true);
    setGeoError(undefined);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: Math.round(position.coords.accuracy),
        };
        if (!inServiceBounds(point)) {
          setGeoError(t('outOfArea'));
          return;
        }
        onChange(point);
      },
      (failure) => {
        setLocating(false);
        setGeoError(
          failure.code === failure.PERMISSION_DENIED
            ? t('locationDenied')
            : t('locationUnavailable'),
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  const setCoordinate = (field: 'latitude' | 'longitude', raw: string) => {
    const number = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(number)) return;
    onChange({
      latitude: field === 'latitude' ? number : (value?.latitude ?? 23.8103),
      longitude: field === 'longitude' ? number : (value?.longitude ?? 90.4125),
      accuracyM: null,
    });
  };

  const message = geoError ?? error;
  return (
    <fieldset className="space-y-3">
      <legend className="font-medium">{t('location')}</legend>
      <p className="text-muted text-sm">{t('locationHint')}</p>
      <LocationMap
        value={value}
        onChange={(point) => onChange({ ...point, accuracyM: null })}
        label={t('mapLabel')}
        attribution={t('mapAttribution')}
        unavailableText={t('mapUnavailable')}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" busy={locating} onClick={useMyLocation}>
          {locating ? t('locating') : t('useMyLocation')}
        </Button>
        <p aria-live="polite" className="text-sm">
          {value &&
            t('locationSelected', {
              lat: format.number(value.latitude, { maximumFractionDigits: 5 }),
              lng: format.number(value.longitude, { maximumFractionDigits: 5 }),
            })}
          {value?.accuracyM != null && ` · ${t('locationAccuracy', { meters: value.accuracyM })}`}
        </p>
      </div>
      {message && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
          {message}
        </p>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer">{t('coordinatesHint')}</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <TextField
            label={t('latitude')}
            inputMode="decimal"
            defaultValue={value?.latitude.toFixed(6) ?? ''}
            key={`lat-${value?.latitude ?? 'none'}`}
            onBlur={(event) => setCoordinate('latitude', event.target.value)}
          />
          <TextField
            label={t('longitude')}
            inputMode="decimal"
            defaultValue={value?.longitude.toFixed(6) ?? ''}
            key={`lng-${value?.longitude ?? 'none'}`}
            onBlur={(event) => setCoordinate('longitude', event.target.value)}
          />
        </div>
      </details>
    </fieldset>
  );
}
