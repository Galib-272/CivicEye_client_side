'use client';

import { useFormatter, useTranslations } from 'next-intl';
import type { Assignment } from '@/features/review/api';

type Photo = { id: string; thumbnailUrl: string | null; displayUrl: string | null };

/** Thumbnails that open the full photo (short-lived signed URLs). */
export function PhotoGrid({ photos, alt }: { photos: Photo[]; alt: (index: number) => string }) {
  if (photos.length === 0) return null;
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {photos.map((photo, index) =>
        photo.displayUrl ? (
          <li key={photo.id}>
            <a href={photo.displayUrl} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
              <img
                src={photo.thumbnailUrl ?? photo.displayUrl}
                alt={alt(index)}
                className="aspect-square w-full rounded-md object-cover"
              />
            </a>
          </li>
        ) : null,
      )}
    </ul>
  );
}

function useDate() {
  const format = useFormatter();
  return (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
}

/** Everything that happened to one assignment: events, progress photos and verifications. */
export function AssignmentHistory({ assignment }: { assignment: Assignment }) {
  const t = useTranslations('Work');
  const date = useDate();
  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {assignment.events.map((event, index) => (
          <li
            key={`${event.createdAt}-${index}`}
            className="border-border space-y-1 border-s-2 ps-3"
          >
            <p className="font-medium">{t(`events.${event.kind}`)}</p>
            <p className="text-muted text-sm">
              {t('byActor', { name: event.actorName ?? t('system'), date: date(event.createdAt) })}
            </p>
            {event.message && <p className="text-sm whitespace-pre-line">{event.message}</p>}
            <PhotoGrid
              photos={event.photos}
              alt={(photo) => t('photoAlt', { number: photo + 1 })}
            />
          </li>
        ))}
      </ol>
      {assignment.submissions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold">{t('submissions')}</h3>
          {assignment.submissions.map((submission) => (
            <div key={submission.id} className="border-border space-y-2 rounded-md border p-3">
              <p className="text-muted text-sm">
                {t('submittedOn', { date: date(submission.createdAt) })}
              </p>
              <p className="whitespace-pre-line">{submission.description}</p>
              <PhotoGrid
                photos={submission.photos}
                alt={(photo) => t('photoAlt', { number: photo + 1 })}
              />
              {submission.verification && (
                <p className="text-sm">
                  <strong>
                    {t('verifiedBy', {
                      outcome: t(`verification.${submission.verification.outcome}`),
                      name: submission.verification.verifierName,
                    })}
                  </strong>
                  {submission.verification.reason && ` — ${submission.verification.reason}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
