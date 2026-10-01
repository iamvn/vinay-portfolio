import type { ReactNode } from 'react';
import { getPublished, type StoredDesign } from '@/lib/design/store';
import { recolorsClassic, themeVars, type RootProps } from '@/lib/design/theme';

/**
 * Pages other than the homepage (e.g. a project's page) are built with the classic site's styles.
 * When a design is published in Admin → Design, this wraps them in the design's theme so they match the
 * homepage: its colors, background effect and button style. Without a published design nothing changes.
 */
export async function PageTheme({ children, design: given }: { children: ReactNode; design?: StoredDesign | null }) {
  // Pass the design in when the page already loads it (in parallel with its other data) to save a round trip.
  const design = given === undefined ? await getPublished() : given;
  if (!design) return <>{children}</>;
  const props = ((design.data as { root?: { props?: Partial<RootProps> } }).root?.props ?? {}) as Partial<RootProps>;
  const classes = [
    'd-root d-page',
    props.effects === 'grid' || props.effects === 'scanlines' ? `d-effect-${props.effects}` : '',
    recolorsClassic(props) ? 'd-recolor' : '',
    props.buttonStyle === 'outline' ? 'd-buttons-outline' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={classes} style={themeVars(props)} dir={props.direction === 'rtl' ? 'rtl' : 'ltr'}>
      <div className="d-classic">{children}</div>
    </div>
  );
}
