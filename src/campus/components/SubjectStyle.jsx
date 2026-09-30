export const colors = { ED: '#c8a5ff', BD: '#78b9ff', IPE1: '#f4a3c8', Prg: '#67ddd1', SI: '#f6ba73', LMSGI: '#a7b5ff', INGPR: '#f0d66f', SOS: '#9cd47d' };
const paths = {
  ED: <><path d="m14 6 4-4 4 4-4 4M10 18l-4 4-4-4 4-4M8 16l8-8"/></>,
  BD: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>,
  IPE1: <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12c6 4 12 4 18 0M12 12v4"/></>,
  Prg: <><path d="m7 6-6 6 6 6m10-12 6 6-6 6M14 3l-4 18"/></>,
  SI: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 22h8M12 17v5M6 7h4M6 11h8"/></>,
  LMSGI: <><path d="M14 2H5v20h14V7ZM14 2v6h5M9 12l-2 3 2 3m6-6 2 3-2 3"/></>,
  INGPR: <><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20M4 6h16M4 18h16"/></>,
  SOS: <><path d="M20 3C8 1 2 8 5 16c8 7 17-2 15-13ZM3 22 16 9M8 17v-6m0 6h6"/></>,
};
export function SubjectIcon({ subject }) { return <svg fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">{paths[subject] ?? <path d="M4 4h16v16H4Z"/>}</svg>; }
