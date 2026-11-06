'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Badge, Section } from '@/components/ui/section';
import { TextAreaField } from '@/components/ui/select-field';
import { RequireAuth } from '@/features/auth/require-auth';
import { errorDetail, errorMessage } from '@/features/auth/server-errors';
import { LocationMap } from '@/features/reports/location-map';
import { PhotoUploader, type PhotoItem } from '@/features/reports/photo-uploader';
import { MAX_PHOTOS } from '@/features/reports/api';
import { Link } from '@/i18n/navigation';
import { AssignmentHistory, PhotoGrid } from './assignment-history';
import {
  TASK_GROUPS,
  useSetAvailability,
  useTask,
  useTaskAction,
  useTasks,
  useWorkMemberships,
  type TaskAction,
  type TaskGroup,
} from './api';

function ErrorAlert({ error }: { error: unknown }) {
  const tErrors = useTranslations('Errors');
  return (
    <FormAlert tone="error">
      <p>{errorMessage(error, tErrors)}</p>
      {errorDetail(error) && <p className="text-sm">{errorDetail(error)}</p>}
    </FormAlert>
  );
}

function Availability() {
  const t = useTranslations('Work');
  const memberships = useWorkMemberships();
  const update = useSetAvailability();
  if (!memberships.data) return null;
  if (memberships.data.length === 0) return <FormAlert tone="info">{t('notWorker')}</FormAlert>;
  return (
    <Section title={t('availability')}>
      {update.isError && <ErrorAlert error={update.error} />}
      <ul className="space-y-2">
        {memberships.data.map((membership) => (
          <li key={membership.organizationId}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={membership.available}
                disabled={update.isPending}
                onChange={(event) =>
                  update.mutate({
                    organizationId: membership.organizationId,
                    available: event.target.checked,
                  })
                }
              />
              <span>{t('availableAt', { organization: membership.organizationName })}</span>
            </label>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function WorkDashboard() {
  const t = useTranslations('Work');
  const tCommon = useTranslations('Common');
  const tPublic = useTranslations('PublicReports');
  const locale = useLocale();
  const format = useFormatter();
  const [group, setGroup] = useState<TaskGroup>('TO_ACCEPT');
  const [page, setPage] = useState(1);
  const tasks = useTasks(group, page);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted">{t('intro')}</p>
      </div>
      <Availability />
      <nav aria-label={t('groupsLabel')}>
        <ul className="flex flex-wrap gap-2">
          {TASK_GROUPS.map((value) => (
            <li key={value}>
              <button
                type="button"
                aria-current={group === value ? 'page' : undefined}
                onClick={() => {
                  setGroup(value);
                  setPage(1);
                }}
                className={`focus-ring rounded-md border px-3 py-2 text-sm font-medium ${
                  group === value ? 'bg-accent text-background border-accent' : 'border-border'
                }`}
              >
                {t(`groups.${value}`)}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      {tasks.isError ? (
        <ErrorAlert error={tasks.error} />
      ) : !tasks.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : tasks.data.items.length === 0 ? (
        <p className="text-muted">{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {tasks.data.items.map((item) => (
            <li key={item.id} className="border-border space-y-1 rounded-md border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`/work/${item.id}`}
                  className="text-accent font-medium underline underline-offset-4"
                >
                  {item.title}
                </Link>
                <Badge tone={item.state === 'PENDING' ? 'warn' : 'neutral'}>
                  {t(`states.${item.state}`)}
                </Badge>
              </div>
              <p className="text-muted text-sm">
                {item.organizationName} ·{' '}
                {locale === 'bn' ? item.category.nameBn : item.category.nameEn} ·{' '}
                {format.dateTime(new Date(item.assignedAt), { dateStyle: 'medium' })}
              </p>
              {item.locationDescription && <p className="text-sm">{item.locationDescription}</p>}
            </li>
          ))}
        </ul>
      )}
      {(tasks.data?.totalPages ?? 1) > 1 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {tPublic('previous')}
          </Button>
          <span>{tPublic('page', { page, pages: tasks.data?.totalPages ?? 1 })}</span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= (tasks.data?.totalPages ?? 1)}
            onClick={() => setPage(page + 1)}
          >
            {tPublic('next')}
          </Button>
        </div>
      )}
    </div>
  );
}

export function WorkDashboardPage() {
  return <RequireAuth>{() => <WorkDashboard />}</RequireAuth>;
}

/** A form inside a collapsible section, so the task page stays short. */
function ActionForm({
  summary,
  children,
  confirm,
  disabled,
  busy,
  onSubmit,
}: {
  summary: string;
  children: ReactNode;
  confirm: string;
  disabled: boolean;
  busy: boolean;
  onSubmit: () => void;
}) {
  return (
    <details className="border-border rounded-md border p-3">
      <summary className="cursor-pointer font-medium">{summary}</summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
        <Button busy={busy} disabled={disabled}>
          {confirm}
        </Button>
      </form>
    </details>
  );
}

const readyIds = (photos: PhotoItem[]) =>
  photos
    .filter((photo) => photo.state === 'ready')
    .map((photo) => photo.mediaId)
    .filter((id): id is string => !!id);
const uploading = (photos: PhotoItem[]) =>
  photos.some((photo) => photo.state === 'uploading' || photo.state === 'processing');

function TaskDetail({ assignmentId }: { assignmentId: string }) {
  const t = useTranslations('Work');
  const tCommon = useTranslations('Common');
  const tReport = useTranslations('Report');
  const tForm = useTranslations('ReportForm');
  const locale = useLocale();
  const task = useTask(assignmentId);
  const action = useTaskAction(assignmentId);
  const [declineReason, setDeclineReason] = useState('');
  const [progress, setProgress] = useState('');
  const [progressPhotos, setProgressPhotos] = useState<PhotoItem[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [description, setDescription] = useState('');
  const [afterPhotos, setAfterPhotos] = useState<PhotoItem[]>([]);

  if (task.isError) return <ErrorAlert error={task.error} />;
  if (!task.data) return <p aria-live="polite">{tCommon('loading')}</p>;
  const { report, assignment, actions } = task.data;
  const run = (next: TaskAction, onSuccess?: () => void) => action.mutate(next, { onSuccess });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/work" className="text-accent text-sm underline underline-offset-4">
          {t('backToTasks')}
        </Link>
        <p className="text-muted font-mono text-sm">{report.publicId}</p>
        <h1 className="text-2xl font-bold">{report.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={assignment.state === 'PENDING' ? 'warn' : 'neutral'}>
            {t(`states.${assignment.state}`)}
          </Badge>
          <span className="text-muted text-sm">{task.data.organizationName}</span>
        </div>
        {assignment.note && (
          <FormAlert tone="info">{t('instructions', { note: assignment.note })}</FormAlert>
        )}
      </div>
      {action.isError && <ErrorAlert error={action.error} />}

      {(actions.accept || actions.start) && (
        <div className="flex flex-wrap gap-2">
          {actions.accept && (
            <Button type="button" busy={action.isPending} onClick={() => run({ kind: 'accept' })}>
              {t('accept')}
            </Button>
          )}
          {actions.start && (
            <Button type="button" busy={action.isPending} onClick={() => run({ kind: 'start' })}>
              {t('start')}
            </Button>
          )}
        </div>
      )}
      {actions.decline && (
        <ActionForm
          summary={t('decline')}
          confirm={t('declineConfirm')}
          busy={action.isPending}
          disabled={declineReason.trim().length < 10}
          onSubmit={() => run({ kind: 'decline', reason: declineReason.trim() })}
        >
          <TextAreaField
            label={t('declineReason')}
            rows={2}
            maxLength={1000}
            value={declineReason}
            onChange={(event) => setDeclineReason(event.target.value)}
          />
        </ActionForm>
      )}

      <Section title={tReport('category')}>
        <p>{locale === 'bn' ? report.category.nameBn : report.category.nameEn}</p>
        <p className="whitespace-pre-line">{report.description}</p>
      </Section>

      <Section title={t('location')}>
        <LocationMap
          value={{ latitude: report.latitude, longitude: report.longitude }}
          label={t('location')}
          attribution={tForm('mapAttribution')}
          unavailableText={tForm('mapUnavailableReadOnly')}
          interactive={false}
          zoom={14}
          className="h-56"
        />
        <p className="text-muted text-sm">
          {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
        </p>
        {report.locationDescription && <p>{report.locationDescription}</p>}
      </Section>

      <Section title={t('reportPhotos')}>
        <PhotoGrid
          photos={report.photos}
          alt={(index) => tReport('photoAlt', { number: index + 1 })}
        />
      </Section>

      {actions.progress && (
        <Section title={t('progressHeading')}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              run(
                { kind: 'progress', message: progress.trim(), mediaIds: readyIds(progressPhotos) },
                () => {
                  setProgress('');
                  setProgressPhotos([]);
                },
              );
            }}
          >
            <TextAreaField
              label={t('progressMessage')}
              rows={3}
              maxLength={2000}
              value={progress}
              onChange={(event) => setProgress(event.target.value)}
            />
            <PhotoUploader
              photos={progressPhotos}
              onChange={setProgressPhotos}
              purpose="WORK_PHOTO"
              legend={t('progressPhotos')}
              hint={t('workPhotosHint')}
              inputId="progress-photos"
            />
            <Button
              variant="secondary"
              busy={action.isPending}
              disabled={!progress.trim() || uploading(progressPhotos)}
            >
              {t('postProgress')}
            </Button>
          </form>
        </Section>
      )}

      {actions.complete && (
        <Section title={t('completeHeading')}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              run(
                {
                  kind: 'complete',
                  description: description.trim(),
                  mediaIds: readyIds(afterPhotos),
                },
                () => {
                  setDescription('');
                  setAfterPhotos([]);
                },
              );
            }}
          >
            <TextAreaField
              label={t('completeDescription')}
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <PhotoUploader
              photos={afterPhotos}
              onChange={setAfterPhotos}
              max={MAX_PHOTOS}
              purpose="WORK_PHOTO"
              legend={t('completePhotos')}
              hint={t('workPhotosHint')}
              inputId="after-photos"
              error={
                readyIds(afterPhotos).length === 0 && description.trim()
                  ? t('needPhoto')
                  : undefined
              }
            />
            <Button
              busy={action.isPending}
              disabled={
                description.trim().length < 10 ||
                readyIds(afterPhotos).length === 0 ||
                uploading(afterPhotos)
              }
            >
              {t('completeConfirm')}
            </Button>
          </form>
        </Section>
      )}

      {actions.returnTask && (
        <ActionForm
          summary={t('returnHeading')}
          confirm={t('returnConfirm')}
          busy={action.isPending}
          disabled={returnReason.trim().length < 10}
          onSubmit={() => run({ kind: 'return', reason: returnReason.trim() })}
        >
          <p className="text-muted text-sm">{t('returnHint')}</p>
          <TextAreaField
            label={t('returnReason')}
            rows={2}
            maxLength={1000}
            value={returnReason}
            onChange={(event) => setReturnReason(event.target.value)}
          />
        </ActionForm>
      )}

      <Section title={t('history')}>
        <AssignmentHistory assignment={assignment} />
      </Section>
    </div>
  );
}

export function TaskPage({ assignmentId }: { assignmentId: string }) {
  return <RequireAuth>{() => <TaskDetail assignmentId={assignmentId} />}</RequireAuth>;
}
