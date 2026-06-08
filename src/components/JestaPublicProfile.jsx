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
import { X, Star, CheckCircle2, MapPin, Zap, Shield, Briefcase } from "lucide-react";

export const WORKER_DEFAULTS = {
  name: "יובל כהן",
  rating: 4.9,
  shifts: 24,
  level: "ג׳סטר זהב",
  city: "ראשון לציון",
  bio: "עובד מהיר, אמין ותמיד בזמן. אוהב עבודה עם אנשים ומוכן לכל משימה!",
  badges: ["⚡ מהיר תגובה", "✅ מאומת", "⭐ מועדף"],
};

export const EMPLOYER_DEFAULTS = {
  name: "אורן פרידמן",
  business: "סינמה סיטי",
  rating: 4.9,
  totalShifts: 47,
  level: "מעסיק מובחר",
  city: "ראשון לציון",
  bio: "מנהל משמרות בסינמה סיטי, מעסיק הוגן ומשלם מיד בסוף כל משמרת.",
  badges: ["💼 מעסיק מאומת", "✅ תשלום מיידי", "🏆 ב-5% המובילים"],
};

const SLATE  = "#0f172a";
const MUTED  = "#64748b";
const VIOLET = "#7c3aed";
const GOLD   = "#d97706";

export default function JestaPublicProfile({ isOpen, onClose, type = "worker", userData }) {
  const isWorker = type === "worker";
  const defaults = isWorker ? WORKER_DEFAULTS : EMPLOYER_DEFAULTS;
  const data = { ...defaults, ...userData };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="profile-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{ position: "absolute", inset: 0, zIndex: 7000, background: "rgba(6,3,15,0.72)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <motion.div
            key="profile-sheet"
            dir="rtl"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", background: "#fff", borderRadius: "28px 28px 0 0", maxHeight: "82%", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif" }}
          >
            {/* Handle */}
            <div style={{ padding: "10px 0 0", display: "flex", justifyContent: "center" }}>
              <div style={{ width: 44, height: 5, borderRadius: 3, background: "#ddd6fe", opacity: 0.8 }} />
            </div>

            {/* Close */}
            <div style={{ display: "flex", justifyContent: "flex-left", padding: "8px 16px 0" }}>
              <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
                style={{ width: 32, height: 32, borderRadius: "50%", background: "#f1f5f9", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={15} color={MUTED} strokeWidth={2.5} />
              </motion.button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 32px" }}>
              {/* Avatar + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: isWorker ? "linear-gradient(135deg,#a78bfa,#7c3aed)" : "linear-gradient(135deg,#fbbf24,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0, border: `3px solid ${isWorker ? "#ede9fe" : "#fde68a"}`, boxShadow: `0 6px 20px ${isWorker ? "rgba(124,58,237,0.25)" : "rgba(217,119,6,0.25)"}` }}>
                  {isWorker ? "🧑" : "👨‍💼"}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: SLATE }}>{data.name}</div>
                  {!isWorker && data.business && (
                    <div style={{ fontSize: 13, color: VIOLET, fontWeight: 700, marginTop: 2 }}>{data.business}</div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                    {[1,2,3,4,5].map(s => <Star key={s} size={12} fill={s <= Math.round(data.rating) ? "#fbbf24" : "#e2e8f0"} color={s <= Math.round(data.rating) ? "#fbbf24" : "#e2e8f0"} />)}
                    <span style={{ fontSize: 13, color: MUTED, fontWeight: 700, marginRight: 3 }}>{data.rating}</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
                {[
                  { label: isWorker ? "משמרות" : "ג׳סטות", value: isWorker ? data.shifts : data.totalShifts },
                  { label: "דירוג", value: `${data.rating} ⭐` },
                  { label: "עיר", value: data.city },
                ].map((s, i) => (
                  <div key={i} style={{ background: "#f8f7ff", borderRadius: 14, padding: "10px 8px", textAlign: "center", border: "1px solid #ede9fe" }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: SLATE }}>{s.value}</div>
                    <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Level badge */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 20, padding: "5px 14px", marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: GOLD }}>🏆 {data.level}</span>
              </div>

              {/* Bio */}
              <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.65, marginBottom: 18 }}>{data.bio}</div>

              {/* Badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                {data.badges?.map((badge, i) => (
                  <div key={i} style={{ background: "#f5f3ff", border: "1px solid #ede9fe", borderRadius: 20, padding: "5px 13px", fontSize: 12, fontWeight: 700, color: VIOLET }}>{badge}</div>
                ))}
              </div>

              {/* CTA */}
              <motion.button whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }}
                style={{ width: "100%", padding: "14px", borderRadius: 50, border: "none", background: isWorker ? "linear-gradient(135deg,#9333ea,#ec4899)" : "linear-gradient(135deg,#d97706,#92400e)", color: "#fff", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", boxShadow: isWorker ? "0 6px 20px rgba(147,51,234,0.35)" : "0 6px 20px rgba(217,119,6,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {isWorker ? <><Zap size={16} fill="#facc15" color="#facc15" /> שלח הצעת עבודה</> : <><Briefcase size={16} /> צור קשר עם המעסיק</>}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
