import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

/* Gridpaper palette — lifted straight from globals.css so the card reads as a
   page torn from the site. One ledger-green accent; the SQL readout is the only
   dark element, echoing the live query panel on the homepage. */
const PAPER = '#f4f4f0';
const CARD = '#ffffff';
const INK = '#1b1d1b';
const MUTED = '#5e645f';
const RULE = '#dedfd6';
const LEDGER = '#0b6e4f';

const CODE_BG = '#2d353b';
const CODE_FG = '#d3c6aa';
const CODE_MUTED = '#859289';
const CODE_KEY = '#a7c080';
const CODE_RULE = '#475258';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const postTitle = searchParams.get('title');

  // Static paths only — bundlers can't emit an asset from a dynamic new URL().
  const [schibsted600, schibsted400, plexMono500] = await Promise.all([
    fetch(new URL('../../assets/fonts/SchibstedGrotesk-600.ttf', import.meta.url)).then((r) =>
      r.arrayBuffer()
    ),
    fetch(new URL('../../assets/fonts/SchibstedGrotesk-400.ttf', import.meta.url)).then((r) =>
      r.arrayBuffer()
    ),
    fetch(new URL('../../assets/fonts/IBMPlexMono-500.ttf', import.meta.url)).then((r) =>
      r.arrayBuffer()
    ),
  ]);

  // Post titles vary in length; step the display size down so long ones fit.
  const titleSize = postTitle ? (postTitle.length > 58 ? 46 : postTitle.length > 36 ? 54 : 62) : 64;

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        backgroundColor: PAPER,
        padding: 44,
        fontFamily: 'Schibsted',
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
          borderRadius: 20,
          backgroundColor: CARD,
          padding: '46px 56px',
        }}
      >
        {/* Header: wordmark + license */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            borderBottom: `2px solid ${RULE}`,
            paddingBottom: 26,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <svg
              aria-hidden="true"
              width="42"
              height="42"
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
          <div
            style={{
              display: 'flex',
              fontFamily: 'PlexMono',
              fontSize: 18,
              color: MUTED,
              letterSpacing: '0.04em',
            }}
          >
            open source · MIT
          </div>
        </div>

        {/* Body: headline + subline on the left, live SQL readout on the right */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 44,
            paddingTop: 6,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 610 }}>
            <div
              style={{
                display: 'flex',
                fontFamily: 'PlexMono',
                fontSize: 16,
                color: LEDGER,
                letterSpacing: '0.16em',
                marginBottom: 22,
              }}
            >
              POSTGRES · MYSQL · SQLITE
            </div>

            {postTitle ? (
              <div
                style={{
                  display: 'flex',
                  fontSize: titleSize,
                  fontWeight: 600,
                  color: INK,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.06,
                }}
              >
                {postTitle}
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  fontSize: titleSize,
                  fontWeight: 600,
                  color: INK,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.04,
                }}
              >
                <div style={{ display: 'flex' }}>Tables that reach</div>
                <div style={{ display: 'flex' }}>
                  <span style={{ marginRight: 18 }}>your</span>
                  <span style={{ color: LEDGER }}>database</span>
                </div>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                fontFamily: 'Schibsted',
                fontWeight: 400,
                fontSize: 21,
                color: '#3f453f',
                lineHeight: 1.42,
                marginTop: 22,
                maxWidth: 480,
              }}
            >
              Define your columns once in TypeScript. Filtering, sorting, and edits become real SQL.
            </div>
          </div>

          {/* Signature: the generated-SQL readout from the homepage */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: 366,
              flexShrink: 0,
              backgroundColor: CODE_BG,
              border: `1px solid ${CODE_RULE}`,
              borderRadius: 14,
              padding: '22px 24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'PlexMono',
                fontSize: 12.5,
                color: CODE_MUTED,
                letterSpacing: '0.12em',
                paddingBottom: 16,
                marginBottom: 16,
                borderBottom: `1px solid ${CODE_RULE}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: CODE_KEY,
                }}
              />
              GENERATED SQL
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'PlexMono',
                fontSize: 16.5,
                lineHeight: 1.62,
                color: CODE_FG,
              }}
            >
              {[
                ['select', 'name, city'],
                ['from', 'users'],
                ['left join', 'profiles'],
                ['where', "city = 'berlin'"],
                ['order by', 'joined desc'],
              ].map(([kw, rest]) => (
                <div key={kw} style={{ display: 'flex' }}>
                  <span style={{ color: CODE_KEY, marginRight: 9 }}>{kw}</span>
                  <span>{rest}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer: strap + repo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            borderTop: `2px solid ${RULE}`,
            paddingTop: 26,
            fontFamily: 'PlexMono',
            fontSize: 19,
          }}
        >
          <div style={{ display: 'flex', color: MUTED }}>
            One definition. Real queries. UI you own.
          </div>
          <div style={{ display: 'flex', color: LEDGER }}>github.com/better-tables</div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Schibsted', data: schibsted600, style: 'normal', weight: 600 },
        { name: 'Schibsted', data: schibsted400, style: 'normal', weight: 400 },
        { name: 'PlexMono', data: plexMono500, style: 'normal', weight: 500 },
      ],
    }
  );
}
