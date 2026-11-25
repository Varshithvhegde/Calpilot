export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        <linearGradient id="calpilot-body" x1="12" y1="12" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B56EE" />
          <stop offset="100%" stopColor="#2336C8" />
        </linearGradient>
        <linearGradient id="calpilot-ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4A64F5" />
          <stop offset="100%" stopColor="#DCE3FF" />
        </linearGradient>
        <clipPath id="calpilot-inner-clip">
          <rect x="14" y="21" width="36" height="29" rx="7" />
        </clipPath>
      </defs>

      {/* Outer calendar body */}
      <rect x="6" y="11" width="52" height="47" rx="14" fill="url(#calpilot-body)" />

      {/* Top calendar rings */}
      <rect x="19" y="5" width="7" height="14" rx="3.5" fill="url(#calpilot-ring)" />
      <rect x="38" y="5" width="7" height="14" rx="3.5" fill="url(#calpilot-ring)" />

      {/* Inner multi-color Google Calendar inspired frame */}
      <g clipPath="url(#calpilot-inner-clip)">
        <rect x="14" y="21" width="36" height="29" fill="#EEF1FA" />
        {/* Top-left blue */}
        <rect x="14" y="21" width="24" height="9" fill="#1A85F0" />
        {/* Top-right red */}
        <rect x="38" y="21" width="12" height="10" fill="#EA4335" />
        {/* Mid-right yellow */}
        <rect x="38" y="31" width="12" height="10" fill="#FBBC04" />
        {/* Bottom-right green */}
        <rect x="34" y="41" width="16" height="9" fill="#22A957" />
        {/* Center white rounded card */}
        <rect x="20" y="26" width="24" height="19" rx="5" fill="#FFFFFF" />
      </g>

      {/* 4-point cobalt sparkle */}
      <path
        d="M32 29.5C32.55 33.05 33.45 33.95 37 34.5C33.45 35.05 32.55 35.95 32 39.5C31.45 35.95 30.55 35.05 27 34.5C30.55 33.95 31.45 33.05 32 29.5Z"
        fill="#2F4BDB"
      />
    </svg>
  );
}
