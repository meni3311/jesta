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

// ── Rating stars (System 1) ───────────────────────────────────────────────────
// rating + total count, e.g. ★★★★☆ 4.2 (13) — used on profiles & applicant cards
import { Star } from "lucide-react";

export function RatingStars({ rating = 0, count = null, size = 11, showValue = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={size} strokeWidth={1.5}
          fill={s <= Math.round(rating) ? color.warning : "transparent"}
          color={s <= Math.round(rating) ? color.warning : color.textMuted} />
      ))}
      {showValue && (
        <span style={{ fontSize: size, color: color.textSecondary, fontWeight: 600, marginInlineStart: 4 }}>
          {Number(rating ?? 0).toFixed(1)}
        </span>
      )}
      {count != null && (
        <span style={{ fontSize: size - 1, color: color.textMuted, marginInlineStart: 2 }}>
          ({count})
        </span>
      )}
    </span>
  );
}

// ── Emergency badge (ג'סטה חירום) ────────────────────────────────────────────
// Styled component — NO emoji in code, per design-system rules. A pulsing dot
// + Siren icon on a soft danger fill marks emergency gestas everywhere.
import { Siren, Bell } from "lucide-react";

export function EmergencyBadge({ size = "md", style }) {
  const compact = size === "sm";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: compact ? 4 : 6,
      background: color.dangerSoft, color: color.danger,
      border: `1px solid rgba(248,113,113,0.35)`,
      borderRadius: radius.chip,
      padding: compact ? "2px 8px" : "4px 12px",
      fontSize: compact ? 9 : 11, fontWeight: 700,
      letterSpacing: "0.04em", whiteSpace: "nowrap",
      ...style,
    }}>
      <span style={{ position: "relative", display: "inline-flex", width: compact ? 6 : 7, height: compact ? 6 : 7 }}>
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: color.danger, animation: "jesta-pulse 1.4s ease-out infinite",
        }} />
        <span style={{ position: "relative", width: "100%", height: "100%", borderRadius: "50%", background: color.danger }} />
      </span>
      <Siren size={compact ? 10 : 12} strokeWidth={2} />
      ג׳סטה חירום
      <style>{`@keyframes jesta-pulse {
        0% { transform: scale(1); opacity: 0.8; }
        70% { transform: scale(2.4); opacity: 0; }
        100% { transform: scale(2.4); opacity: 0; }
      }`}</style>
    </span>
  );
}

// ── Job lifecycle status badge (System 4) ────────────────────────────────────
const JOB_STATUS_META = {
  OPEN:      { label: "פתוחה",   variant: "primary"  },
  EMERGENCY: { label: "חירום",   variant: "rejected" },  // red text on soft fill
  APPROVED:  { label: "אושר עובד", variant: "approved" },
  COMPLETED: { label: "הושלמה",  variant: "approved" },
  EXPIRED:   { label: "פג תוקף", variant: "locked"   },
  CANCELLED: { label: "בוטלה",   variant: "locked"   },
};

export function JobStatusBadge({ status, style }) {
  const meta = JOB_STATUS_META[status] ?? JOB_STATUS_META.OPEN;
  return <Badge variant={meta.variant} style={style}>{meta.label}</Badge>;
}

// ── Header bell with unread badge (System 3) ─────────────────────────────────
export function BellButton({ unreadCount = 0, onClick, style }) {
  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={onClick} aria-label="התראות"
      style={{ ...styles.iconButton, position: "relative", ...style }}>
      <Bell size={16} color={color.primaryText} strokeWidth={2} />
      {unreadCount > 0 && (
        <span style={{
          position: "absolute", top: -4, insetInlineEnd: -4,
          minWidth: 16, height: 16, borderRadius: 8, padding: "0 4px",
          background: color.primary, border: `2px solid ${color.bg}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 700, color: "#fff",
          fontFamily: font.family, boxSizing: "content-box",
        }}>
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </motion.button>
  );
}

// ── Jesta Score ring (System 1) ───────────────────────────────────────────────
// 0-100 composite trust score, displayed as a small progress ring.
export function JestaScoreRing({ score = 0, size = 56, label = true }) {
  const s = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const stroke = Math.max(3, Math.round(size / 14));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ringColor = s >= 75 ? color.success : s >= 45 ? color.primaryText : color.warning;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color.surface3} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={ringColor} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - s / 100)} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: Math.round(size * 0.3), fontWeight: 700, color: color.textPrimary, lineHeight: 1 }}>
          {s}
        </span>
        {label && size >= 52 && (
          <span style={{ fontSize: Math.max(7, Math.round(size * 0.13)), color: color.textMuted, fontWeight: 500 }}>
            JESTA
          </span>
        )}
      </div>
    </div>
  );
}
