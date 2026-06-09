// Ícones SVG inline (stroke), coerentes com o tema. Params opcionais.
type P = { className?: string };
const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const IconGrid = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
  </svg>
);

export const IconPulse = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M2 12h4l2.5-6 4 13L15 9l2 3h5" />
  </svg>
);

export const IconTarget = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconChart = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="M7 14l3.5-4 3 2.5L20 6" />
  </svg>
);

export const IconSparkChat = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M21 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.4A8 8 0 1 1 21 11.5Z" />
    <path d="M12 8l.9 2.1L15 11l-2.1.9L12 14l-.9-2.1L9 11l2.1-.9Z" />
  </svg>
);

export const IconBell = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

export const IconSend = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base} strokeWidth={1.9}>
    <path d="M4 12l16-7-7 16-2.5-6.5L4 12Z" />
  </svg>
);

export const IconArrowDown = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base} strokeWidth={2}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
);

export const IconChevron = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base} strokeWidth={2}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconCheck = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base} strokeWidth={2.4}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const IconPlus = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base} strokeWidth={2}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconBolt = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z" />
  </svg>
);

/* ---- ícones de categoria (substituem emojis) ---- */
export const IconPlane = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M17.8 19.2 16 11l3.5-3.5a2.12 2.12 0 0 0-3-3L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" />
  </svg>
);

export const IconShield = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M12 2 4 5.5v5.2c0 5 3.4 9.6 8 10.8 4.6-1.2 8-5.8 8-10.8V5.5L12 2Z" />
  </svg>
);

export const IconCard = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="M2.5 10h19" />
  </svg>
);

export const IconFood = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M7 2v8M4.5 2v4.5a2.5 2.5 0 0 0 5 0V2" />
    <path d="M17 2c-1.7 1-3 3.5-3 6.5 0 1.5.6 2.5 2 2.5h1V22" />
    <path d="M7 13v9" />
  </svg>
);

export const IconCar = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M5 11 6.6 6.6A2 2 0 0 1 8.5 5.3h7a2 2 0 0 1 1.9 1.3L19 11" />
    <path d="M4 11h16a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V12a1 1 0 0 1 1-1Z" />
    <path d="M5 17.5V19a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.5M16 17.5V19a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1.5" />
    <path d="M6.5 14h.01M17.5 14h.01" />
  </svg>
);

export const IconFilm = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5" />
  </svg>
);

export const IconGym = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
  </svg>
);

export const IconBriefcase = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
    <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5M3 12.5h18" />
  </svg>
);

export const IconTrendUp = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M3 17.5 9.5 11l3.5 3.5L21 7" />
    <path d="M15.5 7H21v5.5" />
  </svg>
);

export const IconArrowIn = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M19 5 9 15M9 8v7h7" />
  </svg>
);

export const IconSettings = (_?: P) => (
  <svg viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.5 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.6 14H3.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 5.27 8.5a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 3.6h0A1.65 1.65 0 0 0 11 2.09V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8.6a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);
