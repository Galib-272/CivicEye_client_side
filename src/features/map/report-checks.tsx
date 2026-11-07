'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { FormAlert } from '@/components/ui/form-alert';
import { StatusBadge } from '@/features/reports/report-detail';
import { Link } from '@/i18n/navigation';
import { useNearbyReports, useOrganizationMatch } from './api';

type Point = { latitude: number; longitude: number } | null;

/** "Already reported nearby?": similar public reports close to the chosen point. */
export function NearbyWarning({ point, categoryId }: { point: Point; categoryId: string }) {
  const t = useTranslations('Map');
  const format = useFormatter();
  const nearby = useNearbyReports(point, categoryId);
  if (!nearby.data || nearby.data.length === 0) return null;
  return (
    <FormAlert tone="info">
      <p className="font-medium">{t('nearbyHeading')}</p>
      <p className="text-sm">{t('nearbyHint')}</p>
      <ul className="mt-2 space-y-2">
        {nearby.data.map((report) => (
          <li key={report.publicId} className="flex flex-wrap items-center gap-2">
            <Link
              href={`/reports/${report.publicId}`}
              target="_blank"
              className="underline underline-offset-4"
            >
              {report.title}
            </Link>
            <StatusBadge status={report.status} />
            <span className="text-sm">
              {t('distance', { meters: report.distanceM })} ·{' '}
              {format.dateTime(new Date(report.submittedAt), { dateStyle: 'medium' })}
            </span>
          </li>
        ))}
      </ul>
    </FormAlert>
  );
}

/** Which organization will receive the report, so nobody has to guess. */
export function RoutingPreview({ point, categoryId }: { point: Point; categoryId: string }) {
  const t = useTranslations('Map');
  const match = useOrganizationMatch(point, categoryId);
  if (!match.data) return null;
  const [only] = match.data;
  return (
    <p className="text-sm" role="status">
      {match.data.length === 1 && only
        ? t('routedTo', { name: only.name })
        : match.data.length === 0
          ? t('noOrganization')
          : t('severalOrganizations')}
    </p>
  );
}
