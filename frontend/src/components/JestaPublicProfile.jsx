/**
 * JestaPublicProfile — Modal overlay for worker or employer public profile
 *
 * Props:
 *   isOpen    boolean
 *   onClose   fn
 *   type      "worker" | "employer"
 *   userData  object (optional overrides)
 */
import { motion, AnimatePresence } from "framer-motion";
import { X, Star, Zap, Briefcase, Trophy } from "lucide-react";
import { color, radius, font, styles } from "../design-system";
import { Avatar, Badge, SheetHandle } from "./ui";

// Neutral fallbacks only — real values come from the `userData` prop
// (worker: { name, rating, completedJobs, id } from ApplicantCard, etc.)
const WORKER_DEFAULTS = {
  name: "ג׳סטר",
  rating: 0,
  shifts: 0,
  level: "ג׳סטר חדש",
  city: "",
  bio: "",
  badges: [],
};

const EMPLOYER_DEFAULTS = {
  name: "מעסיק",
  business: "",
  rating: 0,
  totalShifts: 0,
  level: "מעסיק",
  city: "",
  bio: "",
  badges: [],
};

export default function JestaPublicProfile({ isOpen, onClose, type = "worker", userData }) {
  const isWorker = type === "worker";
  const defaults = isWorker ? WORKER_DEFAULTS : EMPLOYER_DEFAULTS;
  const data = { ...defaults, ...userData };
  // Map common backend field names to the shape this UI expects
  if (userData?.fullName && !userData?.name)        data.name   = userData.fullName;
  if (userData?.completedJobs != null)              data.shifts = userData.completedJobs;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="profile-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{ position: "absolute", inset: 0, zIndex: 7000,
            background: "rgba(10,10,15,0.72)",
            display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <motion.div
            key="profile-sheet"
            dir="rtl"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", ...styles.sheet, maxHeight: "82%",
              display: "flex", flexDirection: "column", overflow: "hidden",
              fontFamily: font.family }}
          >
            <SheetHandle />

            {/* Close */}
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 20px" }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
                style={{ ...styles.iconButton, width: 32, height: 32 }}>
                <X size={15} color={color.textSecondary} strokeWidth={2} />
              </motion.button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 32px" }}>
              {/* Avatar + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <Avatar size={72} employer={!isWorker} src={data.avatarUrl} surface={color.surface1} />
                <div>
                  <div style={{ fontSize: 20, ...font.heading }}>{data.name}</div>
                  {!isWorker && data.business && (
                    <div style={{ fontSize: 13, color: color.primaryText, fontWeight: 600, marginTop: 2 }}>{data.business}</div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={12}
                        fill={s <= Math.round(data.rating) ? color.warning : "transparent"}
                        color={s <= Math.round(data.rating) ? color.warning : color.textMuted} />
                    ))}
                    <span style={{ fontSize: 13, color: color.textSecondary, fontWeight: 600, marginInlineStart: 4 }}>{data.rating}</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
                {[
                  { label: isWorker ? "משמרות" : "ג׳סטות", value: isWorker ? data.shifts : data.totalShifts },
                  { label: "דירוג", value: data.rating },
                  { label: "עיר", value: data.city || "—" },
                ].map((s, i) => (
                  <div key={i} style={{ background: color.surface2, borderRadius: radius.input,
                    padding: "12px 8px", textAlign: "center",
                    border: `1px solid ${color.borderSubtle}` }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: color.textPrimary }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: color.textSecondary, fontWeight: 500, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Level badge */}
              <Badge variant="pending" icon={Trophy} style={{ marginBottom: 16 }}>{data.level}</Badge>

              {/* Bio */}
              {data.bio && (
                <div style={{ fontSize: 14, ...font.body, marginBottom: 20 }}>{data.bio}</div>
              )}

              {/* Badges */}
              {data.badges?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                  {data.badges.map((badge, i) => (
                    <Badge key={i} variant="primary">{badge}</Badge>
                  ))}
                </div>
              )}

              {/* CTA */}
              {/* TODO: direct job offers / direct contact require a backend
                  endpoint (e.g. POST /offers) that doesn't exist yet —
                  disabled until then rather than pretending to work. */}
              <motion.button disabled
                style={{ ...styles.buttonSecondary, marginTop: 4,
                  color: color.textMuted, cursor: "not-allowed" }}>
                {isWorker
                  ? <><Zap size={16} strokeWidth={1.75} /> שלח הצעת עבודה (בקרוב)</>
                  : <><Briefcase size={16} strokeWidth={1.75} /> צור קשר עם המעסיק (בקרוב)</>}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
