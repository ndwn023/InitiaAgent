"use client";

import { motion } from "framer-motion";

/**
 * MedalIcon — a pure-SVG animated podium medal for ranks 1/2/3.
 *
 * Visual stack (back → front):
 *   1. Orbiting sparkle stars (4, slowly rotating around the disc, twinkling
 *      in/out of phase so it never looks robotic).
 *   2. Medal disc with radial gradient fill (bright off-center highlight →
 *      mid tone → dark edge) + metallic rim stroke + engraved inner ring
 *      + gloss ellipse + tiny sub-glint.
 *
 * The whole disc group floats up/down subtly. The SVG is sized to 100% of
 * its parent, so layout/scale is controlled by the caller.
 */

type Rank = 1 | 2 | 3;

interface Palette {
  gradCenter: string;
  gradMid: string;
  gradEdge: string;
  ring: string;
  sparkle: string;
}

const PALETTES: Record<Rank, Palette> = {
  1: {
    // Gold — warm, high-contrast amber with bright highlight.
    gradCenter: "#fff5c2",
    gradMid: "#ffc838",
    gradEdge: "#8a4d00",
    ring: "#d89416",
    sparkle: "#fff2b8",
  },
  2: {
    // Silver — cool platinum with pure white highlight.
    gradCenter: "#ffffff",
    gradMid: "#d8deea",
    gradEdge: "#5a6170",
    ring: "#a7aebc",
    sparkle: "#ffffff",
  },
  3: {
    // Bronze — warm copper with tan highlight.
    gradCenter: "#ffd9ac",
    gradMid: "#e0793f",
    gradEdge: "#5a2a0a",
    ring: "#b05420",
    sparkle: "#ffceab",
  },
};

// Build a 4-point sparkle star (diamond with pinched waist) centered at (0,0).
function sparklePath(r: number): string {
  const n = r * 0.28;
  return `M 0 ${-r} L ${n} ${-n} L ${r} 0 L ${n} ${n} L 0 ${r} L ${-n} ${n} L ${-r} 0 L ${-n} ${-n} Z`;
}

interface SparkleSpec {
  angle: number; // position around medal, degrees
  size: number;
  delay: number; // seconds, for twinkle phase
}

const SPARKLES: readonly SparkleSpec[] = [
  { angle: -90, size: 8.5, delay: 0 },
  { angle: 0, size: 6, delay: 1.1 },
  { angle: 90, size: 7, delay: 0.35 },
  { angle: 180, size: 6, delay: 1.45 },
];

export function MedalIcon({ rank }: { rank: Rank }) {
  const p = PALETTES[rank];
  // Unique IDs per rank so multiple medals on the same page don't collide.
  const gradId = `medalGrad${rank}`;
  const glossId = `medalGloss${rank}`;
  const shadowId = `medalShadow${rank}`;

  return (
    <svg
      viewBox="-100 -100 200 200"
      className="h-full w-full overflow-visible"
      aria-hidden
    >
      <defs>
        {/* Radial gradient centered off to the upper-left gives a faux
            lighting direction consistent with the gloss highlight. */}
        <radialGradient
          id={gradId}
          cx="-22"
          cy="-22"
          r="95"
          fx="-22"
          fy="-22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={p.gradCenter} />
          <stop offset="55%" stopColor={p.gradMid} />
          <stop offset="100%" stopColor={p.gradEdge} />
        </radialGradient>

        {/* Soft top-to-bottom white fade for the gloss ellipse. */}
        <linearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.65" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Drop shadow for the disc — gives a subtle lift. */}
        <filter id={shadowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" />
          <feOffset dx="0" dy="4" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.55" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ─── Layer 1 (back): orbiting sparkle stars ──────────────────────── */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "50% 50%", transformBox: "view-box" }}
      >
        {SPARKLES.map((s, i) => {
          const rad = (s.angle * Math.PI) / 180;
          const cx = Math.cos(rad) * 82;
          const cy = Math.sin(rad) * 82;
          return (
            // Outer g handles static placement. Inner motion.g twinkles
            // (opacity + scale) around its own origin.
            <g key={i} transform={`translate(${cx} ${cy})`}>
              <motion.g
                animate={{ opacity: [0.15, 1, 0.15], scale: [0.8, 1.1, 0.8] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: s.delay,
                }}
              >
                <path
                  d={sparklePath(s.size)}
                  fill={p.sparkle}
                  transform={`rotate(${s.angle + 45})`}
                />
              </motion.g>
            </g>
          );
        })}
      </motion.g>

      {/* ─── Layer 2 (front): disc, floats subtly ────────────────────────── */}
      <motion.g
        animate={{ y: [-2, 2, -2] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Disc + details live inside the drop-shadow filter group. */}
        <g filter={`url(#${shadowId})`}>
          <circle cx="0" cy="0" r="65" fill={`url(#${gradId})`} />
          <circle
            cx="0"
            cy="0"
            r="65"
            fill="none"
            stroke={p.ring}
            strokeWidth="5"
          />
          {/* Engraved inner ring */}
          <circle
            cx="0"
            cy="0"
            r="48"
            fill="none"
            stroke={p.ring}
            strokeWidth="1.8"
            opacity="0.5"
          />
          {/* Gloss highlight */}
          <ellipse
            cx="-18"
            cy="-22"
            rx="28"
            ry="14"
            fill={`url(#${glossId})`}
            transform="rotate(-28 -18 -22)"
          />
          {/* Tiny specular sub-glint */}
          <ellipse
            cx="-30"
            cy="-30"
            rx="6"
            ry="3"
            fill="white"
            opacity="0.85"
            transform="rotate(-28 -30 -30)"
          />
        </g>
      </motion.g>
    </svg>
  );
}
