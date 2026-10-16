export function JourneyArt({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 560 400"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="sky"
          x1="280"
          y1="0"
          x2="280"
          y2="400"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#dce7d6" />
          <stop offset="1" stopColor="#f3eddb" />
        </linearGradient>
        <linearGradient id="hill" x1="0" y1="200" x2="500" y2="400">
          <stop stopColor="#7a9d7b" />
          <stop offset="1" stopColor="#436f57" />
        </linearGradient>
      </defs>
      <rect x="16" y="15" width="528" height="368" rx="160" fill="url(#sky)" />
      <circle cx="366" cy="100" r="46" fill="#f5d996" />
      <path
        d="m0 280 111-141 86 100L305 105l126 168 64-88 65 103v112H0Z"
        fill="#b3c4a2"
      />
      <path d="m0 313 100-73 102 62 126-104 232 120v82H0Z" fill="#8ba889" />
      <path d="M0 340q140-130 285-32t275-20v112H0Z" fill="url(#hill)" />
      <path
        d="M122 400q-5-38 111-55t95-51q-15-17-60-19t-9-33q28-16 50-23"
        stroke="#e8d8af"
        strokeWidth="23"
      />
      <path
        d="M122 400q-5-38 111-55t95-51q-15-17-60-19t-9-33q28-16 50-23"
        stroke="#f4e9cb"
        strokeWidth="13"
      />
      <g fill="#28543f">
        <path d="m80 290 21-66 21 66Zm-9 24 30-61 30 61Z" />
        <rect x="98" y="299" width="6" height="33" />
        <path d="m426 307 25-79 25 79Zm-11 29 36-75 36 75Z" />
        <rect x="447" y="320" width="7" height="40" />
        <path d="m45 358 15-46 15 46Z" />
      </g>
      <g transform="translate(280 153)">
        <path d="M0 54V0" stroke="#8f7145" strokeWidth="4" />
        <path d="M2 2h42L34 17l10 15H2Z" fill="#deb85c" />
        <path
          d="m13 16 5 5 10-11"
          stroke="#fff9df"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g fill="#f6eed6">
        <circle cx="59" cy="92" r="3" />
        <circle cx="468" cy="135" r="3" />
        <path d="m175 75 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" />
      </g>
      <path
        d="M98 106q10-12 20 0 10-12 20 0M416 73q7-8 14 0 7-8 14 0"
        stroke="#7e9c82"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
