/** Original pen contours, cut shadows, and restrained gouache washes for the opening page. */
export default function Frontispiece({ className = 'cn-frontispiece' }: { className?: string }) {
  const windows = (x: number, y: number, rows: number, cols: number, gap = 48) =>
    Array.from({ length: rows * cols }, (_, i) => {
      const xx = x + (i % cols) * gap + [0, 1.2, -0.8, 0.5][i % 4],
        yy = y + Math.floor(i / cols) * 62 + [0, -0.7, 0.4][i % 3];
      return (
        <g key={i} stroke="#343e36" strokeWidth="1.5">
          <path d={`M${xx - 2} ${yy - 2}l24-1 1 32-25 1z`} fill={i % 3 ? '#d3bf87' : '#a8afa0'} />
          <path d={`M${xx + 10} ${yy}v29m-10-15h22m-27-18-3 36m32-37 2 36`} fill="none" />
          <path d={`M${xx - 6} ${yy + 33}l34-1`} strokeWidth="2" />
          <path
            d={`M${xx - 6} ${yy}l-6 1 1 30 6 1m29-33 7-1-1 33-7 1`}
            fill="#6a7b61"
            strokeWidth="1"
          />
          <path d={`M${xx - 9} ${yy + 6}l.5 20m37-21-.5 22`} strokeWidth=".65" />
        </g>
      );
    });
  return (
    <svg
      className={className}
      viewBox={className === 'course-art' ? '340 200 860 600' : '-140 0 1200 850'}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <pattern
          id="concord-ink-hatch"
          width="9"
          height="9"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-24)"
        >
          <path d="M1 0v9" stroke="#344239" strokeWidth=".65" opacity=".48" />
        </pattern>
        <pattern id="concord-slate-hatch" width="21" height="13" patternUnits="userSpaceOnUse">
          <path d="M0 12h21M6 0v12m11 0v13" stroke="#ded7be" strokeWidth=".7" opacity=".35" />
        </pattern>
        <pattern id="concord-cross-cut" width="13" height="13" patternUnits="userSpaceOnUse">
          <path
            d="M-3 13 13-3M1 16 16 1M-2 3 12 17M4-2 17 11"
            stroke="#304535"
            strokeWidth=".75"
            opacity=".55"
          />
        </pattern>
        <radialGradient id="concord-lamp-wash">
          <stop stopColor="#d5bc7b" stopOpacity=".36" />
          <stop offset=".5" stopColor="#cbb47a" stopOpacity=".1" />
          <stop offset="1" stopColor="#cbb47a" stopOpacity="0" />
        </radialGradient>
        <filter id="concord-paper-grain">
          <feTurbulence baseFrequency=".58" numOctaves="3" seed="8" type="fractalNoise" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope=".07" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
      </defs>
      <g opacity=".75" stroke="#748071" strokeWidth="1">
        <path d="M465 437q34-86 79-58 23-71 70-32 49-101 103-59 55-34 99 33 50-58 95-5 66-32 103 31 54-20 89 35 55-14 97 40" />
        <path
          d="M522 409l7-16m18 9 9-20m28 6 8-23m22 6 7-14m32 1 7-21m26-5 9-17m33 5 5-17m30 4 6-18m26 22 7-10m33 23 8-17m31 34 9-20m31 28 7-12m33 31 6-16m34 29 9-11"
          strokeWidth=".8"
        />
        <path
          d="M620 266q24-6 42-3m-9-13q32-3 54-1m224 21 33-4m-20 14 66-2m-27-12 51 1"
          opacity=".35"
        />
      </g>
      <circle cx="862" cy="190" r="47" fill="#d5ccb2" stroke="#899181" strokeWidth="1" />
      <path d="M862 148q-26 14-27 43t27 41" stroke="#b4b49e" strokeWidth=".8" />
      <path
        d="M844 171l-5 9m2 29 7 9m34-56 8 5m-5 43-8 5m18-27 2-8m-43-3q8-9 14-4m10 17q6 3 10-1"
        stroke="#adb197"
        strokeWidth=".7"
      />
      <g stroke="#303e35" strokeLinejoin="round">
        <path d="M486 472l73-61 77 61v135l-150 37z" fill="#c7cbb9" strokeWidth="2" />
        <path d="M477 472l82-72 87 72-9 10-78-61-77 62z" fill="#697969" strokeWidth="2" />
        <path d="M481 473l77-66 84 66-1 7-83-60-75 62" fill="url(#concord-ink-hatch)" />
        {windows(511, 486, 2, 2, 50)}
        <path d="M548 564l24-3 2 55-27 8z" fill="#68766a" />
        <path
          d="M552 568l16-2 1 46-17 5m-1-30 18-3m-18 19 18-4m-8-32 1 48"
          stroke="#a9b396"
          strokeWidth=".9"
        />
        <path
          d="M488 482l146-1m-145 12 146-2m-146 14 147-3m-146 15 146-4m-145 17 145-6m-145 18 146-8m-145 21 145-11m-144 23 144-14m-144 26 145-17m-145 29 145-21"
          stroke="#8b997e"
          strokeWidth=".75"
          opacity=".6"
        />
        <path d="M508 465v-31h18v15" fill="#a47c64" strokeWidth="2" />
        <path d="M915 417l91-49 120 47 22 282-233-65z" fill="#d5d3b9" strokeWidth="2" />
        <path d="M899 417l105-62 134 58-6 15-126-52-99 55z" fill="#5b6e63" strokeWidth="2" />
        <path d="M905 416l101-52 124 53-3 8-122-47-99 52" fill="url(#concord-slate-hatch)" />
        <path
          d="M909 430l97-48 124 48-2 9-122-44-96 47z"
          fill="url(#concord-cross-cut)"
          stroke="none"
        />
        {windows(938, 443, 2, 3, 51)}
        <path d="M983 554l42 2 5 105-45-12z" fill="#67776a" strokeWidth="2" />
        <path d="M993 559l23 1 4 92-26-6zM1004 560l2 89" stroke="#bbbfa8" />
        <path d="M980 551l51 3 7 9-61-5zM984 559l1 89m42-86 2 99" fill="#627657" strokeWidth="2" />
        <path d="M982 651l55 16m-63-9 69 21m-77-12 85 25" strokeWidth="1.1" />
        {Array.from({ length: 13 }, (_, i) => (
          <path
            key={i}
            d={`M918 ${435 + i * 16}l${211 + i * 1.4} ${i * 0.6}`}
            stroke="#9da58f"
            strokeWidth=".8"
          />
        ))}
        <path d="M1057 374v-49l25 4 2 58" fill="#a67860" strokeWidth="2" />
        <path d="M1052 325l35 3 1 7-36-3z" fill="#6b6c5b" />
        <path
          d="M1062 339l18 2m-18 6 18 2m-17 6 18 2m-17 7 18 2m-13-25v7m7 3v7m-11 4v7m11 2v8"
          stroke="#6c6b50"
          strokeWidth=".7"
        />
        <path d="M1092 424l108-41v403l-72-66z" fill="#a9b6a0" strokeWidth="2" />
        <path d="M1082 426l118-58v20l-111 49z" fill="#4d6458" strokeWidth="3" />
        <path d="M1103 445l97-42v336l-64-40z" fill="url(#concord-ink-hatch)" stroke="none" />
        <path d="M662 427l46-42 54 42v111l-100 22z" fill="#c3c8b2" strokeWidth="1.7" />
        <path d="M655 428l53-51 60 50-8 7-52-43-48 45z" fill="#6c7b6a" strokeWidth="2" />
        <path d="M700 391v-74h15v74m-23-72 16-39 16 39z" fill="#b3baa5" strokeWidth="1.8" />
        <path d="M703 329h9v16h-9zM685 452h18v25h-18zM727 451h18v25h-18z" fill="#787f6c" />
        <path d="M700 497h20v52h-20z" fill="#687365" />
        <path d="M771 456l52-26 65 31 5 101-121-21z" fill="#a3b09a" strokeWidth="1.7" />
        <path d="M766 454l57-34 72 38-6 7-66-33-52 29z" fill="#5e7465" />
        {windows(786, 472, 1, 2, 47)}
      </g>
      <path
        d="M579 602q106-64 151-57 78 3 163 46l307 222-23 37H411q68-160 168-248Z"
        fill="#d5ceb5"
      />
      <path
        d="M424 850q112-173 219-252 54-39 89-45-57 18-103 60-91 83-160 237Z"
        fill="#b5bda0"
        opacity=".38"
      />
      <path
        d="M848 578q45 31 95 69l257 187-10 16h-45L922 653q-46-50-74-75Z"
        fill="#aab69a"
        opacity=".25"
      />
      <g stroke="#82917d" strokeWidth="1" opacity=".8">
        <path
          d="M507 810q79-125 171-208 34-30 61-44m-182 260q60-113 140-211m161 207q-21-87-84-202m181 205q-76-109-174-221"
          opacity=".65"
        />
        <path d="M518 744l21-5m-11 10 26-5m33-54 17-3m-23 9 29-5m-1 62 27-4m-10 9 20-3m8-87 19-3m-10 8 27-3m12-52 15-2m-1 6 17-1m42 56 22 4m-16 2 20 3m49 55 28 7m-25-2 21 6m46 23 32 7m-18 1 32 9m-29 46 25 3m-106-17 18 1m-175 11 25-2m-4 6 34-2m-24-57 16-2m65 16 23 1" />
        <path
          d="M708 578l13-2m-28 19 15-4m35-7 12-1m22 9 15 2m-23 14 15 1m32 15 18 4"
          strokeWidth=".7"
        />
      </g>
      <g stroke="#3a493c" strokeWidth="2">
        <path d="M410 847q18-144 45-234 26-110 45-157 30-79 21-163" strokeWidth="14" />
        <path
          d="M442 665q-31-72-27-121m62-62q-52-49-65-103m82 62q54-57 66-122m-47 63q-24-101-62-147m69 120q32-56 21-138"
          strokeWidth="5"
        />
        <path
          d="M421 548l-36-35m74-198-39-17m137 34 33-23m-74-73-2-46m-10 168 43-20"
          strokeWidth="2.6"
        />
        <path
          d="M432 797l16-60m-8 87 22-77m-12 5 9-39m9-73 11-61m-9 48 17-66m10-47 7-40m4-30 8-51m-9 11 10-46"
          stroke="#b8c09e"
          strokeWidth="1.1"
        />
        <path d="M467 682q12-14 8-29-5-6-10 7-4 13 2 22m1-9q5-9 3-15m-8-66 7-23" strokeWidth=".9" />
      </g>
      <g
        transform="translate(48 0)"
        fill="#99a37d"
        stroke="#627754"
        strokeWidth="1"
        strokeLinejoin="round"
      >
        <path d="M412 402q-19-7-23-24-18-1-20-16 4-19 23-17-7-21 12-27 15-4 23 10 9-17 25-8 12 7 8 22 20-3 25 14 2 16-16 21 1 16-17 20-10 3-21-5-6 17-19 10Z" />
        <path
          d="M454 293q-20-3-24-19-17 5-22-11-4-17 14-23-2-17 14-23 16-5 24 12 10-19 25-11 11 6 10 21 18-9 27 8 7 14-9 24 5 16-12 23-14 6-22-4-12 13-25 3Z"
          fill="#a7ad87"
        />
        <path
          d="M500 343q-9-16 0-27-12-15 1-26 12-10 23 2 5-19 22-17 15 1 18 17 17-8 25 8 7 14-7 24 11 13-1 24-14 10-26 0-6 14-22 10-10-2-12-14-16 8-21-1Z"
          fill="#8f9c76"
        />
        <path
          d="M550 289q-15-9-8-23-12-9-5-22 10-14 23-6 8-19 23-11 11 6 9 20 19-4 21 14 1 14-14 18-8 16-23 8-14 11-26 2Z"
          fill="#9eaa82"
        />
        <path
          d="M551 390q-18-8-10-24-16-7-10-21 7-15 22-8 6-19 23-12 13 5 10 20 17-3 21 12 5 16-13 23-2 15-17 17-14 0-19-12Z"
          fill="#8b9972"
        />
        <path
          d="M401 473q-15-11-8-25-13-9-4-21 10-13 23-5 7-14 20-8 17 6 11 22 17 2 17 16-1 16-18 16-6 15-21 10-9-3-10-12Z"
          fill="#9ca57e"
        />
        <path
          d="M385 359q15-2 25 13m-4-40 6 17m15-13q-9 15-4 30m8-2 15-14m-6 26 17-6m-46 8 13 8M433 250q17 1 24 16m-17-33 4 11m22-9-3 19m13-17 9 6m-10 20 19-3m-39 15 12 7M518 316l12 11m-7-25 9 8m11-24-4 22m15-9 11 4m-4 17 12 3m-38 17 11 6M552 261l12 6m-6-17 9 2m15-8-4 16m10 8 9-6m-41 12 12 3M551 349l13 11m-3-24 4 12m15-10-6 16m9 16 13-5m-37 16 14 5M402 441l13 10m-2-24 4 10m16 1-8 17m14 8 10-9"
          fill="none"
          stroke="#586f4d"
          strokeWidth=".85"
        />
      </g>
      <ellipse cx="970" cy="526" rx="84" ry="105" fill="url(#concord-lamp-wash)" />
      <g stroke="#344539" strokeWidth="2">
        <path d="M973 728l-6-226m-18-3 34-2 4 53-34 3z" fill="#3e5143" />
        <path d="M957 505l20-2 3 42-21 3z" fill="#d3b471" />
        <path d="M944 500l20-22 24 17z" fill="#53644e" />
        <path d="M958 548l22-2" />
        <path d="M961 509l2 30m7-32 1 31" stroke="#9b804b" strokeWidth=".8" />
      </g>
      <g stroke="#2f4035" fill="#445847" strokeWidth="2">
        <path d="M773 641q-9-17 3-26 16-8 22 7l-1 5 5 5-6 3-1 11-13 1Z" fill="#b6a282" />
        <path d="M766 620l-3-7 12-4-1-12 23-1 3 15 9 2-2 6z" />
        <path d="M774 644l-13 15-14 74 57 2-11-80-10-11z" />
        <path d="M766 735l-3 43-14 4m38-47 3 42 13 3" fill="none" strokeWidth="7" />
        <path d="M765 659l-18 39m43-39 14 25 12-5" fill="none" strokeWidth="7" />
        <path d="M779 651l-6 64m15-62 9 69" stroke="#829077" strokeWidth="1.2" />
        <path d="M779 647l6 8 6-5-5-4Z" fill="#d6d0b0" strokeWidth=".8" />
        <path
          d="M770 674l-8 35m24-36-1 24m-21 28 17-3m3 6 14 2M780 663v2m-1 13v2m-2 13v2"
          stroke="#a5b08f"
          strokeWidth=".85"
        />
        <path d="M806 678l14-7 4 24-14 5Z" fill="#d2c7a5" strokeWidth=".9" />
        <path
          d="M810 680l8-4m-8 9 9-4m-8 9 8-4M753 783l15-1m23-1 13 1"
          stroke="#8f9b7b"
          strokeWidth=".7"
        />
      </g>
      <g stroke="#71836c" opacity=".5">
        {Array.from({ length: 24 }, (_, i) => (
          <path key={i} d={`M${435 + i * 30} ${817 + (i % 3) * 5}l${15 + (i % 4) * 8} -3`} />
        ))}
      </g>
      <path d="M0 0h1200v850H0z" filter="url(#concord-paper-grain)" opacity=".32" />
    </svg>
  );
}
