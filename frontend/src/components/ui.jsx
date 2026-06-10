/**
 * ui.jsx — shared design-system primitives.
 * Every component should use these instead of re-implementing avatars,
 * badges, buttons, segmented controls, empty states and sheet handles.
 */
import { motion } from "framer-motion";
import { UserRound, Building2 } from "lucide-react";
import { color, radius, shadow, font, styles } from "../design-system";

// ── Avatar ────────────────────────────────────────────────────────────────────
// Never initials: photo if available, otherwise a subtle gradient placeholder
// with a person/building icon. Online dot: 8px green, 2px surface border.
export function Avatar({ src, alt = "", size = 48, online = false, employer = false, onClick, surface = color.surface1 }) {
  const Icon = employer ? Building2 : UserRound;
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <motion.div
        whileTap={onClick ? { scale: 0.94 } : undefined}
        onClick={onClick}
        style={{
          width: size, height: size, borderRadius: "50%",
          cursor: onClick ? "pointer" : "default",
          background: src
            ? color.surface2
            : `linear-gradient(135deg, ${color.surface3} 0%, ${color.primarySoft} 100%)`,
          border: `1px solid ${color.borderStrong}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {src ? (
          <img src={src} alt={alt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Icon size={Math.round(size * 0.44)} color={color.primaryText} strokeWidth={1.75} />
        )}
      </motion.div>
      {online && (
        <div style={{
          position: "absolute", bottom: 0, insetInlineStart: 0,
          width: 8, height: 8, borderRadius: "50%",
          background: color.success, border: `2px solid ${surface}`,
          boxSizing: "content-box",
        }} />
      )}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
// PENDING: surface-3 + amber text · APPROVED: emerald/10 + emerald text
// LOCKED: surface-2 + muted text · NEUTRAL: surface-3 + secondary text
const BADGE_VARIANTS = {
  pending:  { background: color.surface3,    text: color.warning },
  approved: { background: color.successSoft, text: color.success },
  locked:   { background: color.surface2,    text: color.textMuted },
  rejected: { background: color.surface2,    text: color.danger },
  neutral:  { background: color.surface3,    text: color.textSecondary },
  primary:  { background: color.primarySoft, text: color.primaryText },
};

export function Badge({ variant = "neutral", icon: Icon, children, style }) {
  const v = BADGE_VARIANTS[variant] ?? BADGE_VARIANTS.neutral;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: v.background, color: v.text,
      borderRadius: radius.chip, padding: "4px 12px",
      fontSize: 11, fontWeight: 500,
      letterSpacing: "0.04em", textTransform: "uppercase",
      whiteSpace: "nowrap", ...style,
    }}>
      {Icon && <Icon size={12} strokeWidth={2} />}
      {children}
    </span>
  );
}

// ── Segmented control (role toggle etc.) ─────────────────────────────────────
// Active: solid surface-3 with primary text. Same color language for ALL modes
// — differentiate with icons only.
export function SegmentedControl({ options, value, onChange, id = "seg" }) {
  return (
    <div style={{
      display: "flex", background: color.surface2,
      borderRadius: radius.input, padding: 4,
      border: `1px solid ${color.borderSubtle}`,
    }}>
      {options.map(({ key, label, icon: Icon }) => {
        const active = value === key;
        return (
          <button key={String(key)} onClick={() => onChange(key)}
            style={{
              flex: 1, padding: "10px 8px",
              borderRadius: radius.input - 4, border: "none",
              background: "transparent", cursor: "pointer",
              fontFamily: font.family, fontSize: 13, fontWeight: 600,
              color: active ? color.primaryText : color.textSecondary,
              position: "relative", zIndex: 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "color 0.2s",
            }}>
            {active && (
              <motion.div layoutId={`${id}-pill`}
                style={{
                  position: "absolute", inset: 0, zIndex: -1,
                  borderRadius: radius.input - 4,
                  background: color.surface3,
                  border: `1px solid ${color.borderStrong}`,
                }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }} />
            )}
            {Icon && <Icon size={16} strokeWidth={2} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
// 48px muted icon · 18px/600 title · 14px secondary subtitle (max 260px)
export function EmptyState({ icon: Icon, title, subtitle, action, actionLabel }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 20px", gap: 12, textAlign: "center",
    }}>
      {Icon && <Icon size={48} color={color.textMuted} strokeWidth={1.5} />}
      <div style={{ fontSize: 18, fontWeight: 600, color: color.textPrimary }}>{title}</div>
      {subtitle && (
        <div style={{
          fontSize: 14, color: color.textSecondary,
          maxWidth: 260, lineHeight: 1.6,
        }}>{subtitle}</div>
      )}
      {action && (
        <motion.button whileTap={{ scale: 0.97 }} onClick={action}
          style={{ ...styles.buttonSecondary, width: "auto", height: 44, padding: "0 24px", marginTop: 4, fontSize: 14 }}>
          {actionLabel}
        </motion.button>
      )}
    </div>
  );
}

// ── Sheet handle ──────────────────────────────────────────────────────────────
export function SheetHandle() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px", flexShrink: 0 }}>
      <div style={styles.sheetHandle} />
    </div>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────
export function PrimaryButton({ children, disabled, style, ...props }) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.98 }}
      whileHover={disabled ? undefined : { backgroundColor: color.primaryHover }}
      disabled={disabled}
      style={{
        ...styles.buttonPrimary,
        ...(disabled && { background: color.surface3, color: color.textMuted, boxShadow: "none", cursor: "not-allowed" }),
        ...style,
      }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function SecondaryButton({ children, style, ...props }) {
  return (
    <motion.button whileTap={{ scale: 0.98 }}
      style={{ ...styles.buttonSecondary, ...style }} {...props}>
      {children}
    </motion.button>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 28 }) {
  return (
    <motion.div animate={{ rotate: 360 }}
      transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }}
      style={{
        width: size, height: size, borderRadius: "50%",
        border: `3px solid ${color.primary}`, borderTopColor: "transparent",
      }} />
  );
}

// ── Section label (overline) ─────────────────────────────────────────────────
export function SectionLabel({ children, style }) {
  return <div style={{ ...font.overline, marginBottom: 12, ...style }}>{children}</div>;
}
