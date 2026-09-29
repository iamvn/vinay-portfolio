'use client';

import { useEffect, useRef, useState } from 'react';
import { api, describeError } from './api';
import { IMAGE_ACCEPT, prepareImage } from './image';
import { Button, Card, ConfirmButton, Field, Loading, SaveBar, TextArea, TextInput, Toggle, inputClass, type Notify } from './ui';

type Profile = {
  name: string; role: string; location: string; available: boolean; summary: string;
  yearsExperience: string; profileImage: string; productsShipped: string; performanceMetric: string;
  lighthouse: string; usersImpacted: string;
  socialLinks: { github?: string; linkedin?: string; instagram?: string; email?: string };
};

const TEXT_FIELDS: { key: keyof Profile; label: string; hint?: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
  { key: 'location', label: 'Location' },
];

const STAT_FIELDS: { key: keyof Profile; label: string; hint?: string }[] = [
  { key: 'yearsExperience', label: 'Years of experience', hint: 'Drives LEVEL and XP in the header, e.g. "6+" → LEVEL 06' },
  { key: 'productsShipped', label: 'Products shipped' },
  { key: 'performanceMetric', label: 'Performance metric' },
  { key: 'lighthouse', label: 'Lighthouse score' },
  { key: 'usersImpacted', label: 'Users impacted' },
];

const LINKS = ['github', 'linkedin', 'instagram', 'email'] as const;
const LINK_INPUT: Record<(typeof LINKS)[number], { type: string; placeholder: string }> = {
  github: { type: 'url', placeholder: 'https://github.com/…' },
  linkedin: { type: 'url', placeholder: 'https://linkedin.com/in/…' },
  instagram: { type: 'url', placeholder: 'https://instagram.com/…' },
  email: { type: 'email', placeholder: 'mailto:you@example.com' },
};

