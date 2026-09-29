import { ImageResponse } from 'next/og';
import { getPortfolioFromDatabase } from '@/lib/portfolio-repository';
import { SITE_URL, mainTechnologies } from '@/lib/seo';

// The preview card shown when the site is shared on LinkedIn, X, WhatsApp, Slack, etc.
// Built from the profile on each request so it always matches the site.
export const dynamic = 'force-dynamic';
export const alt = 'Vinay Bharti — Senior Software Engineer portfolio';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const FALLBACK = { name: 'Vinay Bharti', role: 'Senior Software Engineer', location: 'Pune, India', tech: ['React', 'Next.js', 'TypeScript', 'AI Engineering'] };

async function load() {
  try {
    const { profile, skills } = await getPortfolioFromDatabase();
    const ai = skills.some((group) => /\bAI\b/.test(group.group));
    return { name: profile.name, role: profile.role, location: profile.location, tech: [...mainTechnologies(skills, 3), ...(ai ? ['AI Engineering'] : [])] };
  } catch {
    return FALLBACK;
  }
}

export default async function OpengraphImage() {
  const { name, role, location, tech } = await load();
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: 'linear-gradient(135deg, #030609 0%, #0b1620 60%, #10202b 100%)', color: '#f8fafc', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#bef264', fontSize: 26, letterSpacing: 6, textTransform: 'uppercase' }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: '#bef264' }} />
          Portfolio
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>{name}</div>
          <div style={{ marginTop: 20, fontSize: 44, color: '#67e8f9' }}>{role}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 36 }}>
            {tech.map((item) => (
              <div key={item} style={{ display: 'flex', padding: '10px 22px', borderRadius: 999, border: '2px solid rgba(190,242,100,.45)', color: '#d9f99d', fontSize: 28 }}>{item}</div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 26 }}>
          <div>{location}</div>
          <div>{SITE_URL.replace(/^https?:\/\//, '')}</div>
        </div>
      </div>
    ),
    size,
  );
}
