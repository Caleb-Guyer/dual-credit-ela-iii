export default function ConcordArt() {
  return (
    <svg
      className="course-art"
      viewBox="0 0 700 460"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="concord-sky" x2="0" y2="1">
          <stop stopColor="#172c42" />
          <stop offset="1" stopColor="#769088" />
        </linearGradient>
        <radialGradient id="concord-moon">
          <stop stopColor="#f1ddb0" stopOpacity=".3" />
          <stop offset="1" stopColor="#f1ddb0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="concord-road" x2="0" y2="1">
          <stop stopColor="#66817a" />
          <stop offset="1" stopColor="#233d45" />
        </linearGradient>
      </defs>
      <path fill="url(#concord-sky)" d="M0 0h700v460H0z" />
      <circle cx="450" cy="107" r="105" fill="url(#concord-moon)" />
      <circle cx="450" cy="107" r="31" fill="#e9d8b3" />
      {[22, 70, 129, 190, 258, 320, 381, 533, 602, 658].map((x, i) => (
        <circle key={x} cx={x} cy={29 + (i % 3) * 27} r="1" fill="#c8d9d1" opacity=".7" />
      ))}
      <path d="M0 250q110-59 245-12t251-6 204 15v213H0z" fill="#294650" />
      <path d="M279 267h131l176 193H93z" fill="url(#concord-road)" />
      <path d="M0 222l87-63 85 63v161H0z" fill="#465c5b" />
      <path d="M0 223l87-76 98 76-9 12-89-64-85 65z" fill="#142a38" />
      <path d="M127 246l56-44 57 44v100H127z" fill="#354e54" />
      <path d="M122 250l61-53 65 51-6 8-60-40-56 43z" fill="#1b303b" />
      <path d="M494 229l92-70 114 68v169H494z" fill="#485e59" />
      <path d="M485 232l101-86 114 75v22l-114-75-94 75z" fill="#142c37" />
      <path d="M410 250l48-35 49 36v88h-97z" fill="#354c50" />
      {[38, 103, 525, 609, 665].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 252h23v34h-23z`} fill="#e3b774" />
          <path d={`M${x + 11} 252v34m-11-17h23`} stroke="#3d4e4b" strokeWidth="3" />
          <path d={`M${x - 8} 248h39`} stroke="#283e43" strokeWidth="4" />
          {i % 2 === 0 && <path d={`M${x} 306h23v27h-23z`} fill="#b69363" />}
        </g>
      ))}
      <path d="M164 272h17v25h-17zM199 272h17v25h-17zM438 264h20v24h-20z" fill="#c9ae77" />
      <path d="M303 264v-63h10v63m-16-58h23l-12-28z" fill="#263e47" />
      <path d="M286 264h44v13h-44z" fill="#19333e" />
      <path d="M227 330v-90m-11-4h23v31h-23z" stroke="#162e39" strokeWidth="6" />
      <path d="M222 242h12v19h-12z" fill="#f6d090" />
      <path d="M458 354V249m-12-4h24v34h-24z" stroke="#172f3b" strokeWidth="6" />
      <path d="M451 252h14v21h-14z" fill="#f6cf87" />
      <ellipse cx="226" cy="333" rx="44" ry="12" fill="#d0b677" opacity=".12" />
      <ellipse cx="458" cy="354" rx="47" ry="13" fill="#d0b677" opacity=".14" />
      <path d="M355 341v-28m-10 29-8 45h36l-8-45z" fill="#1c3540" />
      <circle cx="355" cy="306" r="9" fill="#c6b28d" />
      <path d="M345 303q-2-16 12-13 11 1 9 15l-8-8z" fill="#162d37" />
      <path d="M345 385l-4 32m24-32 5 32" stroke="#132b36" strokeWidth="9" />
      <path d="M0 421q177-17 296 3t404-2v38H0z" fill="#19323b" opacity=".65" />
    </svg>
  );
}
