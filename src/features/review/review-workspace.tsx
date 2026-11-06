'use client';

import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Badge, Section } from '@/components/ui/section';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { RequireAuth } from '@/features/auth/require-auth';
import { RequireSuperAdmin } from '@/features/auth/require-super-admin';
import { errorDetail, errorMessage } from '@/features/auth/server-errors';
import { useCategories, useOverview } from '@/features/organizations/api';
import { categoryName } from '@/features/organizations/categories-panel';
import { LocationMap } from '@/features/reports/location-map';
import { StatusBadge } from '@/features/reports/report-detail';
import { Link } from '@/i18n/navigation';
import { AssignmentPanel } from './assignment-panel';
import {
  REJECTION_REASONS,
  useAddNote,
  useAddUpdate,
  useHideUpdate,
  useNotes,
  useOrganizationUpdates,
  useReviewAction,
  useTransferTargets,
  useWorkspaceHistory,
  useWorkspaceReport,
  type RejectionReason,
  type ReviewAction,
  type WorkspaceReport,
  type WorkspaceScope,
} from './api';

function useDate() {
  const format = useFormatter();
  return (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
}

function ErrorAlert({ error }: { error: unknown }) {
  const tErrors = useTranslations('Errors');
  return (
    <FormAlert tone="error">
      <p>{errorMessage(error, tErrors)}</p>
      {errorDetail(error) && <p className="text-sm">{errorDetail(error)}</p>}
    </FormAlert>
  );
}

/** One decision as a collapsible form, so the panel stays short until a reviewer picks one. */
function DecisionForm({
  summary,
  confirm,
  busy,
  disabled,
  onSubmit,
  children,
}: {
  summary: string;
  confirm: string;
  busy: boolean;
  disabled: boolean;
  onSubmit: () => void;
  children: ReactNode;
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

function Decisions({
  organizationId,
  report,
  onTransferred,
}: {
  organizationId: string;
  report: WorkspaceReport;
  onTransferred: () => void;
}) {
  const t = useTranslations('Review');
  const tReasons = useTranslations('RejectionReason');
  const tTriage = useTranslations('Triage');
  const locale = useLocale();
  const action = useReviewAction(organizationId, report.publicId);
  const overview = useOverview(organizationId);
  const categories = useCategories();
  const targets = useTransferTargets(organizationId, report.publicId, report.actions.transfer);
  const [question, setQuestion] = useState('');
  const [acceptCategory, setAcceptCategory] = useState(report.category.id);
  const [acceptMessage, setAcceptMessage] = useState('');
  const [rejectReason, setRejectReason] = useState<RejectionReason | ''>('');
  const [rejectMessage, setRejectMessage] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const run = (next: ReviewAction, onSuccess?: () => void) =>
    action.mutate({ action: next, version: report.version }, { onSuccess });
  const { actions } = report;
  const any = Object.values(actions).some(Boolean);
  const handled = new Set(overview.data?.categoryIds ?? []);
  const categoryOptions = (categories.data ?? [])
    .filter((category) => handled.has(category.id) || category.id === report.category.id)
    .map((category) => ({ value: category.id, label: categoryName(category, locale) }));

  return (
    <Section title={t('decision')}>
      {action.isError && <ErrorAlert error={action.error} />}
      {!any && <p className="text-muted">{t('noActions')}</p>}
      {actions.startReview && (
        <div className="space-y-2">
          <p className="text-muted text-sm">{t('startReviewHint')}</p>
          <Button
            type="button"
            busy={action.isPending}
            onClick={() => run({ kind: 'start-review' })}
          >
            {t('startReview')}
          </Button>
        </div>
      )}
      {actions.requestInformation && (
        <DecisionForm
          summary={t('requestInformation')}
          confirm={t('sendRequest')}
          busy={action.isPending}
          disabled={question.trim().length < 10}
          onSubmit={() =>
            run({ kind: 'request-information', message: question.trim() }, () => setQuestion(''))
          }
        >
          <TextAreaField
            label={t('requestMessage')}
            rows={3}
            maxLength={1000}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </DecisionForm>
      )}
      {actions.accept && (
        <DecisionForm
          summary={t('accept')}
          confirm={t('acceptConfirm')}
          busy={action.isPending}
          disabled={false}
          onSubmit={() =>
            run({
              kind: 'accept',
              categoryId: acceptCategory === report.category.id ? undefined : acceptCategory,
              publicMessage: acceptMessage.trim() || undefined,
            })
          }
        >
          <SelectField
            label={t('acceptCategory')}
            value={acceptCategory}
            options={categoryOptions}
            onChange={(event) => setAcceptCategory(event.target.value)}
          />
          <TextAreaField
            label={t('acceptMessage')}
            rows={2}
            maxLength={1000}
            value={acceptMessage}
            onChange={(event) => setAcceptMessage(event.target.value)}
          />
        </DecisionForm>
      )}
      {actions.reject && (
        <DecisionForm
          summary={t('reject')}
          confirm={t('rejectConfirm')}
          busy={action.isPending}
          disabled={!rejectReason || rejectMessage.trim().length < 10}
          onSubmit={() =>
            rejectReason &&
            run({ kind: 'reject', reason: rejectReason, message: rejectMessage.trim() })
          }
        >
          <SelectField
            label={t('rejectReason')}
            value={rejectReason}
            options={[
              { value: '', label: t('chooseReason') },
              ...REJECTION_REASONS.map((reason) => ({ value: reason, label: tReasons(reason) })),
            ]}
            onChange={(event) => setRejectReason(event.target.value as RejectionReason | '')}
          />
          <TextAreaField
            label={t('rejectMessage')}
            rows={3}
            maxLength={1000}
            value={rejectMessage}
            onChange={(event) => setRejectMessage(event.target.value)}
          />
        </DecisionForm>
      )}
      {actions.transfer && (
        <DecisionForm
          summary={t('transfer')}
          confirm={t('transferConfirm')}
          busy={action.isPending}
          disabled={!transferTo || transferReason.trim().length < 10}
          onSubmit={() =>
            run(
              {
                kind: 'transfer',
                toOrganizationId: transferTo === 'triage' ? null : transferTo,
                reason: transferReason.trim(),
              },
              onTransferred,
            )
          }
        >
          <p className="text-muted text-sm">{t('transferHint')}</p>
          <SelectField
            label={t('transferTo')}
            value={transferTo}
            options={[
              { value: '', label: tTriage('chooseOrganization') },
              ...(targets.data ?? []).map((target) => ({ value: target.id, label: target.name })),
              { value: 'triage', label: t('transferBack') },
            ]}
            onChange={(event) => setTransferTo(event.target.value)}
          />
          <TextAreaField
            label={t('transferReason')}
            rows={3}
            maxLength={1000}
            value={transferReason}
            onChange={(event) => setTransferReason(event.target.value)}
          />
        </DecisionForm>
      )}
    </Section>
  );
}

function Notes({ scope, publicId }: { scope: WorkspaceScope; publicId: string }) {
  const t = useTranslations('Review');
  const date = useDate();
  const notes = useNotes(scope, publicId);
  const add = useAddNote(scope.kind === 'organization' ? scope.organizationId : '', publicId);
  const [body, setBody] = useState('');

  return (
    <Section title={t('notes')}>
      <p className="text-muted text-sm">{t('notesHint')}</p>
      {notes.data && notes.data.length === 0 && <p className="text-muted">{t('noNotes')}</p>}
      <ul className="space-y-3">
        {notes.data?.map((note) => (
          <li key={note.id} className="border-border border-s-2 ps-3">
            <p className="whitespace-pre-line">{note.body}</p>
            <p className="text-muted text-sm">
              {t('byline', {
                name: note.authorName,
                organization: note.organizationName,
                date: date(note.createdAt),
              })}
            </p>
          </li>
        ))}
      </ul>
      {scope.kind === 'organization' && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate(body.trim(), { onSuccess: () => setBody('') });
          }}
        >
          {add.isError && <ErrorAlert error={add.error} />}
          <TextAreaField
            label={t('noteLabel')}
            rows={2}
            maxLength={2000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <Button variant="secondary" busy={add.isPending} disabled={!body.trim()}>
            {t('addNote')}
          </Button>
        </form>
      )}
    </Section>
  );
}

function HideUpdate({ publicId, updateId }: { publicId: string; updateId: string }) {
  const t = useTranslations('Review');
  const hide = useHideUpdate(publicId);
  const [reason, setReason] = useState('');
  return (
    <details>
      <summary className="cursor-pointer text-sm">{t('hide')}</summary>
      <div className="mt-2 space-y-2">
        {hide.isError && <ErrorAlert error={hide.error} />}
        <TextAreaField
          label={t('hideReason')}
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          busy={hide.isPending}
          disabled={reason.trim().length < 5}
          onClick={() => hide.mutate({ updateId, reason: reason.trim() })}
        >
          {t('hideConfirm')}
        </Button>
      </div>
    </details>
  );
}

function Updates({ scope, publicId }: { scope: WorkspaceScope; publicId: string }) {
  const t = useTranslations('Review');
  const date = useDate();
  const updates = useOrganizationUpdates(scope, publicId);
  const add = useAddUpdate(scope.kind === 'organization' ? scope.organizationId : '', publicId);
  const [body, setBody] = useState('');

  return (
    <Section title={t('updates')}>
      <p className="text-muted text-sm">{t('updatesHint')}</p>
      {updates.data && updates.data.length === 0 && <p className="text-muted">{t('noUpdates')}</p>}
      <ul className="space-y-3">
        {updates.data?.map((update) => (
          <li key={update.id} className="border-border space-y-1 border-s-2 ps-3">
            <p className={`whitespace-pre-line ${update.hidden ? 'text-muted line-through' : ''}`}>
              {update.body}
            </p>
            <p className="text-muted text-sm">
              {t('byline', {
                name: update.authorName,
                organization: update.organizationName,
                date: date(update.createdAt),
              })}
            </p>
            {update.hidden && (
              <Badge>{t('hiddenUpdate', { reason: update.hiddenReason ?? '' })}</Badge>
            )}
            {scope.kind === 'admin' && !update.hidden && (
              <HideUpdate publicId={publicId} updateId={update.id} />
            )}
          </li>
        ))}
      </ul>
      {scope.kind === 'organization' && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate(body.trim(), { onSuccess: () => setBody('') });
          }}
        >
          {add.isError && <ErrorAlert error={add.error} />}
          <TextAreaField
            label={t('updateLabel')}
            rows={2}
            maxLength={1000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <Button variant="secondary" busy={add.isPending} disabled={!body.trim()}>
            {t('postUpdate')}
          </Button>
        </form>
      )}
    </Section>
  );
}