const UPLOADED_PREFIX = '/api/profile-image';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function PictureCard({ name, value, onChange, notify }: { name: string; value: string; onChange: (value: string) => void; notify: Notify }) {
  const [busy, setBusy] = useState<'' | 'Preparing…' | 'Uploading…'>('');
  const input = useRef<HTMLInputElement>(null);
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const isUploaded = value.startsWith(UPLOADED_PREFIX);

  async function upload(original: File) {
    if (!original.type.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(original.name)) {
      return notify('Please choose a photo (.jpg, .png, .webp or an iPhone photo).', 'error');
    }
    try {
      setBusy('Preparing…');
      const file = await prepareImage(original); // shrinks big phone photos before upload
      if (file.size > MAX_IMAGE_BYTES) return notify('The image is still larger than 2 MB. Try a smaller photo.', 'error');
      setBusy('Uploading…');
      const form = new FormData();
      form.append('file', file);
      const saved = await api<{ url: string }>('POST', '/api/profile-image', form);
      onChange(saved.url); // the server already saved it on the profile
      notify('Profile picture updated. It is live on the site.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy('');
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    setBusy('Uploading…');
    try {
      await api('DELETE', '/api/profile-image');
      onChange('');
      notify('Profile picture removed. The site shows your initials instead.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <Card title="Profile picture">
      <div
        className="flex flex-col items-center gap-5 sm:flex-row sm:items-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) upload(file); }}
      >
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={Boolean(busy)}
          aria-label="Choose a new profile picture"
          className="relative size-32 shrink-0 overflow-hidden rounded-full border-2 border-lime-300/50 bg-slate-900 sm:size-28 sm:rounded-2xl"
        >
          {value
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={value} alt="Profile preview" className="h-full w-full object-cover" />
            : <span className="flex h-full w-full items-center justify-center text-3xl font-black text-white">{initials}</span>}
          {busy && <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs font-bold text-lime-200">{busy}</span>}
        </button>
        <div className="w-full flex-1 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button tone="primary" onClick={() => input.current?.click()} disabled={Boolean(busy)} className="w-full py-3 sm:w-auto sm:py-2">
              {busy || (value ? 'Change photo' : 'Upload photo')}
            </Button>
            {isUploaded && <ConfirmButton onConfirm={remove} disabled={Boolean(busy)} className="w-full sm:w-auto" confirmLabel="Tap again to remove">Remove photo</ConfirmButton>}
          </div>
          <p className="text-center text-[11px] text-slate-500 sm:text-left">
            Pick from your photos or take one. Large photos are shrunk automatically. A square photo looks best. Saves immediately.
          </p>
          <details className="text-xs text-slate-400">
            <summary className="flex min-h-11 cursor-pointer items-center sm:min-h-0">Use an image path instead</summary>
            <div className="mt-2">
              <Field label="Image path" hint="A file in /public (e.g. /images/profile.jpeg). Empty = show initials. Press Save to apply.">
                <TextInput value={value} onChange={onChange} />
              </Field>
            </div>
          </details>
        </div>
        <input
          ref={input}
          type="file"
          className="hidden"
          accept={IMAGE_ACCEPT}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }}
        />
      </div>
    </Card>
  );
}

export function ProfileTab({ notify }: { notify: Notify }) {
  const [saved, setSaved] = useState<Profile | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Profile>('GET', '/api/profile')
      .then((data) => { setSaved(data); setProfile(data); })
      .catch((error) => notify(describeError(error), 'error'));
  }, [notify]);

  if (!profile || !saved) return <Loading />;

  // An upload is saved on the server right away, so it updates both the saved copy and the form.
  const setPicture = (value: string, alreadySaved: boolean) => {
    setProfile((current) => current && { ...current, profileImage: value });
    if (alreadySaved) setSaved((current) => current && { ...current, profileImage: value });
  };
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile({ ...profile, [key]: value });
  const setLink = (key: (typeof LINKS)[number], value: string) =>
    setProfile({ ...profile, socialLinks: { ...profile.socialLinks, [key]: value } });

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      // Empty link fields are sent as null so they are removed.
      const socialLinks = Object.fromEntries(LINKS.map((key) => [key, profile.socialLinks[key]?.trim() || null]));
      const updated = await api<Profile>('PATCH', '/api/profile', { ...profile, socialLinks });
      setSaved(updated);
      setProfile(updated);
      notify('Profile saved.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PictureCard
        name={profile.name}
        value={profile.profileImage}
        onChange={(value) => setPicture(value, value === '' || value.startsWith(UPLOADED_PREFIX))}
        notify={notify}
      />

      <Card title="Basics">
        <div className="grid gap-4 md:grid-cols-2">
          {TEXT_FIELDS.map(({ key, label, hint }) => (
            <Field key={key} label={label} hint={hint}>
              <TextInput value={String(profile[key])} onChange={(value) => set(key, value as never)} />
            </Field>
          ))}
        </div>
        <div className="mt-4">
          <Field label="Summary">
            <TextArea value={profile.summary} onChange={(value) => set('summary', value)} rows={4} />
          </Field>
        </div>
        <div className="mt-3">
          <Toggle checked={profile.available} onChange={(value) => set('available', value)} label="Available for opportunities" />
        </div>
      </Card>

      <Card title="Stats">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          {STAT_FIELDS.map(({ key, label, hint }) => (
            <div key={key} className={key === 'yearsExperience' ? 'col-span-2 md:col-span-1' : ''}>
              <Field label={label} hint={hint}>
                <TextInput value={String(profile[key])} onChange={(value) => set(key, value as never)} />
              </Field>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Social links">
        <div className="grid gap-4 md:grid-cols-2">
          {LINKS.map((key) => (
            <Field key={key} label={key} hint={key === 'email' ? 'e.g. mailto:you@example.com' : 'Leave empty to hide'}>
              <input
                type={LINK_INPUT[key].type === 'email' ? 'text' : 'url'}
                inputMode={LINK_INPUT[key].type === 'email' ? 'email' : 'url'}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={LINK_INPUT[key].placeholder}
                value={profile.socialLinks[key] ?? ''}
                onChange={(e) => setLink(key, e.target.value)}
                className={inputClass}
              />
            </Field>
          ))}
        </div>
      </Card>

      <SaveBar dirty={dirty} busy={saving} onSave={save} onReset={() => setProfile(saved)} saveLabel="Save profile" />
    </div>
  );
}
