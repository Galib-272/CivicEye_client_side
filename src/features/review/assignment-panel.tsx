'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Badge, Section } from '@/components/ui/section';
import { SelectField, TextAreaField } from '@/components/ui/select-field';
import { errorDetail, errorMessage } from '@/features/auth/server-errors';
import { AssignmentHistory, PhotoGrid } from '@/features/work/assignment-history';
import {
  useReviewAction,
  useWorkers,
  type ReviewAction,
  type VerificationOutcome,
  type WorkspaceReport,
} from './api';

function ActionForm({
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

const OUTCOMES: VerificationOutcome[] = ['APPROVED', 'NEEDS_MORE_EVIDENCE', 'REJECTED'];

/**
 * The work side of a report: who is assigned, the assignment history and evidence, and the
 * organization's actions (assign, reassign, cancel, verify, reopen, close). In the Super Admin
 * view (no organizationId) it is read-only.
 */
export function AssignmentPanel({
  report,
  organizationId,
}: {
  report: WorkspaceReport;
  organizationId?: string;
}) {
  const t = useTranslations('Assign');
  const tWork = useTranslations('Work');
  const tReport = useTranslations('Report');
  const tErrors = useTranslations('Errors');
  const format = useFormatter();
  const { actions } = report;
  const canManage = !!organizationId && (actions.assign || actions.reassign);
  const workers = useWorkers(organizationId ?? '', canManage);
  const action = useReviewAction(organizationId ?? '', report.publicId);
  const [workerId, setWorkerId] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [outcome, setOutcome] = useState<VerificationOutcome>('APPROVED');
  const [verifyReason, setVerifyReason] = useState('');

  const run = (next: ReviewAction) =>
    action.mutate(
      { action: next, version: report.version },
      {
        onSuccess: () => {
          setWorkerId('');
          setNote('');
          setReason('');
          setVerifyReason('');
        },
      },
    );

  const current = report.assignments.at(-1);
  const toVerify = report.assignments.find((assignment) => assignment.state === 'COMPLETED');
  const latestSubmission = toVerify?.submissions.at(-1);
  const workerOptions = [
    { value: '', label: t('chooseWorker') },
    ...(workers.data ?? []).map((worker) => ({
      value: worker.userId,
      label: worker.available
        ? t('workerOption', { name: worker.name, tasks: worker.activeTasks })
        : t('workerUnavailable', { name: worker.name }),
      disabled: !worker.available || worker.userId === current?.workerId,
    })),
  ];
  const workerSelect = (
    <>
      {workers.data?.length === 0 && <FormAlert tone="info">{t('noWorkers')}</FormAlert>}
      <SelectField
        label={t('worker')}
        value={workerId}
        options={workerOptions}
        onChange={(event) => setWorkerId(event.target.value)}
      />
    </>
  );

  return (
    <Section title={t('heading')}>
      {action.isError && (
        <FormAlert tone="error">
          <p>{errorMessage(action.error, tErrors)}</p>
          {errorDetail(action.error) && <p className="text-sm">{errorDetail(action.error)}</p>}
        </FormAlert>
      )}

      {report.assignments.length === 0 ? (
        <p className="text-muted">{t('noAssignments')}</p>
      ) : (
        <ol className="space-y-4">
          {report.assignments.map((assignment) => (
            <li key={assignment.id} className="space-y-2">
              <details open={assignment === current}>
                <summary className="cursor-pointer">
                  <Badge tone={assignment === current ? 'warn' : 'neutral'}>
                    {t('workerState', {
                      name: assignment.workerName,
                      state: tWork(`states.${assignment.state}`),
                    })}
                  </Badge>
                </summary>
                <div className="mt-3 space-y-2">
                  {assignment.endReason && (
                    <p className="text-sm">{t('ended', { reason: assignment.endReason })}</p>
                  )}
                  <AssignmentHistory assignment={assignment} />
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}

      {organizationId && actions.verify && latestSubmission && (
        <div className="border-accent space-y-3 rounded-md border-2 p-3">
          <h3 className="font-semibold">{t('verify')}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('before')}</p>
              <PhotoGrid
                photos={report.photos}
                alt={(index) => tReport('photoAlt', { number: index + 1 })}
              />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('after')}</p>
              <PhotoGrid
                photos={latestSubmission.photos}
                alt={(index) => tWork('photoAlt', { number: index + 1 })}
              />
            </div>
          </div>
          <p className="whitespace-pre-line">{latestSubmission.description}</p>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              run({
                kind: 'verify',
                outcome,
                reason: outcome === 'APPROVED' ? undefined : verifyReason.trim(),
              });
            }}
          >
            <fieldset className="space-y-2">
              <legend className="font-medium">{t('outcome')}</legend>
              {OUTCOMES.map((value) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="verification-outcome"
                    value={value}
                    checked={outcome === value}
                    onChange={() => setOutcome(value)}
                  />
                  <span>{tWork(`verification.${value}`)}</span>
                </label>
              ))}
            </fieldset>
            {outcome !== 'APPROVED' && (
              <TextAreaField
                label={t('verifyReason')}
                rows={2}
                maxLength={1000}
                value={verifyReason}
                onChange={(event) => setVerifyReason(event.target.value)}
              />
            )}
            <Button
              busy={action.isPending}
              disabled={outcome !== 'APPROVED' && verifyReason.trim().length < 10}
            >
              {t('verifyConfirm')}
            </Button>
          </form>
        </div>
      )}

      {organizationId && actions.assign && (
        <ActionForm
          summary={t('assign')}
          confirm={t('assignConfirm')}
          busy={action.isPending}
          disabled={!workerId}
          onSubmit={() => run({ kind: 'assign', workerId, note: note.trim() || undefined })}
        >
          {workerSelect}
          <TextAreaField
            label={t('note')}
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </ActionForm>
      )}
      {organizationId && actions.reassign && (
        <ActionForm
          summary={t('reassign')}
          confirm={t('reassignConfirm')}
          busy={action.isPending}
          disabled={!workerId || reason.trim().length < 10}
          onSubmit={() =>
            run({
              kind: 'reassign',
              workerId,
              reason: reason.trim(),
              note: note.trim() || undefined,
            })
          }
        >
          {workerSelect}
          <TextAreaField
            label={t('reason')}
            rows={2}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </ActionForm>
      )}
      {organizationId && actions.cancelAssignment && (
        <ActionForm
          summary={t('cancel')}
          confirm={t('cancelConfirm')}
          busy={action.isPending}
          disabled={reason.trim().length < 10}
          onSubmit={() => run({ kind: 'cancel-assignment', reason: reason.trim() })}
        >
          <TextAreaField
            label={t('reason')}
            rows={2}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </ActionForm>
      )}
      {organizationId && actions.reopen && (
        <ActionForm
          summary={t('reopen')}
          confirm={t('reopenConfirm')}
          busy={action.isPending}
          disabled={reason.trim().length < 10}
          onSubmit={() => run({ kind: 'reopen', reason: reason.trim() })}
        >
          <TextAreaField
            label={t('reason')}
            rows={2}
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </ActionForm>
      )}
      {organizationId && actions.close && (
        <div className="space-y-2">
          <p className="text-muted text-sm">{t('closeHint')}</p>
          <Button
            type="button"
            variant="secondary"
            busy={action.isPending}
            onClick={() => run({ kind: 'close' })}
          >
            {t('close')}
          </Button>
        </div>
      )}

      {(report.status === 'RESOLVED' ||
        report.status === 'CLOSED' ||
        report.feedback.length > 0) && (
        <div className="space-y-2">
          <h3 className="font-semibold">{t('feedback')}</h3>
          {report.feedback.length === 0 ? (
            <p className="text-muted">{t('noFeedback')}</p>
          ) : (
            <ul className="space-y-2">
              {report.feedback.map((entry) => (
                <li key={entry.createdAt} className="border-border border-s-2 ps-3">
                  <p className="font-medium">{entry.fixed ? t('fixedYes') : t('fixedNo')}</p>
                  {entry.comment && <p className="text-sm whitespace-pre-line">{entry.comment}</p>}
                  <p className="text-muted text-sm">
                    {format.dateTime(new Date(entry.createdAt), { dateStyle: 'medium' })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}
