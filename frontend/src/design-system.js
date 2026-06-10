/**
 * Jesta Design System — the single source of truth for every visual token.
 *
 * Rules (do not break these in components):
 *  • Every color comes from `color`. No hardcoded hex values in components.
 *  • Every margin/padding is a multiple of 4px — use `space(n)`.
 *  • One primary (violet) button per screen. Secondary = transparent + border.
 *  • Worker and employer modes share the SAME color language.
 *  • No orange as a brand color. No emoji in UI — lucide-react icons only.
 */

// ── Color palette ─────────────────────────────────────────────────────────────
export const color = {
  // Backgrounds (darkest → lightest)
  bg:       "#0a0a0f",   // base — near black, not pure black
  surface1: "#13131a",   // cards
  surface2: "#1c1c26",   // elevated (icon containers, hovers)
  surface3: "#242432",   // inputs, segmented-control active, subtle fills

  // Borders
  borderSubtle: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.12)",

  // Brand — ONE primary
  primary:      "#7c3aed",
  primaryHover: "#6d28d9",
  primaryGlow:  "rgba(124,58,237,0.25)",
  primarySoft:  "rgba(124,58,237,0.12)",  // tinted fills on dark surfaces
  primaryText:  "#a78bfa",                // violet that reads on dark surfaces

  // Accents
  success:     "#10b981",                 // emerald, not neon green
  successSoft: "rgba(16,185,129,0.10)",
  warning:     "#f59e0b",                 // amber — status text only
  warningSoft: "rgba(245,158,11,0.10)",
  danger:      "#f87171",                 // text only, never as a background
  dangerSoft:  "rgba(248,113,113,0.10)",

  // Text
  textPrimary:   "#f8fafc",
  textSecondary: "#94a3b8",
  textMuted:     "#475569",
};

// ── Spacing — 4px base unit, 8px grid ────────────────────────────────────────
export const space = (n) => n * 4;

// ── Border radius ─────────────────────────────────────────────────────────────
export const radius = {
  card:   16,
  button: 14,
  chip:   999,  // pill
  input:  12,
  sheet:  24,   // bottom sheets — top corners only
  icon:   8,    // small icon containers
};

// ── Shadows (opacity-based — visible in dark mode) ────────────────────────────
export const shadow = {
  card:  "0 1px 3px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.2)",
  glow:  "0 0 20px rgba(124,58,237,0.3)",       // primary action only
  sheet: "0 -8px 32px rgba(0,0,0,0.45)",
};

// ── Typography ────────────────────────────────────────────────────────────────
export const font = {
  family: "'Heebo','Segoe UI',system-ui,sans-serif",
  features: '"rlig" 1, "calt" 1',
  heading: { fontWeight: 700, letterSpacing: "-0.02em", color: color.textPrimary },
  body:    { fontWeight: 400, lineHeight: 1.6, color: color.textSecondary },
  label:   { fontWeight: 500 },
  // uppercase tracking — status badges / section labels only
  overline: {
    fontSize: 11, fontWeight: 500, letterSpacing: "0.08em",
    textTransform: "uppercase", color: color.textMuted,
  },
};

// ── Shared style objects ──────────────────────────────────────────────────────
export const styles = {
  screen: {
    fontFamily: font.family,
    width: "100%", height: "100%",
    background: color.bg,
    display: "flex", flexDirection: "column",
    color: color.textPrimary,
  },

  card: {
    background: color.surface1,
    borderRadius: radius.card,
    border: `1px solid ${color.borderSubtle}`,
    boxShadow: shadow.card,
  },

  // Primary: solid violet, 52px, glow. ONE per screen.
  buttonPrimary: {
    width: "100%", height: 52,
    borderRadius: radius.button, border: "none",
    background: color.primary, color: "#fff",
    fontSize: 15, fontWeight: 700,
    cursor: "pointer", fontFamily: font.family,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: shadow.glow,
    transition: "background 0.2s, box-shadow 0.2s, opacity 0.2s",
  },

  // Secondary: transparent + border, same height
  buttonSecondary: {
    width: "100%", height: 52,
    borderRadius: radius.button,
    border: `1px solid ${color.borderStrong}`,
    background: "transparent", color: color.textPrimary,
    fontSize: 15, fontWeight: 600,
    cursor: "pointer", fontFamily: font.family,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },

  // Destructive: surface-colored with red text only — no red background
  buttonDestructive: {
    width: "100%", height: 52,
    borderRadius: radius.button, border: "none",
    background: color.surface2, color: color.danger,
    fontSize: 15, fontWeight: 600,
    cursor: "pointer", fontFamily: font.family,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  },

  input: {
    width: "100%", boxSizing: "border-box",
    padding: "12px 16px",
    borderRadius: radius.input,
    border: `1px solid ${color.borderSubtle}`,
    background: color.surface3,
    color: color.textPrimary,
    fontSize: 14, fontWeight: 400,
    fontFamily: font.family, outline: "none",
    transition: "border-color 0.15s",
  },

  // 32×32 surface-2 icon container (job cards, nav rows)
  iconBox: (size = 32) => ({
    width: size, height: size,
    borderRadius: radius.icon,
    background: color.surface2,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  }),

  // Bottom sheet
  sheet: {
    background: color.surface1,
    borderRadius: `${radius.sheet}px ${radius.sheet}px 0 0`,
    border: `1px solid ${color.borderSubtle}`,
    borderBottom: "none",
    boxShadow: shadow.sheet,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    background: color.borderSubtle,
  },
  sheetContent: { padding: "16px 20px" },

  // 44×44 circular ghost icon button (headers)
  iconButton: {
    width: 36, height: 36, borderRadius: radius.chip,
    background: color.surface2,
    border: `1px solid ${color.borderSubtle}`,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flexShrink: 0,
  },
};

export default { color, space, radius, shadow, font, styles };
