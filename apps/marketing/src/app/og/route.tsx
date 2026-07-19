import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';
import { siteConfig } from '@/lib/config';

export const runtime = 'edge';

const PAPER = '#f4f4f0';
const INK = '#1b1d1b';
const MUTED = '#5e645f';
const RULE = '#dedfd6';
const LEDGER = '#0b6e4f';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const postTitle = searchParams.get('title') || siteConfig.tagline;
  const fontData = await fetch(
    new URL('../../assets/fonts/Inter-SemiBold.ttf', import.meta.url)
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        backgroundColor: PAPER,
        padding: 40,
        fontWeight: 600,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          border: `2px solid ${RULE}`,
          borderRadius: 16,
          backgroundColor: '#ffffff',
          padding: '48px 56px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            borderBottom: `2px solid ${RULE}`,
            paddingBottom: 28,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <svg
              aria-hidden="true"
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke={LEDGER}
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <rect x="3" y="4" width="18" height="16" rx="2.5" />
              <path d="M3 9.5h18" />
              <path d="M9 9.5V20" />
              <path d="M15 9.5V20" />
            </svg>
            <div style={{ display: 'flex', fontSize: 30, color: INK, letterSpacing: '-0.02em' }}>
              Better Tables
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: MUTED }}>open source · MIT</div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: 62,
            color: INK,
            letterSpacing: '-0.03em',
            lineHeight: 1.12,
            maxWidth: 980,
          }}
        >
          {postTitle}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            borderTop: `2px solid ${RULE}`,
            paddingTop: 28,
          }}
        >
          <div style={{ display: 'flex', fontSize: 22, color: MUTED }}>
            React tables, compiled to real SQL
          </div>
          <div style={{ display: 'flex', fontSize: 22, color: LEDGER }}>
            github.com/Better-Tables
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Inter',
          data: fontData,
          style: 'normal',
        },
      ],
    }
  );
}
