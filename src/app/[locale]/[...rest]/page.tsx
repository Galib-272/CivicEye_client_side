import { notFound } from 'next/navigation';

// Unmatched paths under a locale render the localized [locale]/not-found page.
export default function CatchAllPage() {
  notFound();
}
