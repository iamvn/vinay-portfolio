import { BRAND, brandUrl } from '@/lib/brand';
import { BrandMark, BrandName } from './brand-mark';

/**
 * "Built on Kritipath": shown at the bottom of every public page of every site on the platform.
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
    </div>
  );
}
