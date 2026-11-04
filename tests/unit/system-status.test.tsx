import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import { SystemStatus } from '@/features/system-status/system-status';

function renderStatus() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Dhaka">
      <QueryClientProvider client={queryClient}>
        <SystemStatus />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json', 'x-request-id': 'req-from-header' },
        }),
      ),
    ),
  );
}

function rowState(label: string) {
  return screen.getByText(label).closest('div')?.querySelector('dd')?.textContent;
}

describe('SystemStatus', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows every component as available when the API is ready', async () => {
    respondWith(200, {
      success: true,
      data: { status: 'ok', checks: { database: 'up', redis: 'up' } },
      meta: { requestId: 'r1' },
    });
    renderStatus();

    expect(await screen.findByText('Database')).toBeInTheDocument();
    expect(rowState('API readiness')).toContain('Available');
    expect(rowState('Database')).toContain('Available');
    expect(rowState('Redis')).toContain('Available');
  });

  it('shows which dependency is down, in text, with the request ID', async () => {
    respondWith(503, {
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'The service is temporarily unavailable.',
        details: [
          { message: 'database is up', component: 'database', status: 'up' },
          { message: 'redis is down', component: 'redis', status: 'down' },
        ],
        requestId: 'req-503',
      },
    });
    renderStatus();

    expect(await screen.findByText('Request ID: req-503')).toBeInTheDocument();
    expect(rowState('API readiness')).toContain('Unavailable');
    expect(rowState('Database')).toContain('Available');
    expect(rowState('Redis')).toContain('Unavailable');
  });

  it('announces when the API cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    renderStatus();

    expect(await screen.findByRole('alert')).toHaveTextContent('The API could not be reached.');
    expect(rowState('Database')).toContain('Unknown');
  });
});
