'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useReadiness, type ComponentState } from './use-readiness';

// Status is conveyed by text and a symbol, never by color alone (WCAG 1.4.1).
const SYMBOL: Record<ComponentState, string> = { up: '✓', down: '✕', unknown: '?' };

function StatusRow({ label, state }: { label: string; state: ComponentState }) {
  const t = useTranslations('SystemStatus.state');
  return (
    <div className="border-border flex items-center justify-between border-b py-3 last:border-b-0">
      <dt className="font-medium">{label}</dt>
      <dd className="flex items-center gap-2">
        <span aria-hidden="true">{SYMBOL[state]}</span>
        <span>{t(state)}</span>
      </dd>
    </div>
  );
}

export function SystemStatus() {
  const t = useTranslations('SystemStatus');
  const format = useFormatter();
  const { data, isFetching, dataUpdatedAt, refetch } = useReadiness();

  return (
    <section className="border-border bg-surface rounded-lg border p-5" aria-busy={isFetching}>
      <div aria-live="polite" className="space-y-4">
        {data === undefined ? (
          <p>{t('checking')}</p>
        ) : (
          <>
            {!data.apiReachable && (
              <p role="alert" className="font-medium">
                {t('apiUnreachable')}
              </p>
            )}
            <dl>
              <StatusRow
                label={t('overall')}
                state={data.apiReachable ? (data.ready ? 'up' : 'down') : 'unknown'}
              />
              <StatusRow label={t('component.database')} state={data.checks.database} />
              <StatusRow label={t('component.redis')} state={data.checks.redis} />
            </dl>
            <p className="text-muted text-sm">
              {t('lastChecked', {
                time: format.dateTime(new Date(dataUpdatedAt), { timeStyle: 'medium' }),
              })}
              {data.requestId && (
                <span className="block">{t('requestId', { id: data.requestId })}</span>
              )}
            </p>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => void refetch()}
        disabled={isFetching}
        className="bg-accent text-background focus-ring mt-4 rounded-md px-4 py-2 font-medium disabled:opacity-60"
      >
        {isFetching ? t('checking') : t('refresh')}
      </button>
    </section>
  );
}
