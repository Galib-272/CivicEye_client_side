'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Badge, Section } from '@/components/ui/section';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { useAuthState } from '@/features/auth/api';
import { RequireSuperAdmin } from '@/features/auth/require-super-admin';
import { errorMessage } from '@/features/auth/server-errors';
import { Link } from '@/i18n/navigation';
import {
  useEscalate,
  useFlag,
  useModerationAction,
  useModerationCase,
  useModerationCases,
  type ActionKind,
  type FlagReason,
} from './api';

const REASONS: FlagReason[] = [
  'SPAM_OR_FAKE',
  'OFFENSIVE',
  'PERSONAL_INFORMATION',
  'MISLEADING_PHOTO',
  'OTHER',
];
const FILTERS = ['open', 'OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'RESOLVED', 'DISMISSED', 'all'];
const NEEDS_MESSAGE: ReadonlySet<ActionKind> = new Set(['REQUEST_CORRECTION', 'WARN_USER']);

function useDate() {
  const format = useFormatter();
  return (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
}

// ─── Flagging (citizens and visitors who are signed in) ───────────────────────

/** "Report a problem" with a public report or update. Signed-in users only. */
export function FlagButton({
  publicId,
  updateId = null,
}: {
  publicId: string;
  updateId?: string | null;
}) {
  const t = useTranslations('Moderation');
  const tErrors = useTranslations('Errors');
  const { data: auth } = useAuthState();
  const flag = useFlag(publicId, updateId);
  const [reason, setReason] = useState<FlagReason | ''>('');
  const [details, setDetails] = useState('');
  if (!auth) return null;
  if (flag.isSuccess)
    return (
      <p className="text-sm" role="status">
        {t('flagThanks')}
      </p>
    );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (reason) flag.mutate({ reason, ...(details.trim() ? { details: details.trim() } : {}) });
  };
  return (
    <details className="text-sm">
      <summary className="text-muted cursor-pointer underline underline-offset-4">
        {updateId ? t('flagUpdate') : t('flagReport')}
      </summary>
      <form onSubmit={submit} className="mt-2 max-w-md space-y-2">
        <p className="text-muted">{t('flagHint')}</p>
        {flag.isError && <FormAlert tone="error">{errorMessage(flag.error, tErrors)}</FormAlert>}
        <SelectField
          label={t('reason')}
          value={reason}
          required
          onChange={(event) => setReason(event.target.value as FlagReason)}
          options={[
            { value: '', label: t('choose'), disabled: true },
            ...REASONS.map((value) => ({ value, label: t(`reasons.${value}`) })),
          ]}
        />
        <TextAreaField
          label={reason === 'OTHER' ? t('detailsRequired') : t('details')}
          rows={2}
          maxLength={1000}
          required={reason === 'OTHER'}
          minLength={reason === 'OTHER' ? 5 : undefined}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
        <Button type="submit" variant="secondary" busy={flag.isPending} disabled={!reason}>
          {t('sendFlag')}
        </Button>
      </form>
    </details>
  );
}

/** An organization reviewer asks the Super Admins to review a report. */
export function EscalateForm({
  organizationId,
  publicId,
}: {
  organizationId: string;
  publicId: string;
}) {
  const t = useTranslations('Moderation');
  const tErrors = useTranslations('Errors');
  const escalate = useEscalate(organizationId, publicId);
  const [reason, setReason] = useState<FlagReason | ''>('');
  const [details, setDetails] = useState('');
  return (
    <Section title={t('escalateHeading')}>
      <p className="text-muted text-sm">{t('escalateHint')}</p>
      {escalate.isSuccess ? (
        <FormAlert tone="success">{t('escalated')}</FormAlert>
      ) : (
        <form
          className="max-w-md space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason) escalate.mutate({ reason, details: details.trim() });
          }}
        >
          {escalate.isError && (
            <FormAlert tone="error">{errorMessage(escalate.error, tErrors)}</FormAlert>
          )}
          <SelectField
            label={t('reason')}
            value={reason}
            required
            onChange={(event) => setReason(event.target.value as FlagReason)}
            options={[
              { value: '', label: t('choose'), disabled: true },
              ...REASONS.map((value) => ({ value, label: t(`reasons.${value}`) })),
            ]}
          />
          <TextAreaField
            label={t('detailsRequired')}
            rows={3}
            required
            minLength={5}
            maxLength={1000}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
          <Button type="submit" variant="secondary" busy={escalate.isPending} disabled={!reason}>
            {t('escalate')}
          </Button>
        </form>
      )}
    </Section>
  );
}

