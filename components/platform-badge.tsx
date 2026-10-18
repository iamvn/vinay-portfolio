import Link from 'next/link';
import { BRAND, brandUrl } from '@/lib/brand';
import { BrandMark, BrandName } from './brand-mark';

/**
 * "Built on Kritipath", and "Kritipath Community" beside it: shown at the bottom of every public page of every site on the platform.
 * Fixed in code on purpose: there is no setting, design block or template option that hides it.
 * It takes the page's muted text color (designed pages) or a soft grey (the classic site).
 */
export function PlatformBadge({ source = 'site-badge' }: { source?: string }) {
  return (
    <div className="platform-badge" data-platform-badge="">
      <a href={brandUrl(source)} target="_blank" rel="noopener" aria-label={`Built on ${BRAND.name}: about the platform`}>
        <span>Built on</span>
        <BrandMark size={16} />
        <b><BrandName /></b>
      </a>
      {/* The open community (interview experiences, free resources), on this same site. Not on the community pages themselves. */}
      {source !== 'community' && (
        <Link href="/community" aria-label={`${BRAND.name} Community: interview experiences and free resources`}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.2a5.5 5.5 0 0 1 2.5 4.8" />
          </svg>
          <b><BrandName /> Community</b>
        </Link>
      )}
    </div>
  );
}
