'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, describeError } from './api';
import { Card, useReadOnly, type Notify } from './ui';
import { SECTIONS, SECTION_KEYS, type SectionKey } from '@/lib/sections';

/**
 * Show or hide homepage sections (lib/sections.ts). Every section is on until switched off; a change is saved
 * at once and applies to the classic site and to designed pages. Used in Site text (all sections) and at the
 * top of Projects, Experience and Skills (that one section).
 */
const EVENT = 'sections-changed';

function useHidden(notify: Notify) {
  const [hidden, setHidden] = useState<SectionKey[] | null>(null);
  const load = useCallback(() => api<{ hidden: SectionKey[] }>('GET', '/api/sections', undefined, { fresh: true }).then((d) => setHidden(d.hidden)).catch(() => setHidden([])), []);
  useEffect(() => {
    void load();
    window.addEventListener(EVENT, load);
    return () => window.removeEventListener(EVENT, load);
  }, [load]);
  const set = async (key: SectionKey, shown: boolean) => {
    const before = hidden ?? [];
    const next = shown ? before.filter((k) => k !== key) : [...new Set([...before, key])];
    setHidden(next);
    try {
      await api('PUT', '/api/sections', { hidden: next });
      window.dispatchEvent(new Event(EVENT));
      notify(shown ? `${SECTIONS[key].label} is shown on your site again.` : `${SECTIONS[key].label} is hidden from your site.`);
    } catch (error) {
      setHidden(before);
      notify(describeError(error), 'error');
    }
  };
  return { hidden, set };
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  const readOnly = useReadOnly();
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={readOnly} onClick={() => onChange(!on)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${on ? 'bg-lime-300' : 'bg-white/15'}`}>
      <span className={`inline-block size-5 rounded-full bg-white shadow transition ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

/** Site text → every section's switch. */
export function SectionSwitches({ notify }: { notify: Notify }) {
  const { hidden, set } = useHidden(notify);
  return (
    <Card title="Sections on your site" id="sections-on-site">
      <p className="mb-3 text-xs text-slate-400">Nothing to show yet, like no projects? Switch the section off and it disappears from your homepage and its menu. Your content is kept.</p>
      <ul className="divide-y divide-white/5">
        {SECTION_KEYS.map((key) => {
          const on = !(hidden ?? []).includes(key);
          return (
            <li key={key} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <b className={`block text-sm ${on ? 'text-white' : 'text-slate-500'}`}>{SECTIONS[key].label}</b>
                <span className="block text-xs text-slate-500">{on ? SECTIONS[key].hint : 'Hidden from your site'}</span>
              </span>
              {hidden && <Switch on={on} onChange={(v) => void set(key, v)} label={`Show ${SECTIONS[key].label} on my site`} />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** The switch for one section, at the top of its own tab. Suggests hiding it while there's nothing in it. */
export function SectionSwitch({ section, count, notify }: { section: SectionKey; count: number; notify: Notify }) {
  const { hidden, set } = useHidden(notify);
  if (!hidden) return null;
  const on = !hidden.includes(section);
  const empty = on && count === 0;
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${empty ? 'border-amber-300/40 bg-amber-300/[.07]' : on ? 'border-white/10 bg-white/[.03]' : 'border-white/10 bg-black/30'}`}>
      <span className="min-w-0 flex-1 text-sm">
        <b className="text-white">{on ? `${SECTIONS[section].label} section is shown on your site` : `${SECTIONS[section].label} section is hidden from your site`}</b>
        <span className="block text-xs text-slate-400">
          {empty ? `You have no ${SECTIONS[section].label.toLowerCase()} yet, so it looks empty. Switch it off until you add some.`
            : on ? 'Switch off to hide it, with its menu link. What you add here is kept.'
            : 'Switch on when you’re ready to show it.'}
        </span>
      </span>
      <Switch on={on} onChange={(v) => void set(section, v)} label={`Show the ${SECTIONS[section].label} section on my site`} />
    </div>
  );
}
