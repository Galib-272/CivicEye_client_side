'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { Duration, Range } from './api';

/** A row of headline numbers. */
export function Stats({ items }: { items: Array<{ label: string; value: number | string }> }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="border-border rounded-md border p-3">
          <dt className="text-muted text-sm">{item.label}</dt>
          <dd className="text-2xl font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Horizontal bars with the numbers written out, so the chart reads the same to screen readers
 * and in print. Bars are relative to the largest value.
 */
export function BarList({
  items,
  empty,
}: {
  items: Array<{ key: string; label: string; value: number }>;
  empty: string;
}) {
  const format = useFormatter();
  if (items.length === 0) return <p className="text-muted">{empty}</p>;
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
          <span className="truncate text-sm" title={item.label}>
            {item.label}
          </span>
          <span className="bg-border/40 h-3 rounded-sm" aria-hidden="true">
            <span
              className="bg-accent block h-3 rounded-sm"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </span>
          <span className="text-sm tabular-nums">{format.number(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Weekly columns for one or two series, with a table behind them for screen readers. */
export function WeekChart({
  weeks,
  series,
  caption,
}: {
  weeks: Array<{ weekStart: string } & Record<string, number | string>>;
  series: Array<{ key: string; label: string; className: string }>;
  caption: string;
}) {
  const t = useTranslations('Insights');
  const format = useFormatter();
  const max = Math.max(1, ...weeks.flatMap((week) => series.map((s) => Number(week[s.key] ?? 0))));
  const label = (iso: string) =>
    format.dateTime(new Date(`${iso}T00:00:00`), { day: 'numeric', month: 'short' });
  return (
    <figure className="space-y-2">
      <div className="flex h-36 items-end gap-1" aria-hidden="true">
        {weeks.map((week) => (
          <div key={week.weekStart} className="flex h-full flex-1 items-end justify-center gap-px">
            {series.map((s) => (
              <span
                key={s.key}
                className={`${s.className} w-full max-w-4 rounded-t-sm`}
                style={{ height: `${(Number(week[s.key] ?? 0) / max) * 100}%` }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="text-muted flex gap-1 text-[10px]" aria-hidden="true">
        {weeks.map((week, index) => (
          <span key={week.weekStart} className="flex-1 text-center">
            {index % 3 === 0 ? label(week.weekStart) : ''}
          </span>
        ))}
      </div>
      <figcaption className="flex flex-wrap gap-4 text-sm">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span className={`${s.className} inline-block h-3 w-3 rounded-sm`} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </figcaption>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('week')}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.weekStart}>
              <th scope="row">{label(week.weekStart)}</th>
              {series.map((s) => (
                <td key={s.key}>{week[s.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** A duration: median and 90th percentile, or a clear "too few cases" note (docs/metrics.md). */
export function DurationCard({ title, duration }: { title: string; duration: Duration }) {
  const t = useTranslations('Insights');
  const format = useFormatter();
  const hours = (value: number | null) =>
    value === null
      ? '—'
      : t('hours', { value: format.number(value, { maximumFractionDigits: 1 }) });
  return (
    <div className="border-border space-y-1 rounded-md border p-3">
      <p className="text-muted text-sm">{title}</p>
      {duration.count === 0 ? (
        <p className="text-muted">{t('noCases')}</p>
      ) : (
        <>
          <p className="text-2xl font-semibold tabular-nums">{hours(duration.medianHours)}</p>
          <p className="text-muted text-sm">
            {t('durationDetail', {
              p90: hours(duration.p90Hours),
              mean: hours(duration.meanHours),
              count: duration.count,
            })}
          </p>
          {!duration.enoughData && <p className="text-sm">{t('tooFew')}</p>}
        </>
      )}
    </div>
  );
}

/** Date range for a dashboard. Empty means the last 30 days. */
export function RangePicker({
  value,
  onChange,
}: {
  value: Range & { from: string; to: string };
  onChange: (range: Range) => void;
}) {
  const t = useTranslations('Insights');
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onChange({ from, to });
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3" aria-label={t('range')}>
      <label className="space-y-1 text-sm">
        <span className="block font-medium">{t('from')}</span>
        <input
          type="date"
          value={from}
          max={to}
          onChange={(event) => setFrom(event.target.value)}
          className="border-border bg-background focus-ring rounded-md border px-3 py-2"
          required
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="block font-medium">{t('to')}</span>
        <input
          type="date"
          value={to}
          min={from}
          onChange={(event) => setTo(event.target.value)}
          className="border-border bg-background focus-ring rounded-md border px-3 py-2"
          required
        />
      </label>
      <Button type="submit" variant="secondary">
        {t('apply')}
      </Button>
      <p className="text-muted w-full text-sm">{t('timeZone')}</p>
    </form>
  );
}
