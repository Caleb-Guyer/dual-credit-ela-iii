import type { Chapter } from './data';
export default function Art({ chapter }: { chapter: Chapter }) {
  const color =
    chapter === 9 ? '#b89360' : chapter === 10 ? '#6e957c' : chapter === 11 ? '#7ba6bf' : '#9889af';
  return (
    <svg
      viewBox="0 0 700 460"
      preserveAspectRatio="xMidYMid slice"
      className="dn-art course-art"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`df-${chapter}`} x2="0" y2="1">
          <stop stopColor="#192d39" />
          <stop offset="1" stopColor={color} />
        </linearGradient>
      </defs>
      <path d="M0 0h700v460H0z" fill={`url(#df-${chapter})`} />
      <circle cx="475" cy="108" r="48" fill="#f3d9a5" />
      <path d="M0 255q150-75 270-10t430-38v253H0z" fill="#34534f" />
      {chapter <= 10 ? (
        <>
          <path d="M64 261h154v112H64z" fill="#92765c" />
          <path d="m42 264 98-85 100 85z" fill="#263d40" />
          <path d="M112 299h50v75h-50z" fill="#203438" />
          {[30, 620, 665].map((x) => (
            <g key={x}>
              <path d={`M${x} 175v280`} stroke="#253b3a" strokeWidth="16" />
              <path d={`M${x} 70l-59 180h118z`} fill="#426352" />
            </g>
          ))}
          <path d="M220 365 425 236 610 460H280z" fill="#a58a67" />
          {chapter === 10 && (
            <>
              <path d="M480 276h100v110H480z" fill="#6b806f" />
              <path d="M492 305h78m-78 21h52" stroke="#e4daba" strokeWidth="5" />
            </>
          )}
        </>
      ) : chapter === 11 ? (
        <>
          <path d="M0 270h700v190H0z" fill="#386b7d" />
          <path d="m57 296 158-4-25 35H79z" fill="#233b43" />
          <path d="M137 156v143m5-123v99h82z" stroke="#d9ccae" fill="#d9ccae" strokeWidth="4" />
          <path d="M450 258h98v105h-98zM552 222h113v156H552z" fill="#6d786e" />
          <path d="M472 282h19v27h-19zM610 250h21v34h-21z" fill="#f2d097" />
          <path d="M0 400 700 350v110H0z" fill="#273c43" />
        </>
      ) : (
        <>
          <path
            d="M102 195v205m-15-205h30v38H87z"
            stroke="#bfa984"
            strokeWidth="7"
            fill="#e4c895"
          />
          <path
            d="M515 205v185m-18-185h36v42h-36z"
            stroke="#bfa984"
            strokeWidth="7"
            fill="#e4c895"
          />
          <path d="M0 400h700v60H0z" fill="#293747" />
          <path d="M440 355h110v45H440zM454 341h82v15h-82z" fill="#876b54" />
          {[235, 285, 330, 390, 430, 480].map((x, i) => (
            <circle key={x} cx={x} cy={160 + (i % 3) * 30} r="2" fill="#efdab1" />
          ))}
        </>
      )}
      <path d="M276 355q68-52 138 0l31 105H248z" fill="#182c35" />
      <path d="M325 310h48v50h-48z" fill="#956c4e" />
      <ellipse cx="349" cy="285" rx="35" ry="42" fill="#a67b57" />
      <path d="M313 288q-19-71 39-59 44-10 37 54l-23-22-23 11-20-5z" fill="#172a32" />
      <path d="m321 341 27 31 29-31-18 77h-20z" fill="#e0d1b1" />
      <path d="M355 308h13" stroke="#513c32" strokeWidth="3" />
      <path d="M0 451h700v9H0z" fill="#12232b" />
    </svg>
  );
}