function Timeline({ scope, publicId }: { scope: WorkspaceScope; publicId: string }) {
  const t = useTranslations('Review');
  const tStatus = useTranslations('ReportStatus');
  const tReasons = useTranslations('RejectionReason');
  const tCommon = useTranslations('Common');
  const date = useDate();
  const history = useWorkspaceHistory(scope, publicId);
  const reasonLabel = (reason: string) =>
    (REJECTION_REASONS as string[]).includes(reason) ? tReasons(reason as RejectionReason) : reason;
  const actorLabel = (actor: string) =>
    ['citizen', 'org_reviewer', 'worker', 'super_admin', 'system'].includes(actor)
      ? t(`actor.${actor as 'citizen'}`)
      : actor;

  return (
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
              <p className="text-muted text-sm">
                {actorLabel(entry.actorContext)} · {date(entry.createdAt)}
              </p>
              {entry.reason && (
                <p className="text-sm">{t('reasonText', { reason: reasonLabel(entry.reason) })}</p>
              )}
              {entry.publicMessage && (
                <p className="text-sm">{t('publicMessage', { message: entry.publicMessage })}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function Workspace({ scope, publicId }: { scope: WorkspaceScope; publicId: string }) {
  const t = useTranslations('Review');
  const tReport = useTranslations('Report');
  const tForm = useTranslations('ReportForm');
  const tReasons = useTranslations('RejectionReason');
  const tCommon = useTranslations('Common');
  const locale = useLocale();
  const date = useDate();
  const report = useWorkspaceReport(scope, publicId);
  const [transferred, setTransferred] = useState(false);
  const queueHref =
    scope.kind === 'organization' ? `/organizations/${scope.organizationId}/reports` : null;

  if (transferred) {
    return (
      <div className="space-y-4">
        <FormAlert tone="success">{t('transferDone')}</FormAlert>
        {queueHref && (
          <Link href={queueHref} className="text-accent underline underline-offset-4">
            {t('backToQueue')}
          </Link>
        )}
      </div>
    );
  }
  if (report.isError) return <ErrorAlert error={report.error} />;
  if (!report.data) return <p aria-live="polite">{tCommon('loading')}</p>;
  const data = report.data;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {queueHref && (
          <Link href={queueHref} className="text-accent text-sm underline underline-offset-4">
            {t('backToQueue')}
          </Link>
        )}
        <p className="text-muted font-mono text-sm">{data.publicId}</p>
        <h1 className="text-2xl font-bold">{data.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={data.status} />
          <Badge>
            {data.visibility === 'PRIVATE' ? tReport('privateBadge') : tReport('publicBadge')}
          </Badge>
          <span className="text-muted text-sm">
            {tReport('submitted', { date: date(data.submittedAt) })}
          </span>
        </div>
        {scope.kind === 'admin' && (
          <>
            <FormAlert tone="info">{t('adminHint')}</FormAlert>
            <p>
              {data.organizationName
                ? t('handledBy', { name: data.organizationName })
                : t('noOrganization')}
            </p>
          </>
        )}
      </div>
      <FormAlert tone="info">{t('reporterHidden')}</FormAlert>
      {data.rejection && (
        <FormAlert tone="info">
          <p>{t('rejected', { reason: tReasons(data.rejection.reason) })}</p>
          <p className="whitespace-pre-line">{data.rejection.message}</p>
        </FormAlert>
      )}

      <Section title={tReport('category')}>
        <p>{locale === 'bn' ? data.category.nameBn : data.category.nameEn}</p>
        <p className="whitespace-pre-line">{data.description}</p>
      </Section>

      <Section title={tReport('photosHeading')}>
        {data.photos.length === 0 ? (
          <p className="text-muted">{t('noPhotos')}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.photos.map((photo, index) =>
              photo.displayUrl ? (
                <li key={photo.id}>
                  <a href={photo.displayUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                    <img
                      src={photo.thumbnailUrl ?? photo.displayUrl}
                      alt={tReport('photoAlt', { number: index + 1 })}
                      className="aspect-square w-full rounded-md object-cover"
                    />
                  </a>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </Section>

      <Section title={t('exactLocation')}>
        <LocationMap
          value={{ latitude: data.latitude, longitude: data.longitude }}
          label={t('exactLocation')}
          attribution={tForm('mapAttribution')}
          unavailableText={tForm('mapUnavailableReadOnly')}
          interactive={false}
          zoom={14}
          className="h-56"
        />
        <p className="text-muted text-sm">
          {data.latitude.toFixed(5)}, {data.longitude.toFixed(5)}
        </p>
        {data.locationDescription && <p>{data.locationDescription}</p>}
      </Section>

      <Section title={t('conversation')}>
        {data.informationRequests.length === 0 ? (
          <p className="text-muted">{t('noRequests')}</p>
        ) : (
          <ol className="space-y-4">
            {data.informationRequests.map((request) => (
              <li key={request.id} className="space-y-2">
                <div className="border-border border-s-2 ps-3">
                  <p className="whitespace-pre-line">{request.message}</p>
                  <p className="text-muted text-sm">
                    {t('requested', { date: date(request.requestedAt) })}
                  </p>
                </div>
                {request.response ? (
                  <div className="border-accent ms-4 border-s-2 ps-3">
                    <p className="whitespace-pre-line">{request.response.message}</p>
                    <p className="text-muted text-sm">
                      {t('answered', { date: date(request.response.respondedAt) })} ·{' '}
                      {t('answerPhotos', { count: request.response.photoCount })}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted ms-4 text-sm">{t('awaiting')}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>

      {scope.kind === 'organization' && (
        <Decisions
          organizationId={scope.organizationId}
          report={data}
          onTransferred={() => setTransferred(true)}
        />
      )}
      <AssignmentPanel
        report={data}
        organizationId={scope.kind === 'organization' ? scope.organizationId : undefined}
      />
      <Notes scope={scope} publicId={publicId} />
      <Updates scope={scope} publicId={publicId} />
      <Timeline scope={scope} publicId={publicId} />
    </div>
  );
}

export function ReviewWorkspacePage({
  organizationId,
  publicId,
}: {
  organizationId: string;
  publicId: string;
}) {
  return (
    <RequireAuth>
      {() => <Workspace scope={{ kind: 'organization', organizationId }} publicId={publicId} />}
    </RequireAuth>
  );
}

export function AdminReportPage({ publicId }: { publicId: string }) {
  const t = useTranslations('Review');
  return (
    <RequireSuperAdmin>
      {() => (
        <div className="space-y-4">
          <p className="text-muted text-sm">{t('adminTitle')}</p>
          <Workspace scope={{ kind: 'admin' }} publicId={publicId} />
        </div>
      )}
    </RequireSuperAdmin>
  );
}
