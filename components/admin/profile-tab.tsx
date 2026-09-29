'use client';

import { useEffect, useRef, useState } from 'react';
import { api, describeError } from './api';
import { Button, Card, ConfirmButton, Field, Loading, TextArea, TextInput, Toggle, type Notify } from './ui';

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

const UPLOADED_PREFIX = '/api/profile-image';
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function PictureCard({ name, value, onChange, notify }: { name: string; value: string; onChange: (value: string) => void; notify: Notify }) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const isUploaded = value.startsWith(UPLOADED_PREFIX);

  async function upload(file: File) {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) return notify('Only .jpg, .jpeg, .png and .webp images are allowed.', 'error');
    if (file.size > MAX_IMAGE_BYTES) return notify('The image is larger than 2 MB.', 'error');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const saved = await api<{ url: string }>('POST', '/api/profile-image', form);
      onChange(saved.url); // the server already saved it on the profile
      notify('Profile picture uploaded. It is live on the site.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api('DELETE', '/api/profile-image');
      onChange('');
      notify('Profile picture removed. The site shows your initials instead.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Profile picture">
      <div
        className="flex flex-col gap-5 sm:flex-row sm:items-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) upload(file); }}
      >
        <div className="size-28 shrink-0 overflow-hidden rounded-2xl border border-lime-300/30 bg-slate-900">
          {value
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={value} alt="Profile preview" className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white">{initials}</div>}
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button tone="primary" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Uploading…' : value ? 'Upload new picture' : 'Upload picture'}</Button>
            {isUploaded && <ConfirmButton onConfirm={remove} disabled={busy}>Remove</ConfirmButton>}
          </div>
          <p className="text-[11px] text-slate-500">Click or drop an image · .jpg, .png or .webp · max 2 MB · a square image looks best. Uploading saves immediately.</p>
          <Field label="Or use an image path" hint="A file in /public (e.g. /images/profile.jpeg). Empty = show initials. Press Save profile to apply.">
            <TextInput value={value} onChange={onChange} />
          </Field>
        </div>
        <input
          ref={input}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); }}
        />
      </div>
    </Card>
  );
}

export function ProfileTab({ notify }: { notify: Notify }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Profile>('GET', '/api/profile').then(setProfile).catch((error) => notify(describeError(error), 'error'));
  }, [notify]);

  if (!profile) return <Loading />;

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile({ ...profile, [key]: value });
  const setLink = (key: (typeof LINKS)[number], value: string) =>
    setProfile({ ...profile, socialLinks: { ...profile.socialLinks, [key]: value } });

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      // Empty link fields are sent as null so they are removed.
      const socialLinks = Object.fromEntries(LINKS.map((key) => [key, profile.socialLinks[key]?.trim() || null]));
      setProfile(await api<Profile>('PATCH', '/api/profile', { ...profile, socialLinks }));
      notify('Profile saved.');
    } catch (error) {
      notify(describeError(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PictureCard name={profile.name} value={profile.profileImage} onChange={(value) => setProfile((current) => current && { ...current, profileImage: value })} notify={notify} />

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
            <TextArea value={profile.summary} onChange={(value) => set('summary', value)} rows={3} />
          </Field>
        </div>
        <div className="mt-4">
          <Toggle checked={profile.available} onChange={(value) => set('available', value)} label="Available for opportunities" />
        </div>
      </Card>

      <Card title="Stats">
        <div className="grid gap-4 md:grid-cols-3">
          {STAT_FIELDS.map(({ key, label, hint }) => (
            <Field key={key} label={label} hint={hint}>
              <TextInput value={String(profile[key])} onChange={(value) => set(key, value as never)} />
            </Field>
          ))}
        </div>
      </Card>

      <Card title="Social links" >
        <div className="grid gap-4 md:grid-cols-2">
          {LINKS.map((key) => (
            <Field key={key} label={key} hint={key === 'email' ? 'e.g. mailto:you@example.com' : 'Leave empty to hide'}>
              <TextInput value={profile.socialLinks[key] ?? ''} onChange={(value) => setLink(key, value)} />
            </Field>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button tone="primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
      </div>
    </div>
  );
}
