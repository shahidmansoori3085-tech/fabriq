/**
 * Clean line icons (Lucide-style) as zero-dependency inline SVGs.
 * All use currentColor so they inherit text colour and adapt to theme.
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
function I({ size = 22, children, ...p }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      {children}
    </svg>
  );
}

export const Camera = (p: P) => <I {...p}><path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z" /><circle cx="12" cy="13" r="3.5" /></I>;
export const Pencil = (p: P) => <I {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></I>;
export const Plus = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const Settings = (p: P) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></I>;
export const Sun = (p: P) => <I {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></I>;
export const Moon = (p: P) => <I {...p}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></I>;
export const Scan = (p: P) => <I {...p}><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M3 12h18" /></I>;
export const ArrowRight = (p: P) => <I {...p}><path d="M5 12h14M13 6l6 6-6 6" /></I>;
export const Layers = (p: P) => <I {...p}><path d="M12 2 2 7l10 5 10-5-10-5Z" /><path d="m2 17 10 5 10-5M2 12l10 5 10-5" /></I>;
export const Scissors = (p: P) => <I {...p}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12" /></I>;
export const FileText = (p: P) => <I {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></I>;
export const Cube = (p: P) => <I {...p}><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v9" /></I>;
export const Store = (p: P) => <I {...p}><path d="M3 9 4 4h16l1 5M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M9 20v-6h6v6M2 9h20" /></I>;
export const Recycle = (p: P) => <I {...p}><path d="M7 19H4.8a2 2 0 0 1-1.7-3l1.3-2.3M11 6.5 9.9 4.6a2 2 0 0 0-3.4 0L5.2 6.8M14 16.9l1.3 2.2a2 2 0 0 1-1.7 3H10M17.5 10 19 12.4a2 2 0 0 1-1.7 3H15M8.5 14 6 12l2.5-2M6 12h4" /></I>;
export const Phone = (p: P) => <I {...p}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" /></I>;
export const Building = (p: P) => <I {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M16 14h.01" /></I>;
export const MapPin = (p: P) => <I {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></I>;
export const User = (p: P) => <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></I>;
export const Sparkle = (p: P) => <I {...p}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" /></I>;
export const Clock = (p: P) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></I>;
export const TrendDown = (p: P) => <I {...p}><path d="M22 17 13.5 8.5l-5 5L2 7" /><path d="M16 17h6v-6" /></I>;
export const Rupee = (p: P) => <I {...p}><path d="M6 3h12M6 8h12M9 13c4 0 5.5-2.5 5.5-5M6 13h5l5 8" /></I>;
export const Folder = (p: P) => <I {...p}><path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z" /></I>;
export const Check = (p: P) => <I {...p}><path d="M20 6 9 17l-5-5" /></I>;
export const X = (p: P) => <I {...p}><path d="M18 6 6 18M6 6l12 12" /></I>;
export const Bolt = (p: P) => <I {...p}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></I>;
