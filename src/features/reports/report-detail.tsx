'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Badge, Section } from '@/components/ui/section';
import { TextAreaField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { errorDetail, errorMessage } from '@/features/auth/server-errors';
import {
  isOwnReport,
  useReport,
  useProvideInformation,
  usePublicUpdates,
  useReportHistory,
  MAX_PHOTOS,
  useUpdateReport,
  useWithdrawReport,
  type OwnReport,
  type ReportStatus,
} from './api';
import { LocationMap } from './location-map';
import { PhotoUploader, type PhotoItem } from './photo-uploader';

export function StatusBadge({ status }: { status: ReportStatus }) {
  const t = useTranslations('ReportStatus');
  const tone =
    status === 'RESOLVED' || status === 'CLOSED'
      ? 'good'
      : status === 'WITHDRAWN' || status === 'REJECTED'
        ? 'neutral'
        : 'warn';
  return <Badge tone={tone}>{t(status)}</Badge>;
}

function EditForm({
  report,
  onSaved,
  onCancel,
}: {
  report: OwnReport;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('Report');
  const tForm = useTranslations('ReportForm');
  const tErrors = useTranslations('Errors');
  const update = useUpdateReport(report.publicId);
  const [values, setValues] = useState({
    title: report.title,
    description: report.description,
    locationDescription: report.locationDescription ?? '',
    visibility: report.visibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    update.mutate(
      {
        version: report.version,
        body: {
          title: values.title.trim(),
          description: values.description.trim(),
          locationDescription: values.locationDescription.trim() || null,
          visibility: values.visibility as 'PUBLIC' | 'PRIVATE',
        },
      },
      { onSuccess: onSaved },
    );
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {update.isError && (
        <FormAlert tone="error">
          <p>{errorMessage(update.error, tErrors)}</p>
          {errorDetail(update.error) && <p className="text-sm">{errorDetail(update.error)}</p>}
        </FormAlert>
      )}
      <TextField
        label={tForm('titleLabel')}
        hint={tForm('titleHint')}
        value={values.title}
        minLength={5}
        maxLength={120}
        required
        onChange={(event) => setValues({ ...values, title: event.target.value })}
      />
      <TextAreaField
        label={tForm('description')}
        hint={tForm('descriptionHint')}
        rows={5}
        value={values.description}
        minLength={10}
        maxLength={2000}
        required
        onChange={(event) => setValues({ ...values, description: event.target.value })}
      />
      <TextField
        label={tForm('locationDescription')}
        value={values.locationDescription}
        maxLength={300}
        onChange={(event) => setValues({ ...values, locationDescription: event.target.value })}
      />
      <fieldset className="space-y-2">
        <legend className="font-medium">{tForm('visibility')}</legend>
        {(['PUBLIC', 'PRIVATE'] as const).map((option) => (
          <label key={option} className="flex items-start gap-2">
            <input
              type="radio"
              name="visibility"
              value={option}
              className="mt-1"
              checked={values.visibility === option}
              onChange={() => setValues({ ...values, visibility: option })}
            />
            <span>{option === 'PUBLIC' ? tForm('public') : tForm('private')}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button busy={update.isPending}>{t('save')}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}

function OwnerActions({ report }: { report: OwnReport }) {
  const t = useTranslations('Report');
  const tErrors = useTranslations('Errors');
  const withdraw = useWithdrawReport(report.publicId);
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState(false);

  if (!report.canEdit && !report.canWithdraw) return null;
  return (
    <div className="space-y-6">
      {report.canEdit && (
        <Section title={t('edit')}>
          {saved && !editing && <FormAlert tone="success">{t('saved')}</FormAlert>}
          {editing ? (
            <EditForm
              report={report}
              onSaved={() => {
                setEditing(false);
                setSaved(true);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <p className="text-muted text-sm">{t('editHint')}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSaved(false);
                  setEditing(true);
                }}
              >
                {t('edit')}
              </Button>
            </>
          )}
        </Section>
      )}
      {report.canWithdraw && (
        <Section title={t('withdraw')}>
          <p className="text-muted text-sm">{t('withdrawHint')}</p>
          {withdraw.isError && (
            <FormAlert tone="error">{errorMessage(withdraw.error, tErrors)}</FormAlert>
          )}
          <TextAreaField
            label={t('withdrawReason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            busy={withdraw.isPending}
            disabled={reason.trim().length < 5}
            onClick={() => withdraw.mutate(reason.trim())}
          >
            {t('withdrawConfirm')}
          </Button>
        </Section>
      )}
    </div>
  );
}

/** The organization's open question, with the citizen's answer form (text and optional photos). */
function InformationRequest({ report }: { report: OwnReport }) {
  const t = useTranslations('ReportExtra');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const provide = useProvideInformation(report.publicId);
  const [message, setMessage] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const request = report.informationRequest;
  if (provide.isSuccess) return <FormAlert tone="success">{t('answerSent')}</FormAlert>;
  if (!request || !report.canProvideInformation) return null;

  const ready = photos.filter((photo) => photo.state === 'ready');
  const pending = photos.some(
    (photo) => photo.state === 'uploading' || photo.state === 'processing',
  );
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    provide.mutate({
      message: message.trim(),
      mediaIds: ready.map((photo) => photo.mediaId).filter((id): id is string => !!id),
    });
  };

  return (
    <Section title={t('informationHeading')}>
      <div className="border-accent rounded-md border-s-4 ps-3">
        <p className="text-muted text-sm">
          {t('informationIntro')} ·{' '}
          {format.dateTime(new Date(request.requestedAt), { dateStyle: 'medium' })}
        </p>
        <p className="whitespace-pre-line">{request.message}</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        {provide.isError && (
          <FormAlert tone="error">
            <p>{errorMessage(provide.error, tErrors)}</p>
            {errorDetail(provide.error) && <p className="text-sm">{errorDetail(provide.error)}</p>}
          </FormAlert>
        )}
        <TextAreaField
          label={t('answerLabel')}
          rows={4}
          minLength={10}
          maxLength={2000}
          required
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <PhotoUploader
          photos={photos}
          onChange={setPhotos}
          max={Math.max(0, MAX_PHOTOS - report.photos.length)}
          legend={t('answerPhotos')}
          hint={t('answerPhotosHint')}
          inputId="answer-photos"
        />
        <Button busy={provide.isPending} disabled={pending || message.trim().length < 10}>
          {t('sendAnswer')}
        </Button>
      </form>
    </Section>
  );
}

function OrganizationUpdates({ publicId }: { publicId: string }) {
  const t = useTranslations('ReportExtra');
  const format = useFormatter();
  const updates = usePublicUpdates(publicId, true);
  if (!updates.data) return null;
  return (
    <Section title={t('updatesHeading')}>
      {updates.data.length === 0 ? (
        <p className="text-muted">{t('noUpdates')}</p>
      ) : (
        <ul className="space-y-3">
          {updates.data.map((update) => (
            <li key={update.id} className="border-border border-s-2 ps-3">
              <p className="whitespace-pre-line">{update.body}</p>
              <p className="text-muted text-sm">
                {update.organizationName} ·{' '}
                {format.dateTime(new Date(update.createdAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function ReportDetail({ publicId }: { publicId: string }) {
  const t = useTranslations('Report');
  const tForm = useTranslations('ReportForm');
  const tStatus = useTranslations('ReportStatus');
  const tCommon = useTranslations('Common');
  const tErrors = useTranslations('Errors');
  const locale = useLocale();
  const format = useFormatter();
  const report = useReport(publicId);
  const history = useReportHistory(publicId, report.isSuccess);
  const tExtra = useTranslations('ReportExtra');
  const tReasons = useTranslations('RejectionReason');

  if (report.isError) {
    return (
      <FormAlert tone="error">
        {report.error && 'status' in report.error && report.error.status === 404
          ? t('notFound')
          : errorMessage(report.error, tErrors)}
      </FormAlert>
    );
  }
  if (!report.data) return <p aria-live="polite">{tCommon('loading')}</p>;

  const data = report.data;
  const own = isOwnReport(data) ? data : null;
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-muted font-mono text-sm">{data.publicId}</p>
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={data.status} />
          {own && (
            <Badge>{own.visibility === 'PRIVATE' ? t('privateBadge') : t('publicBadge')}</Badge>
          )}
          <span className="text-muted text-sm">
            {t('submitted', { date: date(data.submittedAt) })}
          </span>
        </div>
      </div>
      {own?.status === 'WITHDRAWN' && <FormAlert tone="info">{t('withdrawn')}</FormAlert>}
      {own?.rejection && (
        <FormAlert tone="info">
          <p className="font-medium">{tExtra('rejectedHeading')}</p>
          <p>{tExtra('rejectedReason', { reason: tReasons(own.rejection.reason) })}</p>
          <p className="whitespace-pre-line">{own.rejection.message}</p>
        </FormAlert>
      )}
      {own && <InformationRequest report={own} />}

      <Section title={t('category')}>
        <p>{locale === 'bn' ? data.category.nameBn : data.category.nameEn}</p>
        <p className="whitespace-pre-line">{data.description}</p>
        <dl className="space-y-1 text-sm">
          <dt className="text-muted">{t('organization')}</dt>
          <dd>{data.organizationName ?? t('noOrganization')}</dd>
          {own && <dd className="text-muted">{t(`routing.${own.routing}`)}</dd>}
        </dl>
      </Section>

      <Section title={t('photosHeading')}>
        {own ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {own.photos.map((photo, index) =>
              photo.displayUrl ? (
                <li key={photo.id}>
                  <a href={photo.displayUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                    <img
                      src={photo.thumbnailUrl ?? photo.displayUrl}
                      alt={t('photoAlt', { number: index + 1 })}
                      className="aspect-square w-full rounded-md object-cover"
                    />
                  </a>
                </li>
              ) : null,
            )}
          </ul>
        ) : (
          <p className="text-muted">{t('noPublicPhotos')}</p>
        )}
      </Section>

      <Section title={t('locationHeading')}>
        <p className="text-muted text-sm">{own ? t('exact') : t('approximate')}</p>
        <LocationMap
          value={{ latitude: data.latitude, longitude: data.longitude }}
          label={t('locationHeading')}
          attribution={tForm('mapAttribution')}
          unavailableText={tForm('mapUnavailableReadOnly')}
          interactive={false}
          zoom={13}
          className="h-56"
        />
        {data.locationDescription && <p>{data.locationDescription}</p>}
      </Section>

      <OrganizationUpdates publicId={publicId} />

      <Section title={t('timeline')}>
        {!history.data ? (
          <p aria-live="polite">{tCommon('loading')}</p>
        ) : (
          <ol className="space-y-3">
            {history.data.map((entry) => (
              <li
                key={`${entry.createdAt}-${entry.toStatus}`}
                className="border-border border-s-2 ps-3"
              >
                <p className="font-medium">{tStatus(entry.toStatus)}</p>
                <p className="text-muted text-sm">{date(entry.createdAt)}</p>
                {entry.publicMessage && (
                  <p className="text-sm">{t('publicMessage', { message: entry.publicMessage })}</p>
                )}
                {entry.reason && (
                  <p className="text-sm">{t('reasonText', { reason: entry.reason })}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>

      {own && <OwnerActions report={own} />}
    </div>
  );
}
