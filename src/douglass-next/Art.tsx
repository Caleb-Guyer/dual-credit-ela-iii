import type { Chapter } from './data';
export default function ChapterArt({ chapter }: { chapter: Chapter }) {
  const colors = {
    4: ['#708b83', '#c3b995'],
    5: ['#6e99ae', '#e6bf82'],
    6: ['#937d70', '#e9c797'],
    7: ['#718fa6', '#a9c8cf'],
    8: ['#7b7690', '#cbb9ae'],
  }[chapter];
  return (
    <svg
      viewBox="0 0 700 460"
      preserveAspectRatio="xMidYMid slice"
      className="dn-art"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`dn-sky-${chapter}`} x2="0" y2="1">
          <stop stopColor={colors[0]} />
          <stop offset="1" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <path d="M0 0h700v460H0z" fill={`url(#dn-sky-${chapter})`} />
      <circle cx="465" cy="100" r="45" fill="#ffe9b7" opacity=".8" />
      {chapter === 4 || chapter === 8 ? (
        <>
          <path d="M0 240q140-80 270 0t430-40v260H0z" fill="#435f58" />
          <path
            d="M320 230q-130 110 45 230H160q50-120 160-230"
            fill={chapter === 4 ? '#b5c8c0' : '#b3a493'}
          />
          {[40, 120, 200, 560, 650].map((x, i) => (
            <g key={x}>
              <path d={`M${x} 160v300`} stroke="#3b4b44" strokeWidth="13" />
              <path
                d={`M${x} ${35 + (i % 2) * 65}l-58 200h116z`}
                fill={i % 2 ? '#536e5d' : '#304f47'}
              />
            </g>
          ))}
          {chapter === 8 && (
            <>
              <path d="M340 250h160v115H340z" fill="#86786b" />
              <path d="m323 253 94-69 104 69z" fill="#444f4e" />
              <path d="M400 284h42v81h-42z" fill="#303e3d" />
            </>
          )}
        </>
      ) : chapter === 5 ? (
        <>
          <path d="M0 240h700v220H0z" fill="#427c8c" />
          {[280, 320, 380, 425].map((y) => (
            <path
              key={y}
              d={`M0 ${y}q80-17 150 0t160 0 180 0 210 0`}
              stroke="#90b6b6"
              fill="none"
              opacity=".7"
            />
          ))}
          <path d="m205 322 330-6-51 51H260z" fill="#384b50" />
          <path d="M356 91v235" stroke="#4a5551" strokeWidth="7" />
          <path d="M362 102v184h143zM343 110v176H222z" fill="#e6d6b4" />
        </>
      ) : (
        <>
          <path d="M0 280h700v180H0z" fill="#a7957c" />
          <path d="m305 263-80 197h280l-95-197" fill="#cbbb9b" />
          {[0, 125, 485, 600].map((x, i) => (
            <g key={x}>
              <path
                d={`M${x} ${90 + (i % 2) * 40}h108v310H${x}z`}
                fill={i % 2 ? '#8a7d72' : '#b09a80'}
              />
              {[160, 235, 310].map((y) => (
                <path
                  key={y}
                  d={`M${x + 20} ${y}h22v37h-22zM${x + 66} ${y}h22v37h-22z`}
                  fill="#3e5963"
                />
              ))}
            </g>
          ))}
          {chapter === 6 && (
            <>
              <path d="M245 217h208v24H245zM266 241h12v92h-12zM424 241h12v92h-12z" fill="#66594a" />
              <text
                x="348"
                y="205"
                fill="#fff1ce"
                textAnchor="middle"
                fontFamily="Georgia"
                fontSize="65"
              >
                A B C
              </text>
            </>
          )}
          {chapter === 7 && (
            <>
              <path d="M269 359h192v15H269z" fill="#775e43" />
              <text
                x="363"
                y="351"
                textAnchor="middle"
                fill="#f5e9c7"
                fontSize="35"
                fontFamily="Georgia"
              >
                L · S · F · A
              </text>
            </>
          )}
        </>
      )}
      <path d="M0 420q350-40 700 0v40H0z" fill="#182d32" opacity=".45" />
    </svg>
  );
}
export function NextDouglassArt() {
  return <ChapterArt chapter={7} />;
}
