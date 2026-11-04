import { useEffect, useSyncExternalStore } from 'react';
import type { MfaState } from './api';

/**
 * Accepts only same-site relative paths for post-sign-in redirects ("/account"), rejecting
 * absolute URLs and protocol-relative ("//evil.example") values to prevent open redirects.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/account'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback;
  }
  return next;
}

/**
 * Where a signed-in user must go before anything else, based on two-factor state. The page
 * they originally asked for travels along as ?next= so they land there afterwards.
 */
export function mfaRedirect(mfa: MfaState, next?: string): string | null {
  const step =
    mfa === 'pending' ? '/two-factor' : mfa === 'setup_required' ? '/two-factor/setup' : null;
  if (!step) return null;
  const target = safeNextPath(next);
  return target === '/account' ? step : `${step}?next=${encodeURIComponent(target)}`;
}

/** The validated ?next= of the current page (call from event handlers and effects only). */
export function currentNextPath(): string {
  return safeNextPath(new URLSearchParams(window.location.search).get('next'));
}

/** Reads a token from the URL fragment (#token=…), which is never sent to any server. */
export function tokenFromFragment(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return token && token.length >= 20 ? token : null;
}

let capturedToken: string | null | undefined;

function readFragmentToken(): string | null {
  // A fresh link (new fragment) replaces any token captured earlier in this tab.
  const fresh = tokenFromFragment(window.location.hash);
  if (fresh) capturedToken = fresh;
  return capturedToken ?? null;
}

const noSubscription = () => () => undefined;

/**
 * The token from a #token=… link: undefined while server rendering, then the token or null.
 * Pair with useClearFragment so the token does not stay in the address bar or history.
 */
export function useFragmentToken(): string | null | undefined {
  return useSyncExternalStore(noSubscription, readFragmentToken, () => undefined);
}

/** Removes the fragment from the address bar and browser history once it has been read. */
export function useClearFragment(): void {
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);
}
