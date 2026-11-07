import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient, callApi } from '@/lib/api/client';
import type { operations } from '@/types/api.generated';

type Data<Op extends keyof operations> = operations[Op]['responses'] extends {
  200: { content: { 'application/json': { data: infer D } } };
}
  ? D
  : never;

export type MapReports = Data<'MapController_reports_v1'>;
export type MapPoint = MapReports['reports'][number];
export type OrganizationArea = Data<'MapController_organizations_v1'>[number];
export type NearbyReport = Data<'MapController_nearby_v1'>[number];

export interface Bounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface MapFilters {
  categoryId?: string;
  status?: MapPoint['status'];
  from?: string;
  to?: string;
}

/** The API serves at most a 3° box; wider views ask the user to zoom in. */
export const MAX_SPAN = 3;
export const isTooWide = (bounds: Bounds) =>
  bounds.maxLng - bounds.minLng > MAX_SPAN || bounds.maxLat - bounds.minLat > MAX_SPAN;

const round = (value: number) => Math.round(value * 1000) / 1000;

export function useMapReports(bounds: Bounds | null, filters: MapFilters) {
  const box = bounds && !isTooWide(bounds) ? bounds : null;
  return useQuery({
    // Rounded so tiny pans reuse the same request.
    queryKey: [
      'reports',
      'map',
      box && [round(box.minLng), round(box.minLat), round(box.maxLng), round(box.maxLat)],
      filters,
    ],
    enabled: box !== null,
    placeholderData: keepPreviousData,
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/map/reports', {
          params: { query: { ...(box as Bounds), ...filters } },
        }),
      ),
  });
}

export function useOrganizationAreas(enabled: boolean) {
  return useQuery({
    queryKey: ['map', 'areas'],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: () => callApi(() => apiClient().GET('/api/v1/map/organizations')),
  });
}

/** Public reports of the same kind near a point, shown before someone reports again. */
export function useNearbyReports(
  point: { latitude: number; longitude: number } | null,
  categoryId: string,
) {
  return useQuery({
    queryKey: ['reports', 'nearby', point?.latitude, point?.longitude, categoryId],
    enabled: point !== null && categoryId !== '',
    queryFn: () =>
      callApi(() =>
        apiClient().GET('/api/v1/map/nearby', {
          params: {
            query: {
              latitude: (point as { latitude: number }).latitude,
              longitude: (point as { longitude: number }).longitude,
              categoryId,
            },
          },
        }),
      ),
  });
}

/** Organizations covering a point: one means the report goes there automatically. */
export function useOrganizationMatch(
  point: { latitude: number; longitude: number } | null,
  categoryId: string,
) {
  return useQuery({
    queryKey: ['map', 'match', point?.latitude, point?.longitude, categoryId],
    enabled: point !== null,
    queryFn: () =>
      callApi(() =>
        apiClient().POST('/api/v1/locations/organization-match', {
          body: {
            latitude: (point as { latitude: number }).latitude,
            longitude: (point as { longitude: number }).longitude,
            categoryId: categoryId || undefined,
          },
        }),
      ),
  });
}