/** What moderators told the citizen about their own report. */
export function ModerationNotices({
  moderation,
}: {
  moderation: {
    hiddenFromPublic: boolean;
    notices: Array<{ kind: string; message: string | null; createdAt: string }>;
  };
}) {
  const t = useTranslations('Moderation');
  const date = useDate();
  const messages = moderation.notices.filter(
    (notice) =>
      notice.message && (notice.kind === 'REQUEST_CORRECTION' || notice.kind === 'WARN_USER'),
  );
  if (!moderation.hiddenFromPublic && messages.length === 0) return null;
  return (
    <FormAlert tone="info">
      {moderation.hiddenFromPublic && <p className="font-medium">{t('hiddenNotice')}</p>}
      {messages.length > 0 && (
        <ul className="mt-1 space-y-2">
          {messages.map((notice) => (
            <li key={notice.createdAt}>
              <p className="font-medium">
                {notice.kind === 'WARN_USER' ? t('warningFrom') : t('correctionFrom')}
              </p>
              <p className="whitespace-pre-line">{notice.message}</p>
              <p className="text-muted text-xs">{date(notice.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </FormAlert>
  );
}

// ─── Super Admin queue and case ───────────────────────────────────────────────

function Queue() {
  const t = useTranslations('Moderation');
  const tErrors = useTranslations('Errors');
  const tCommon = useTranslations('Common');
  const date = useDate();
  const [filter, setFilter] = useState('open');
  const [page, setPage] = useState(1);
  const cases = useModerationCases(filter, page);
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/admin/analytics" className="text-accent text-sm underline underline-offset-4">
          {t('backToDashboard')}
        </Link>
        <h1 className="text-2xl font-bold">{t('queueTitle')}</h1>
        <p className="text-muted">{t('queueIntro')}</p>
      </div>
      <div className="max-w-xs">
        <SelectField
          label={t('show')}
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(1);
          }}
          options={FILTERS.map((value) => ({ value, label: t(`filters.${value}`) }))}
        />
      </div>
      {cases.isError && <FormAlert tone="error">{errorMessage(cases.error, tErrors)}</FormAlert>}
      {!cases.data ? (
        <p aria-live="polite">{tCommon('loading')}</p>
      ) : cases.data.items.length === 0 ? (
        <p className="text-muted">{t('noCases')}</p>
      ) : (
        <ul className="space-y-3">
          {cases.data.items.map((item) => (
            <li key={item.id} className="border-border space-y-1 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/moderation/${item.id}`}
                  className="text-accent font-medium underline underline-offset-4"
                >
                  {item.report.publicId} · {item.report.title}
                </Link>
                <Badge>{t(`status.${item.status}`)}</Badge>
                {item.escalated && <Badge>{t('escalatedBadge')}</Badge>}
              </div>
              <p className="text-muted text-sm">
                {item.targetType === 'PUBLIC_UPDATE' ? t('targetUpdate') : t('targetReport')} ·{' '}
                {t('flagCount', { count: item.flagCount })} ·{' '}
                {item.reasons.map((reason) => t(`reasons.${reason}`)).join(', ')} ·{' '}
                {date(item.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {cases.data && cases.data.totalPages > 1 && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {tCommon('previous')}
          </Button>
          <span className="text-sm">{t('page', { page, total: cases.data.totalPages })}</span>
          <Button
            type="button"
            variant="secondary"
            disabled={page >= cases.data.totalPages}
            onClick={() => setPage(page + 1)}
          >
            {tCommon('next')}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ModerationQueuePage() {
  return <RequireSuperAdmin>{() => <Queue />}</RequireSuperAdmin>;
}

function ActionForm({ caseId, allowed }: { caseId: string; allowed: ActionKind[] }) {
  const t = useTranslations('Moderation');
  const tErrors = useTranslations('Errors');
  const action = useModerationAction(caseId);
  const [kind, setKind] = useState<ActionKind | ''>('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  if (allowed.length === 0) return <p className="text-muted">{t('noActions')}</p>;
  const needsMessage = kind !== '' && NEEDS_MESSAGE.has(kind);
  return (
    <form
      className="max-w-xl space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!kind) return;
        action.mutate(
          { kind, reason: reason.trim(), ...(needsMessage ? { message: message.trim() } : {}) },
          {
            onSuccess: () => {
              setKind('');
              setReason('');
              setMessage('');
            },
          },
        );
      }}
    >
      {action.isError && <FormAlert tone="error">{errorMessage(action.error, tErrors)}</FormAlert>}
      {action.isSuccess && <FormAlert tone="success">{t('done')}</FormAlert>}
      <SelectField
        label={t('decision')}
        value={kind}
        required
        onChange={(event) => setKind(event.target.value as ActionKind)}
        options={[
          { value: '', label: t('choose'), disabled: true },
          ...allowed.map((value) => ({ value, label: t(`actions.${value}`) })),
        ]}
      />
      {kind && <p className="text-muted text-sm">{t(`actionHints.${kind}`)}</p>}
      {kind === 'SUSPEND_USER' && <FormAlert tone="info">{t('suspendWarning')}</FormAlert>}
      <TextAreaField
        label={t('internalReason')}
        rows={2}
        required
        minLength={5}
        maxLength={1000}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      {needsMessage && (
        <TextAreaField
          label={t('messageToCitizen')}
          rows={3}
          required
          minLength={5}
          maxLength={1000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
      )}
      <Button type="submit" busy={action.isPending} disabled={!kind}>
        {t('confirm')}
      </Button>
    </form>
  );
}

function CaseView({ caseId }: { caseId: string }) {
  const t = useTranslations('Moderation');
  const tErrors = useTranslations('Errors');
  const tCommon = useTranslations('Common');
  const date = useDate();
  const detail = useModerationCase(caseId);
  if (detail.isError)
    return <FormAlert tone="error">{errorMessage(detail.error, tErrors)}</FormAlert>;
  if (!detail.data) return <p aria-live="polite">{tCommon('loading')}</p>;
  const data = detail.data;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/admin/moderation" className="text-accent text-sm underline underline-offset-4">
          {t('backToQueue')}
        </Link>
        <h1 className="text-2xl font-bold">{t('caseTitle', { id: data.report.publicId })}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge>{t(`status.${data.status}`)}</Badge>
          {data.escalated && <Badge>{t('escalatedBadge')}</Badge>}
          {data.report.hiddenFromPublic && <Badge>{t('hiddenBadge')}</Badge>}
        </div>
      </div>

      <Section title={data.targetType === 'PUBLIC_UPDATE' ? t('targetUpdate') : t('targetReport')}>
        {data.publicUpdate && (
          <div className="border-border space-y-1 border-s-2 ps-3">
            <p className="whitespace-pre-line">{data.publicUpdate.body}</p>
            <p className="text-muted text-sm">
              {data.publicUpdate.organizationName}
              {data.publicUpdate.hidden && ` · ${t('hiddenBadge')}`}
            </p>
          </div>
        )}
        <p className="font-medium">{data.report.title}</p>
        <p className="whitespace-pre-line">{data.report.description}</p>
        <p className="text-muted text-sm">
          {t('reportedBy', {
            name: data.report.citizen.name,
            status: t(`accountStatus.${data.report.citizen.status}` as 'accountStatus.ACTIVE'),
          })}
          {data.report.organizationName && ` · ${data.report.organizationName}`}
        </p>
        <Link
          href={`/admin/reports/${data.report.publicId}`}
          className="text-accent text-sm underline underline-offset-4"
        >
          {t('openReport')}
        </Link>
      </Section>

      <Section title={t('flagsHeading', { count: data.flags.length })}>
        <ul className="space-y-3">
          {data.flags.map((flag) => (
            <li
              key={`${flag.reporterName}-${flag.createdAt}`}
              className="border-border border-s-2 ps-3"
            >
              <p className="font-medium">{t(`reasons.${flag.reason}`)}</p>
              {flag.details && <p className="whitespace-pre-line">{flag.details}</p>}
              <p className="text-muted text-sm">
                {flag.source === 'organization'
                  ? t('byOrganization', {
                      name: flag.reporterName,
                      organization: flag.organizationName ?? '',
                    })
                  : t('byUser', { name: flag.reporterName })}{' '}
                · {date(flag.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('decisionsHeading')}>
        {data.actions.length === 0 ? (
          <p className="text-muted">{t('noDecisions')}</p>
        ) : (
          <ol className="space-y-3">
            {data.actions.map((action) => (
              <li key={action.createdAt} className="border-border border-s-2 ps-3">
                <p className="font-medium">{t(`actions.${action.kind}`)}</p>
                <p className="text-sm">{t('why', { reason: action.reason })}</p>
                {action.message && (
                  <p className="text-sm">{t('told', { message: action.message })}</p>
                )}
                <p className="text-muted text-sm">
                  {action.actorName} · {date(action.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title={t('decideHeading')}>
        <p className="text-muted text-sm">{t('decideHint')}</p>
        <ActionForm caseId={caseId} allowed={data.allowedActions} />
      </Section>
    </div>
  );
}

export function ModerationCasePage({ caseId }: { caseId: string }) {
  return <RequireSuperAdmin>{() => <CaseView caseId={caseId} />}</RequireSuperAdmin>;
}
