import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'bn'],
  // English is the fallback when the browser's language cannot be matched. Visitors are
  // redirected to their preferred supported language on first visit.
  defaultLocale: 'en',
});

export type Locale = (typeof routing.locales)[number];

/** Operational timezone (PRD §11.10). Timestamps are stored in UTC and displayed in this zone. */
export const DEFAULT_TIME_ZONE = 'Asia/Dhaka';
