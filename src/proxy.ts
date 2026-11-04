import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Redirects unprefixed paths to a supported locale (e.g. / → /en or /bn).
export default createMiddleware(routing);

export const config = {
  // Skip Next internals, API routes and static files.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
