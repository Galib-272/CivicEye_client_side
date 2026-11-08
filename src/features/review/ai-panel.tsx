'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Badge, Section } from '@/components/ui/section';
import { SelectField } from '@/components/ui/select-field';
import { errorMessage } from '@/features/auth/server-errors';
import {
  useAiReview,
  useAiSuggestions,
  type AiLabel,
  type AiPrediction,
  type AiReviewBody,
  type WorkspaceReport,
  type WorkspaceScope,
} from './api';

const LABELS: AiLabel[] = ['pothole', 'crack', 'asphalt_damage', 'no_damage'];

/** The photo with the AI's boxes drawn over it (box corners are fractions of width/height). */
function PhotoWithBoxes({
  url,
  alt,
  detections,
}: {
  url: string;
  alt: string;
  detections: AiPrediction['detections'];
}) {
  const t = useTranslations('Ai');
  return (
    <figure className="relative max-w-sm">
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
      <img src={url} alt={alt} className="h-auto w-full rounded-md" />
      {detections.map((detection, index) => {
        const [left = 0, top = 0, right = 0, bottom = 0] = detection.box;
        return (
          <span
            key={index}
            data-testid="ai-box"
            aria-hidden="true"
            className="absolute rounded-sm border-2 border-amber-400 shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
            style={{
              left: `${left * 100}%`,
              top: `${top * 100}%`,
              width: `${(right - left) * 100}%`,
              height: `${(bottom - top) * 100}%`,
            }}
          />
        );
      })}
      {detections.length > 0 && (
        <figcaption className="text-muted mt-1 text-sm">
          {t('boxes', { count: detections.length })}
        </figcaption>
      )}
    </figure>
  );
}

function ReviewControls({
  prediction,
  onReview,
  busy,
}: {
  prediction: AiPrediction;
  onReview: (body: AiReviewBody) => void;
  busy: boolean;
}) {
  const t = useTranslations('Ai');
  const [correcting, setCorrecting] = useState(false);
  const [label, setLabel] = useState<AiLabel | ''>('');

  if (prediction.review) {
    const { action, correctedLabel } = prediction.review;
    return (
      <p className="text-sm">
        {action === 'CORRECTED' && correctedLabel
          ? t('reviewedCorrected', { label: t(`labels.${correctedLabel}`) })
          : t(action === 'ACCEPTED' ? 'reviewedAccepted' : 'reviewedDismissed')}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-muted text-sm">{t('feedbackHint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" busy={busy} onClick={() => onReview({ action: 'ACCEPTED' })}>
          {t('agree')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          aria-expanded={correcting}
          onClick={() => setCorrecting((open) => !open)}
        >
          {t('wrong')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          busy={busy}
          onClick={() => onReview({ action: 'DISMISSED' })}
        >
          {t('dismiss')}
        </Button>
      </div>
      {correcting && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (label) onReview({ action: 'CORRECTED', correctedLabel: label });
          }}
        >
          <SelectField
            label={t('actuallyShows')}
            value={label}
            onChange={(event) => setLabel(event.target.value as AiLabel | '')}
            options={[
              { value: '', label: t('choose'), disabled: true },
              ...LABELS.map((value) => ({ value, label: t(`labels.${value}`) })),
            ]}
          />
          <Button type="submit" busy={busy} disabled={!label}>
            {t('saveCorrection')}
          </Button>
        </form>
      )}
    </div>
  );
}

function PredictionCard({
  prediction,
  photo,
  onReview,
  busy,
}: {
  prediction: AiPrediction;
  photo: WorkspaceReport['photos'][number] | undefined;
  onReview: (body: AiReviewBody) => void;
  busy: boolean;
}) {
  const t = useTranslations('Ai');
  const tReport = useTranslations('Report');
  const locale = useLocale();
  const format = useFormatter();
  const number = prediction.photoPosition + 1;
  const percent = (value: number) => format.number(value, { style: 'percent' });

  return (
    <li className="border-border space-y-3 rounded-md border p-3" data-testid="ai-prediction">
      <h3 className="font-medium">{t('photo', { number })}</h3>
      {prediction.status === 'PENDING' && (
        <p className="text-muted" aria-live="polite">
          {t('analysing')}
        </p>
      )}
      {prediction.status === 'FAILED' && <p className="text-muted">{t('failed')}</p>}
      {prediction.status === 'SUCCEEDED' && prediction.label && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">
              {prediction.uncertain
                ? t('uncertain')
                : t('likely', { label: t(`labels.${prediction.label}`) })}
            </p>
            {prediction.confidence !== null && (
              <Badge>{t('score', { score: percent(prediction.confidence) })}</Badge>
            )}
          </div>
          {prediction.uncertain && (
            <p className="text-sm">
              {t('uncertainBest', { label: t(`labels.${prediction.label}`) })}
            </p>
          )}
          {prediction.warnings.length > 0 && (
            <FormAlert tone="info">
              {prediction.warnings
                .map((warning) => (warning === 'too_dark' ? t('tooDark') : t('blurry')))
                .join(' ')}
            </FormAlert>
          )}
          {photo?.displayUrl && (
            <PhotoWithBoxes
              url={photo.displayUrl}
              alt={tReport('photoAlt', { number })}
              detections={prediction.detections}
            />
          )}
          {prediction.suggestedCategories.length > 0 && (
            <p className="text-sm">
              {t('matchingCategories', {
                names: prediction.suggestedCategories
                  .map((category) => (locale === 'bn' ? category.nameBn : category.nameEn))
                  .join(', '),
              })}
            </p>
          )}
          <ReviewControls prediction={prediction} onReview={onReview} busy={busy} />
          <p className="text-muted text-xs">
            {t('modelVersion', { version: prediction.modelVersion ?? '—' })}
          </p>
        </>
      )}
    </li>
  );
}

/**
 * Advisory AI analysis of the report's photos (PRD §17.5-17.6): a suggestion only, worded as
 * such, with the reviewer's agreement or correction recorded to measure the model.
 */
export function AiPanel({ scope, report }: { scope: WorkspaceScope; report: WorkspaceReport }) {
  const t = useTranslations('Ai');
  const tErrors = useTranslations('Errors');
  const suggestions = useAiSuggestions(scope, report.publicId);
  const review = useAiReview(scope, report.publicId);
  const data = suggestions.data;

  if (suggestions.isError || !data) return null;
  if (data.predictions.length === 0 && !data.enabled) return null;

  return (
    <Section title={t('heading')}>
      <FormAlert tone="info">{t('advisory')}</FormAlert>
      {review.isError && <FormAlert tone="error">{errorMessage(review.error, tErrors)}</FormAlert>}
      {data.predictions.length === 0 ? (
        <p className="text-muted">{t('none')}</p>
      ) : (
        <ul className="space-y-3">
          {data.predictions.map((prediction) => (
            <PredictionCard
              key={prediction.id}
              prediction={prediction}
              photo={report.photos.find((photo) => photo.id === prediction.mediaId)}
              busy={review.isPending}
              onReview={(body) => review.mutate({ predictionId: prediction.id, body })}
            />
          ))}
        </ul>
      )}
      {!data.enabled && <p className="text-muted text-sm">{t('switchedOff')}</p>}
    </Section>
  );
}
