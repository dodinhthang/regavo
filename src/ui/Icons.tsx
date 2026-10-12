import { useId, type ReactNode } from 'react';
import type { CivId, Resource } from '../game/data.ts';
import {
  DAI_VIET_DRAGON_FILE,
  DAI_VIET_DRAGON_SIZE,
  DAI_VIET_DRAGON_FRAME,
} from '../render/daiviet-emblem.ts';

/** Original SVG drawings authored for Regavo. No external icon/font assets. */
const CIV_TINT: Record<CivId, string> = {
  roman: '#a3472f',
  mongol: '#876c42',
  persian: '#257d78',
  tang: '#536b45',
  ottoman: '#7d6741',
  daiviet: '#765338',
};

function Materials({ id, age = 3 }: { id: string; age?: number }) {
  const metal =
    age <= 1
      ? ['#c39761', '#7e5736', '#ba874e', '#513724']
      : age === 2
        ? ['#d3ad77', '#9f7545', '#d8b783', '#654325']
        : ['#f0daa4', '#bd934f', '#e1c787', '#7f582c'];
  return (
    <defs>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2=".85" y2="1">
        <stop offset="0" stopColor={metal[0]} />
        <stop offset=".43" stopColor={metal[1]} />
        <stop offset=".63" stopColor={metal[2]} />
        <stop offset="1" stopColor={metal[3]} />
      </linearGradient>
      <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#ba8750" />
        <stop offset=".45" stopColor="#82532f" />
        <stop offset="1" stopColor="#4d3220" />
      </linearGradient>
      <linearGradient id={`${id}-stone`} x1="0" y1="0" x2=".7" y2="1">
        <stop stopColor="#c0c6b5" />
        <stop offset=".45" stopColor="#858e82" />
        <stop offset="1" stopColor="#4a554e" />
      </linearGradient>
      <linearGradient id={`${id}-leather`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#62503b" />
        <stop offset=".48" stopColor="#342d25" />
        <stop offset="1" stopColor="#241e19" />
      </linearGradient>
      <linearGradient id={`${id}-jade`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#b5cfac" />
        <stop offset=".48" stopColor="#6c9271" />
        <stop offset="1" stopColor="#355347" />
      </linearGradient>
      <linearGradient id={`${id}-meat`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#d4906b" />
        <stop offset=".45" stopColor="#a64e35" />
        <stop offset="1" stopColor="#663626" />
      </linearGradient>
      <linearGradient id={`${id}-bread`} x1="0" y1="0" x2=".2" y2="1">
        <stop stopColor="#e7c781" />
        <stop offset=".53" stopColor="#b47d3f" />
        <stop offset="1" stopColor="#7a4d28" />
      </linearGradient>
      <radialGradient id={`${id}-face`} cx=".4" cy=".28" r=".78">
        <stop stopColor="#d8b585" />
        <stop offset="1" stopColor="#936442" />
      </radialGradient>
      <filter id={`${id}-shadow`} x="-30%" y="-30%" width="170%" height="170%">
        <feDropShadow dx="0" dy="1.2" stdDeviation=".65" floodColor="#10140f" floodOpacity=".65" />
      </filter>
      <filter id={`${id}-dragon-metal`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues=".58 1" />
          <feFuncG type="table" tableValues=".40 .91" />
          <feFuncB type="table" tableValues=".21 .66" />
        </feComponentTransfer>
      </filter>
    </defs>
  );
}

function Laurel({ id }: { id: string }) {
  return (
    <g fill={`url(#${id}-metal)`} stroke="#533b24" strokeWidth=".45">
      <path d="M22 50C9 42 10 24 17 18M42 50c13-8 12-26 5-32" fill="none" strokeWidth="1.3" />
      {[0, 1, 2, 3, 4].map((step) => (
        <g key={step} transform={`translate(0 ${step * -5.2})`}>
          <path d="M17 45c-6 0-8-3-7-6 4 0 6 2 7 6ZM18 45c-1-5 1-8 4-9 2 4 0 7-4 9Z" />
          <path d="M47 45c6 0 8-3 7-6-4 0-6 2-7 6ZM46 45c1-5-1-8-4-9-2 4 0 7 4 9Z" />
        </g>
      ))}
      <path d="m27 51 5-3 5 3-5 3Z" />
    </g>
  );
}

function RomanMark({ id }: { id: string }) {
  return (
    <>
      <Laurel id={id} />
      <g fill={`url(#${id}-metal)`} stroke="#503821" strokeWidth=".65" strokeLinejoin="round">
        <path d="M32 21c-2 1-3 3-2 6l-8-5-7-2 4 8 6 3-9-2 6 6 8 1-4 7 6-3 6 3-4-7 8-1 6-6-9 2 6-3 4-8-7 2-8 5-1-3 5-2-3-2Z" />
        <path d="m29 31 3 3 3-3-3 8Z" fill="#73542e" />
        <path d="m28 41-3 5 7-2 7 2-3-5" />
        <path
          d="M20 25l8 6m-5-6 7 7m14-7-8 6m5-6-7 7"
          fill="none"
          stroke="#f1d5a0"
          strokeOpacity=".65"
        />
      </g>
    </>
  );
}

function MongolMark({ id }: { id: string }) {
  return (
    <g stroke="#4b3526" strokeWidth=".8" strokeLinejoin="round">
      <path
        d="M24 44c1-9-2-12-4-14l4-12 4 4 5-6 4 9 10 7-2 7-11-2-1 8Z"
        fill={`url(#${id}-metal)`}
      />
      <path
        d="m24 24 4-2-1 7-4 7m9-12 6 5 7 4-9-1-4 6"
        fill="none"
        stroke="#f2d7a6"
        strokeOpacity=".7"
      />
      <path d="m24 19-3 10 3 7-1 8 4 1 1-10-4-6 4-7" fill="#775030" />
      <circle cx="35.5" cy="28.3" r="1.05" fill="#35271e" stroke="none" />
      <path
        d="M15 49h9l8-5 8 5h9l-8 5-9-5-9 5Z"
        fill="none"
        stroke={`url(#${id}-metal)`}
        strokeWidth="2.8"
      />
      <path d="m18 13 5 2m23-2-5 2" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="1.4" />
    </g>
  );
}

function PersianMark({ id }: { id: string }) {
  return (
    <g stroke="#523c25" strokeWidth=".65" strokeLinejoin="round">
      <path
        d="M20 41c-2-6 1-12 8-13l9 2 2-9 5-2 5 5-1 6-5 3-1 8 3 5h-7l-3-7-8 1-1 6h-7Z"
        fill={`url(#${id}-metal)`}
      />
      <path
        d="M32 33C27 22 24 21 17 17l-3 2 6 5-8-1 8 6-9 1 11 4-4 3 13 2Z"
        fill={`url(#${id}-metal)`}
      />
      <path
        d="m17 21 12 11m-11-7 10 9m-10-4 10 6"
        fill="none"
        stroke="#edcfa0"
        strokeOpacity=".75"
      />
      <path
        d="M22 36c-7 0-8 8-12 5-3-2-1-6 1-5"
        fill="none"
        stroke={`url(#${id}-metal)`}
        strokeWidth="2.5"
      />
      <path d="m40 22 3-2 2 4-3 3-3-1m-1 10 3-2" fill="none" />
      <circle cx="44" cy="24.5" r=".7" fill="#2c2920" stroke="none" />
      <path
        d="m33 10 2.2 4.2L40 16l-4.8 1.8L33 22l-2.2-4.2L26 16l4.8-1.8Z"
        fill="#65b2aa"
        stroke="#b4d1bc"
      />
      <path d="M17 52h30" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="1.8" />
      <path d="m25 50 7-3 7 3-7 3Z" fill="#4c8e83" />
    </g>
  );
}

function TangMark({ id }: { id: string }) {
  return (
    <g stroke="#493b2a" strokeWidth=".7" strokeLinejoin="round">
      <path d="M15 32c9-2 13-6 17-11 4 5 8 9 17 11l4-3-2 8H13l-2-8Z" fill={`url(#${id}-metal)`} />
      <path d="M20 28c7-3 9-6 12-11 3 5 5 8 12 11" fill="none" stroke="#e6c989" strokeWidth="1.5" />
      <path d="M18 38h28v12H18Z" fill={`url(#${id}-jade)`} />
      <path d="M22 38v12m6-12v12m8-12v12m6-12v12" fill="none" stroke="#bfd2ac" strokeWidth="1.2" />
      <path d="M15 49h34v4H15Z" fill={`url(#${id}-metal)`} />
      <path
        d="m17 53 0-2 5 0 0 2 5 0 0-2 5 0 0 2 5 0 0-2 5 0 0 2 5 0"
        fill="none"
        stroke="#725431"
        strokeWidth=".8"
      />
      <path d="m32 9 3 5-3 4-3-4Z" fill={`url(#${id}-jade)`} stroke="#c0d0a9" />
    </g>
  );
}

function OttomanMark({ id }: { id: string }) {
  return (
    <g stroke="#503922" strokeWidth=".75" strokeLinejoin="round">
      <path d="M17 36c0-11 5-13 15-20 10 7 15 9 15 20Z" fill={`url(#${id}-metal)`} />
      <path
        d="M22 35c0-7 3-11 10-17m5 17c0-7-2-11-5-17"
        fill="none"
        stroke="#eacb8d"
        strokeWidth="1.1"
      />
      <path d="M15 36h34v4H15Zm5 4h24v12H20Z" fill={`url(#${id}-metal)`} />
      <path d="M27 52v-8l5-4 5 4v8" fill="#3f5042" />
      <path
        d="M16 50c-10-5-3-13 1-9 4 5-5 10-5 5m36 4c10-5 3-13-1-9-4 5 5 10 5 5"
        fill="none"
        stroke={`url(#${id}-metal)`}
        strokeWidth="2"
      />
      <path
        d="M18 55c4-7 9 3 14-3 5 6 10-4 14 3"
        fill="none"
        stroke={`url(#${id}-metal)`}
        strokeWidth="1.4"
      />
      <path d="M32 16v-5m-2 2h4" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="1.5" />
      <circle cx="32" cy="10" r="1.3" fill="#dab97d" />
    </g>
  );
}

export interface EmblemProps {
  civ: CivId;
  age?: number;
  size?: number;
}
function DaiVietMark({ id }: { id: string }) {
  return (
    <svg x="17" y="12" width="30" height="40" viewBox={DAI_VIET_DRAGON_FRAME.join(' ')}>
      <image
        href={DAI_VIET_DRAGON_FILE}
        width={DAI_VIET_DRAGON_SIZE}
        height={DAI_VIET_DRAGON_SIZE}
        filter={`url(#${id}-dragon-metal)`}
      />
    </svg>
  );
}

export function Emblem({ civ, age = 3, size = 64 }: EmblemProps) {
  const id = `emblem-${useId().replace(/:/g, '')}`;
  const era = Math.max(1, Math.min(3, age));
  const Mark = {
    roman: RomanMark,
    mongol: MongolMark,
    persian: PersianMark,
    tang: TangMark,
    ottoman: OttomanMark,
    daiviet: DaiVietMark,
  }[civ];
  return (
    <svg
      className={`regavo-icon regavo-emblem emblem-${civ} emblem-age-${era}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <Materials id={id} age={era} />
      <g filter={`url(#${id}-shadow)`}>
        <path
          d="M32 2 47 6 58 17l3 15-4 17-12 11-13 3-13-3L7 49 3 32l3-15L17 6Z"
          fill={`url(#${id}-${era === 1 ? 'wood' : 'metal'})`}
          stroke="#35281d"
          strokeWidth="1.2"
        />
        <path
          d="M32 7 45 11 53 20l3 12-4 14-10 9-10 3-10-3-10-9-4-14 3-12 8-9Z"
          fill={`url(#${id}-leather)`}
          stroke={era === 1 ? '#cfab76' : '#ead09a'}
          strokeWidth={era === 3 ? '1.6' : '.75'}
        />
        <path
          d="M32 10 43 13 50 21l3 11-3 12-9 8-9 3-9-3-9-8-3-12 3-11 7-8Z"
          fill={CIV_TINT[civ]}
          fillOpacity={era === 1 ? '.27' : '.62'}
        />
        {era === 1 ? (
          <g fill="none" stroke="#3e2a1d" strokeWidth=".8" opacity=".8">
            <path d="M8 19 6 31l3 14M11 12l3 4M51 13l-1 5M57 28l-3 9M20 58l2-6m19 7-2-5" />
            <path d="m18 10 3 2m24-2-3 2M10 45l3-2m38 3 3-2" stroke="#e0b781" />
          </g>
        ) : (
          <g fill="#e1c08a" stroke="#6d4d2c" strokeWidth=".7">
            {[16, 48].map((x) => (
              <g key={x}>
                <circle cx={x} cy="14" r="1.4" />
                <circle cx={x} cy="50" r="1.4" />
              </g>
            ))}
            <circle cx="7" cy="32" r="1.4" />
            <circle cx="57" cy="32" r="1.4" />
          </g>
        )}
        {era === 3 && (
          <g fill="none" stroke="#f2dba5" strokeWidth=".65" opacity=".8">
            <path d="M24 6 32 4l8 2M7 25l-2 7 2 7m50-14 2 7-2 7M24 59l8 2 8-2" />
            <path d="m32 4 0 4m-3-3 0 3m6-3 0 3m-7 51 0 2m8-2 0 2" />
          </g>
        )}
        <Mark id={id} />
      </g>
    </svg>
  );
}

function Food({ id }: { id: string }) {
  return (
    <g stroke="#593b26" strokeWidth=".7" strokeLinejoin="round">
      <path d="m19 27-7 11-3 1-2-3-3 1-1 3 3 3 5 1 3-4 9-10Z" fill="#d3c4a0" />
      <path
        d="M16 11c-8 1-11 7-9 13 3 7 10 10 16 6 6-3 10-10 6-15-3-5-8-6-13-4Z"
        fill={`url(#${id}-meat)`}
      />
      <path
        d="M12 15c5-4 10-2 13 1-5-1-6 3-11 5-3 1-5-2-2-6Z"
        fill="#deaa87"
        opacity=".75"
        stroke="none"
      />
      <path
        d="m33 8 1 24m-1-17-5-5-1-4 5 3m2 2 5-5 3-1-2 5-5 4m-2 7-5-5-1-3 5 2m3 1 5-4 3-1-3 5-5 3m-2 7-5-4-1-4 5 3m3 0 5-4 3-1-3 5-5 3"
        fill={`url(#${id}-metal)`}
        stroke="#ac8347"
        strokeWidth=".8"
      />
      <path
        d="M21 35c2-6 7-7 13-6s10 5 10 10c-1 5-5 5-13 5-6 0-12-2-10-9Z"
        fill={`url(#${id}-bread)`}
      />
      <path d="m27 32-2 7m8-7-2 7m8-5-2 6" fill="none" stroke="#f0dca3" strokeWidth="1.5" />
      <path d="M23 42c6 2 15 2 19-2" fill="none" stroke="#654127" />
    </g>
  );
}

function Wood({ id }: { id: string }) {
  return (
    <g stroke="#472f20" strokeWidth=".8" strokeLinejoin="round">
      <path d="m7 24 25-15 8 4-25 15Z" fill={`url(#${id}-wood)`} />
      <path d="m7 24 2 11 7 4 1-11Z" fill="#765030" />
      <path d="m17 28 23-15-1 11-23 15Z" fill="#986238" />
      <path d="m12 35 26-15 7 5-26 15Z" fill={`url(#${id}-wood)`} />
      <path d="m19 40 26-15v10L19 46Z" fill="#74502f" />
      <path d="m12 35 1 8 6 3v-6Z" fill="#c09663" />
      <path
        d="m10 24 23-13m-9 19 15-9m-17 16 15-9m-14 16 18-11"
        fill="none"
        stroke="#d5a66a"
        strokeWidth=".7"
      />
      <path d="m9 30 3 4 2-5m1 10 2 4" fill="none" stroke="#432c1c" />
      <path d="m21 18 3 3-1 10 6 5 1 7" fill="none" stroke="#b4a57b" strokeWidth="2.8" />
      <path d="m21 18 3 3-1 10 6 5 1 7" fill="none" stroke="#ded0a5" strokeWidth=".65" />
    </g>
  );
}

function Gold({ id }: { id: string }) {
  return (
    <g stroke="#70502e" strokeWidth=".8" strokeLinejoin="round">
      <path d="m9 33 5-8h22l5 8-4 8H12Z" fill={`url(#${id}-metal)`} />
      <path d="m14 25 5-6h13l4 6Z" fill="#e4c783" />
      <path d="m9 33 5-8 4 8 23 0m-23 0 0 8" fill="none" stroke="#f3df9f" strokeWidth=".8" />
      <path d="m26 16 3-5 9 1 5 9-5 9-13-3-3-7Z" fill={`url(#${id}-metal)`} />
      <path d="m29 11 3 9 11 1m-11-1-7 7m7-7 6 10" fill="none" stroke="#f1d795" strokeWidth="1.1" />
      <ellipse cx="12" cy="42" rx="7" ry="3" fill="#ab7d3e" />
      <ellipse cx="12" cy="40" rx="7" ry="3" fill={`url(#${id}-metal)`} />
      <ellipse cx="12" cy="40" rx="4.7" ry="1.9" fill="none" stroke="#f0d894" strokeWidth=".7" />
      <path d="m10 40 2-1 2 1-2 1Z" fill="#866030" stroke="none" />
    </g>
  );
}

function Stone({ id }: { id: string }) {
  return (
    <g stroke="#3f4840" strokeWidth=".7" strokeLinejoin="round">
      <path d="m7 29 7-12 17-3 11 12-3 13-21 4L5 38Z" fill={`url(#${id}-stone)`} />
      <path d="m14 17 9 8 8-11m-8 11 19 1-12 10-12 7-11-14Z" fill="#a7b09f" fillOpacity=".6" />
      <path d="m23 25 7 11 9 3 3-13m-24 17-3-9-8-5" fill="none" stroke="#5b655a" />
      <path
        d="m14 18 8 7 9-9m-24 14 10 3m16-6 6-1"
        fill="none"
        stroke="#d1d6c5"
        strokeWidth="1.1"
      />
      <path d="m31 10 5-4 7 5 2 8-6 5-9-5Z" fill={`url(#${id}-stone)`} />
      <path d="m36 6 2 9 7 4m-7-4-8 4" fill="none" stroke="#c0c8b6" />
    </g>
  );
}

function Population({ id }: { id: string }) {
  return (
    <g stroke="#433627" strokeWidth=".75">
      <path d="M24 41V31c0-5 4-8 10-8s11 3 11 8v10Z" fill={`url(#${id}-jade)`} />
      <ellipse cx="34" cy="17" rx="6" ry="8" fill={`url(#${id}-face)`} />
      <path d="M28 14c0-7 12-9 12 0l-3-3-7 1Z" fill="#514132" />
      <path d="M5 44V32c0-6 5-9 12-9s13 3 13 9v12Z" fill={`url(#${id}-wood)`} />
      <path d="m13 26 4 7 4-7m-4 7v10" fill="none" stroke="#d4bd8e" strokeWidth="1.1" />
      <ellipse cx="17" cy="17" rx="7" ry="9" fill={`url(#${id}-face)`} />
      <path d="M10 15c-1-10 14-12 14-1l-4-4-8 2Z" fill="#493b2b" />
      <path d="M10 18v5l7 5 7-5v-5l-3 5-4 1-4-1Z" fill="#725134" />
      <path d="m16 17-1 4 3 0" fill="none" stroke="#976947" strokeWidth=".65" />
    </g>
  );
}

export interface ResourceIconProps {
  type: Resource | 'population';
  size?: number;
}
export function ResourceIcon({ type, size = 32 }: ResourceIconProps) {
  const id = `resource-${useId().replace(/:/g, '')}`;
  const Drawing = { food: Food, wood: Wood, gold: Gold, stone: Stone, population: Population }[
    type
  ];
  return (
    <svg
      className={`regavo-icon resource-icon resource-icon-${type}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <Materials id={id} />
      <g filter={`url(#${id}-shadow)`}>
        <Drawing id={id} />
      </g>
    </svg>
  );
}

function CommandDrawing({ kind, id }: { kind: string; id: string }): ReactNode {
  const metal = `url(#${id}-metal)`;
  const wood = `url(#${id}-wood)`;
  const stone = `url(#${id}-stone)`;
  const outline = '#553b27';
  const highlight = '#edd09a';
  const group = (drawing: ReactNode) => (
    <g fill={metal} stroke={outline} strokeWidth=".85" strokeLinejoin="round" strokeLinecap="round">
      {drawing}
    </g>
  );
  switch (kind) {
    case 'attack':
      return group(
        <>
          <path d="m11 7 5 1 19 22-5 5L11 13Zm26 0-5 1-19 22 5 5 19-22Z" />
          <path d="m11 8 21 24M36 9 16 32" stroke={highlight} strokeWidth="1.3" />
          <path d="m26 28 10 11 4-4-10-11ZM22 28 12 39l-4-4 10-11Z" fill={wood} />
          <path d="m27 32 10-8M21 32l-10-8" strokeWidth="3" />
          <path d="m35 39 5 4 3-3-4-5M13 39l-5 4-3-3 4-5" />
        </>,
      );
    case 'stop':
      return group(
        <>
          <path d="M13 38 9 27c-2-5 2-7 4-3l2 4V13c0-4 5-4 5 0v8-12c0-4 5-4 5 0v12-10c0-4 5-4 5 0v11-7c0-4 5-4 5 0v15c0 5-3 9-6 11Z" />
          <path d="M17 29c4-4 10-2 12 1m-9-18v12m5-12v12m5-11v12" fill="none" stroke="#8c6539" />
          <path d="M12 37h19v7H12Z" fill={wood} />
          <path d="M15 39h14" stroke={highlight} />
        </>,
      );
    case 'hold':
      return group(
        <>
          <path d="M22 9h4v31h-4Zm-2 1 4-7 4 7-4 5Z" />
          <path d="M10 18 24 14l14 4-3 14-11 9-11-9Z" fill={wood} />
          <path d="m14 21 10-3 10 3-2 10-8 7-8-7Z" fill={metal} />
          <path d="M23 19h2v17h-2Z" fill="#745235" />
          <path d="M7 42h34v3H7Z" fill={stone} />
          <path d="m8 42 5-3m27 3-5-3" />
        </>,
      );
    case 'advance':
      return group(
        <>
          <path d="M6 40h9v-7h8v-7h9v-7h8v24H6Z" fill={stone} />
          <path d="m14 33 13-15-6-4 17-9-3 18-5-3-13 16Z" />
          <path d="m16 32 13-15-4-2 11-6" fill="none" stroke={highlight} />
          <path d="M8 40h8m8-7h8m1-7h7" stroke="#c6ccbb" />
        </>,
      );
    case 'shield':
      return group(
        <>
          <path d="M9 8 24 4l15 4v22l-5 9-10 6-10-6-5-9Z" />
          <path d="M13 11 24 8l11 3v18l-4 7-7 5-7-5-4-7Z" fill="#824b34" />
          <path d="M24 9v30M13 25h22" fill="none" stroke={highlight} strokeWidth="1.6" />
          <ellipse cx="24" cy="24" rx="5" ry="6" />
          <path d="M22 20c2-1 4 0 4 3" fill="none" stroke={highlight} />
        </>,
      );
    case 'deploy':
      return group(
        <>
          <path d="m12 37 6-13h4l-3 13m13 0-7-13h-4l6 13" fill={wood} />
          <path d="m13 22 23-11 5 9-24 9Z" />
          <ellipse cx="38" cy="15" rx="4" ry="6" transform="rotate(-25 38 15)" fill="#5b4430" />
          <ellipse cx="38" cy="15" rx="2" ry="3" transform="rotate(-25 38 15)" fill="#27241c" />
          <path d="m16 23 19-9" fill="none" stroke={highlight} strokeWidth="1.3" />
          <circle cx="18" cy="32" r="6" fill={wood} />
          <circle cx="18" cy="32" r="2" />
          <path
            d="M6 43h36M8 38v5m32-5v5m-31-3 4 3m26-3-4 3"
            fill="none"
            stroke={metal}
            strokeWidth="2"
          />
        </>,
      );
    case 'pack':
      return group(
        <>
          <path d="m7 20 17-8 17 8v19l-17 8-17-8Z" fill={wood} />
          <path d="m7 20 17 8 17-8m-17 8v19" fill="none" stroke="#d0a66c" strokeWidth="1.1" />
          <path d="m16 16 17 8v19m-2-28-17 9v19" fill="none" stroke={metal} strokeWidth="3.2" />
          <path d="M19 10V5h10v5M18 9h12" fill="none" stroke={metal} strokeWidth="2.5" />
          <path d="m18 30 6 3 6-3-2 7-4 4-4-4Z" />
        </>,
      );
    case 'close':
      return group(
        <>
          <path d="m10 6 6 3 9 12 13-14 5 5-14 13 13 15-5 4-13-15L9 43l-5-5 15-13L7 12Z" />
          <path d="m11 10 26 30m-1-29-26 27" fill="none" stroke={highlight} strokeWidth="1.4" />
        </>,
      );
    case 'menu':
      return group(
        <>
          <path d="M11 7h26v30c0 5-4 7-9 7H8l5-7V13Z" fill="#c3b18b" />
          <path d="M11 7c-8-1-9 9-3 9h7V9m22 28H13c-7 0-7 8 0 8h15c7 0 10-3 9-8Z" />
          <path d="M19 16h11m-13 6h15m-15 6h13" fill="none" stroke="#6a5536" strokeWidth="2" />
          <path d="m13 8 20 0" fill="none" stroke="#eee0b4" />
        </>,
      );
    case 'pause':
      return group(
        <>
          <path d="M9 10h9v28H9Zm21 0h9v28h-9Z" />
          <path d="M7 7h13v5H7Zm21 0h13v5H28ZM7 37h13v5H7Zm21 0h13v5H28Z" fill={stone} />
          <path d="M12 14v20m21-20v20" fill="none" stroke={highlight} strokeWidth="1.5" />
        </>,
      );
    case 'play':
      return group(
        <>
          <path d="M12 7 40 24 12 41Z" />
          <path d="m16 12 19 12-19 12Z" fill="#a77d42" />
          <path d="M14 12v24m0-25 22 13" fill="none" stroke={highlight} strokeWidth="1.3" />
        </>,
      );
    case 'help':
      return group(
        <>
          <path d="M24 4c12 0 20 8 20 20s-8 20-20 20S4 36 4 24 12 4 24 4Z" fill={wood} />
          <path
            d="M24 7c10 0 17 7 17 17s-7 17-17 17S7 34 7 24 14 7 24 7Z"
            fill="none"
            stroke={metal}
            strokeWidth="1.8"
          />
          <path d="M16 19c0-9 16-10 16-1 0 5-6 6-6 11h-5c0-7 6-7 6-11 0-3-6-3-6 1Z" />
          <circle cx="23.5" cy="35" r="2.7" />
        </>,
      );
    case 'speed':
      return group(
        <>
          <path d="m8 10 16 14L8 38l2-14Zm18 0 16 14-16 14 2-14Z" />
          <path
            d="m11 14 11 10-11 10m18-20 11 10-11 10"
            fill="none"
            stroke={highlight}
            strokeWidth="1.2"
          />
          <path d="M4 20h5m-5 8h5m10 15h12" fill="none" stroke={metal} strokeWidth="1.2" />
        </>,
      );
    default:
      return group(
        <>
          <path d="M12 9h24v30H12Z" fill={wood} />
          <path d="M10 7h28v6H10Zm0 29h28v6H10Z" />
          <path d="m17 18 7-4 7 4v12l-7 5-7-5Z" />
          <path d="m20 22 4-3 4 3-4 7Z" fill="#6b5131" />
        </>,
      );
  }
}

export interface CommandIconProps {
  kind: string;
  size?: number;
}
export function CommandIcon({ kind, size = 24 }: CommandIconProps) {
  const id = `command-${useId().replace(/:/g, '')}`;
  return (
    <svg
      className={`regavo-icon command-icon command-icon-${kind}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <Materials id={id} age={2} />
      <g filter={`url(#${id}-shadow)`}>
        <CommandDrawing kind={kind} id={id} />
      </g>
    </svg>
  );
}
