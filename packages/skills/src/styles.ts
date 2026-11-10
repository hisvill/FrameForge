import type { Style } from '@frameforge/shared';

const at = '2026-11-10T00:00:00.000Z';

/** Styles that ship with FrameForge. They work offline and can be cloned and edited. */
export const BUILTIN_STYLES: Style[] = [
  {
    id: 'kinetic-type',
    name: 'Kinetic type',
    source: 'builtin',
    description: 'Big bold words that punch in on the beat. Great for facts and quotes.',
    swatch: 'linear-gradient(135deg,#111827 0%,#f97316 100%)',
    breakdown: {
      camera: 'Locked frame with quick 105% scale punches on key words.',
      pacing: 'A new card every 0.6 to 1.2 s; hold the hook for 2 s.',
      type: 'Heavy grotesk (Inter Black or similar), 2 to 4 words per card, centered.',
      color: 'Near-black background, white type, one accent color for the key word.',
      captions: 'The type is the caption. No separate subtitle track.',
      transitions: 'Hard cuts with a 4-frame mask wipe on section changes.',
    },
    prompt:
      'Kinetic typography video. Near-black (#0b0b0f) background, white heavy sans-serif type, one accent color (#f97316) used only for the single most important word per card. Show 2 to 4 words per card, centered, at least 9% of frame height. Cards change every 0.6 to 1.2 seconds with a spring scale-in from 85% to 100% (overshoot to 105%). Section changes use a fast diagonal mask wipe. Add subtle film grain. No images unless one icon helps the idea.',
    createdAt: at,
  },
  {
    id: 'paper-explainer',
    name: 'Paper explainer',
    source: 'builtin',
    description: 'Flat cut-paper illustrations that slide and pop. Friendly and clear.',
    swatch: 'linear-gradient(135deg,#fde68a 0%,#fb7185 100%)',
    breakdown: {
      camera: 'Slow push-in (2% per scene) with gentle parallax between layers.',
      pacing: 'One idea per scene, 3 to 5 s each.',
      type: 'Rounded sans (Nunito or similar), short headline plus one supporting line.',
      color: 'Warm cream background, 4-color palette of saturated pastels, soft drop shadows.',
      captions: 'Word-by-word captions in the lower third, current word highlighted.',
      transitions: 'Paper slides in from the side; elements pop with a small bounce.',
    },
    prompt:
      'Flat cut-paper explainer. Cream (#fff7e6) background, illustrations built from simple SVG shapes with a 2px darker outline and a soft offset shadow, like layered paper. Palette: #fb7185, #fbbf24, #34d399, #60a5fa. Every scene has one idea, 3 to 5 seconds, a slow 2% push-in and 3 parallax layers. Elements enter with a small bounce. Word-by-word captions in the lower third (rounded sans, current word in #fb7185), inside the safe area.',
    createdAt: at,
  },
  {
    id: 'neon-data',
    name: 'Neon data',
    source: 'builtin',
    description: 'Glowing charts and counters on a dark grid. Made for numbers.',
    swatch: 'linear-gradient(135deg,#0f172a 0%,#22d3ee 60%,#a855f7 100%)',
    breakdown: {
      camera: 'Slow orbit around charts; quick zoom into the key number.',
      pacing: 'Counters roll for 1 s, hold the result 1.5 s.',
      type: 'Monospace numbers, condensed sans labels.',
      color: 'Deep navy, cyan and violet glow, thin grid lines.',
      captions: 'Short labels next to the data, no subtitle bar.',
      transitions: 'Glitch flicker of 3 frames between sections.',
    },
    prompt:
      'Neon data-visualisation video. Deep navy (#0b1020) background with a faint perspective grid. Charts, maps and counters glow in cyan (#22d3ee) and violet (#a855f7) with a soft bloom. Numbers are monospace and roll up over 1 second, then hold 1.5 seconds. Camera slowly orbits charts and zooms into the key number. Labels are short, condensed sans, placed next to the data. Section changes use a 3-frame glitch flicker. Every number shown must be real and sourced.',
    createdAt: at,
  },
  {
    id: 'toy-3d',
    name: 'Toy 3D world',
    source: 'builtin',
    description: 'A tiny low-poly 3D world with a moving camera. Playful stories.',
    swatch: 'linear-gradient(135deg,#86efac 0%,#38bdf8 100%)',
    breakdown: {
      camera: 'One continuous camera flight through a miniature low-poly world.',
      pacing: 'A beat every 2 to 3 s while the camera keeps moving.',
      type: 'Chunky rounded type on floating signs inside the world.',
      color: 'Bright toy colors, soft sky gradient, warm sunlight.',
      captions: 'Bold captions in the top third so they never cover the action.',
      transitions: 'No cuts: the camera flies from one spot to the next.',
    },
    prompt:
      'Low-poly toy 3D world rendered with three.js inside Remotion (@remotion/three). Build a miniature diorama from simple primitives (boxes, cylinders, cones) with flat-shaded bright toy colors, a soft sky gradient and warm directional light with soft shadows. One continuous camera flight connects each story beat; never cut. Information appears on chunky floating signs in the world. Bold rounded captions sit in the top third, inside the safe area. Keep the scene light enough to render quickly.',
    createdAt: at,
  },
];

export const BUILTIN_IDS = new Set(BUILTIN_STYLES.map((s) => s.id));

/** Turns the JSON an agent wrote after studying a video into a style. */
export function styleFromStudy(raw: unknown, id: string, sourceUrl: string, now: string): Style | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string).trim() : '');
  if (!s('prompt')) return null;
  return {
    id,
    name: s('name') || 'Copied style',
    source: 'copied',
    description: s('description'),
    breakdown: {
      camera: s('camera'),
      pacing: s('pacing'),
      type: s('type'),
      color: s('color'),
      captions: s('captions'),
      transitions: s('transitions'),
    },
    prompt: s('prompt'),
    sourceUrl,
    swatch: 'linear-gradient(135deg,#334155 0%,#94a3b8 100%)',
    createdAt: now,
  };
}
