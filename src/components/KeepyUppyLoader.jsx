import { C } from "../theme";

/**
 * Loading animation: line-art player doing keepy-uppies. Pure SVG + CSS
 * keyframes (no deps). The kicking leg swings about the hip in sync with
 * the ball's bounce: ball touches the foot at 0%/100%, peaks at 50%.
 * Respects prefers-reduced-motion (static pose).
 */
export default function KeepyUppyLoader({ size = 120 }) {
  const line = { fill: "none", stroke: C.accent, strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" };
  const css = `
    @keyframes kuBall { 0% { transform: translateY(0) rotate(0deg); animation-timing-function: cubic-bezier(.2,.7,.4,1) }
                        50% { transform: translateY(-62px) rotate(180deg); animation-timing-function: cubic-bezier(.6,0,.8,.3) }
                        100% { transform: translateY(0) rotate(360deg) } }
    @keyframes kuLeg  { 0%, 100% { transform: rotate(-38deg) } 22%, 78% { transform: rotate(-6deg) } }
    @keyframes kuArm  { 0%, 100% { transform: rotate(-8deg) } 50% { transform: rotate(6deg) } }
    @keyframes kuShadow { 0%, 100% { transform: scaleX(1); opacity: .55 } 50% { transform: scaleX(.45); opacity: .2 } }
    @keyframes kuScan { to { stroke-dashoffset: -24 } }
    .ku-ball   { animation: kuBall 1.1s infinite; transform-box: fill-box; transform-origin: center; }
    .ku-leg    { animation: kuLeg 1.1s ease-in-out infinite; transform-origin: 60px 80px; }
    .ku-arm    { animation: kuArm 1.1s ease-in-out infinite; transform-origin: 60px 48px; }
    .ku-shadow { animation: kuShadow 1.1s infinite; transform-box: fill-box; transform-origin: center; }
    .ku-ground { animation: kuScan 1.2s linear infinite; }
    @media (prefers-reduced-motion: reduce) { .ku-ball, .ku-leg, .ku-arm, .ku-shadow, .ku-ground { animation: none; } }
  `;

  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 120 144" role="img" aria-label="A carregar"
      style={{ overflow: "visible", filter: `drop-shadow(0 0 6px ${C.accentBorder})` }}>
      <style>{css}</style>

      {/* ground: dashed "scan" line + tick marks */}
      <line className="ku-ground" x1="8" y1="138" x2="112" y2="138" stroke={C.border} strokeWidth="2" strokeDasharray="8 4" />
      <ellipse className="ku-shadow" cx="98" cy="139" rx="9" ry="2" fill={C.accent} />

      {/* head (with a "visor" tick for the tech look) */}
      <circle cx="60" cy="27" r="9" {...line} />
      <path d="M63 25 h5" {...line} strokeWidth="2" />

      {/* torso */}
      <path d="M60 36 L60 80" {...line} />

      {/* arms — gentle balance sway */}
      <g className="ku-arm">
        <path d="M60 48 L44 62 L40 74" {...line} />
        <path d="M60 48 L77 58 L84 68" {...line} />
      </g>

      {/* standing leg */}
      <path d="M60 80 L55 108 L54 136 L46 136" {...line} />

      {/* kicking leg — swings forward about the hip to meet the ball */}
      <g className="ku-leg">
        <path d="M60 80 L64 108 L66 134 L74 134" {...line} />
        <circle cx="64" cy="108" r="2" fill={C.accent} />
      </g>

      {/* ball — touches the foot at y≈112, peaks ~62px higher */}
      <g className="ku-ball">
        <circle cx="98" cy="110" r="7" fill={C.bg} stroke={C.accent} strokeWidth="2.5" />
        <path d="M98 105.5 l3.6 2.6 -1.4 4.2 h-4.4 l-1.4 -4.2 z" fill={C.accent} />
      </g>
    </svg>
  );
}
