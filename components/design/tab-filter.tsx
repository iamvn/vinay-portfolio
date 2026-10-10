'use client';

import { useState, type ReactNode } from 'react';

/**
 * A segmented control (like the ones on Apple's sites) that filters a list: each item says which tabs it
 * belongs to. Used by the Skills "Tabs" layout and the Projects "Featured / All" switch. The items are
 * rendered on the server and passed in; only the choice of tab lives here.
 */
export function TabFilter({ tabs, items, className, align = 'left' }: {
  tabs: { id: string; label: string }[];
  items: { key: string; tabs: string[]; node: ReactNode }[];
  className: string;
  align?: 'left' | 'right' | 'center';
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const shown = items.filter((item) => item.tabs.includes(active));
  return (
    // min-w-0 everywhere: a long row of tabs scrolls sideways instead of widening the page on phones.
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div className={`flex min-w-0 max-w-full ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
        <div role="tablist" className="d-segmented">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={tab.id === active} onClick={() => setActive(tab.id)} className="d-segment">{tab.label}</button>
          ))}
        </div>
      </div>
      <div className={`min-w-0 ${className}`} role="tabpanel">{shown.map((item) => <div key={item.key} className="contents">{item.node}</div>)}</div>
    </div>
  );
}
