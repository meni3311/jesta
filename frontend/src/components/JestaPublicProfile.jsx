/**
 * JestaPublicProfile — Modal overlay for worker or employer public profile
 *
 * When userData.id is present, fetches the live public profile
 * (GET /users/:id/public): rating_avg + count, Jesta Score and recent
 * ratings — so every profile shows real trust data (System 1).
 *
 * Props:
 *   isOpen    boolean
 *   onClose   fn
 *   type      "worker" | "employer"
 *   userData  object (optional overrides; id triggers the live fetch)
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Briefcase, Trophy, Loader2, AlertTriangle } from "lucide-react";
import { getPublicProfile } from "../services/api";
import { color, radius, font, styles } from "../design-system";
import { Avatar, Badge, SheetHandle, RatingStars, JestaScoreRing } from "./ui";

// Neutral fallbacks only — real values come from the live fetch / props
const WORKER_DEFAULTS = {
  name: "ג׳סטר", rating: 0, ratingCount: 0, jestaScore: null,
  shifts: 0, level: "ג׳סטר חדש", city: "", bio: "", badges: [],
};
const EMPLOYER_DEFAULTS = {
  name: "מעסיק", business: "", rating: 0, ratingCount: 0, jestaScore: null,
  totalShifts: 0, level: "מעסיק", city: "", bio: "", badges: [],
};

function timeAgo(iso) {
  const d = Math.round((Date.now() - new Date(iso)) / 86400000);
  if (d < 1)  return "היום";
  if (d < 30) return `לפני ${d} ימים`;
  return new Date(iso).toLocaleDateString("he-IL", { month: "short", year: "numeric" });
}

export default function JestaPublicProfile({ isOpen, onClose, type = "worker", userData }) {
  const isWorker = type === "worker";
  const defaults = isWorker ? WORKER_DEFAULTS : EMPLOYER_DEFAULTS;

  const [live,    setLive]    = useState(null);
  const [loading, setLoading] = useState(false);

  // Live fetch whenever the sheet opens with a real user id
  useEffect(() => {
    if (!isOpen || !userData?.id) { setLive(null); return; }
    let cancelled = false;
    setLoading(true);
    getPublicProfile(userData.id)
      .then((data) => { if (!cancelled) setLive(data); })
      .catch(() => { /* fall back to the passed-in data */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, userData?.id]);

  const data = { ...defaults, ...userData };
  if (userData?.fullName && !userData?.name)  data.name   = userData.fullName;
  if (userData?.completedJobs != null)        data.shifts = userData.completedJobs;
  if (live) {
    data.name        = live.fullName ?? data.name;
    data.avatarUrl   = live.avatarUrl ?? data.avatarUrl;
    data.rating      = live.rating ?? data.rating;
    data.ratingCount = live.ratingCount ?? data.ratingCount;
    data.jestaScore  = live.jestaScore ?? data.jestaScore;
    data.shifts      = live.completedJobs ?? data.shifts;
    data.totalShifts = live.completedJobs ?? data.totalShifts;
    data.warningFlag = live.warningFlag;
  }
  const recentRatings = live?.recentRatings ?? [];

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
              {/* Avatar + name + Jesta Score */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <Avatar size={72} employer={!isWorker} src={data.avatarUrl} surface={color.surface1} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 20, ...font.heading, display: "flex", alignItems: "center", gap: 8 }}>
                    {data.name}
                    {loading && <Loader2 size={14} color={color.textMuted}
                      style={{ animation: "spin 0.7s linear infinite" }} />}
                  </div>
                  {!isWorker && data.business && (
                    <div style={{ fontSize: 13, color: color.primaryText, fontWeight: 600, marginTop: 2 }}>{data.business}</div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <RatingStars rating={data.rating} count={data.ratingCount} size={12} />
                  </div>
                  {data.warningFlag && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6,
                      fontSize: 10, fontWeight: 600, color: color.warning,
                      background: color.warningSoft, borderRadius: radius.chip, padding: "3px 10px" }}>
                      <AlertTriangle size={11} strokeWidth={2} /> אזהרת אי-הגעה
                    </div>
                  )}
                </div>
                {/* Jesta Score — displayed prominently (System 1) */}
                {data.jestaScore != null && <JestaScoreRing score={data.jestaScore} size={62} />}
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
                {[
                  { label: isWorker ? "משמרות" : "ג׳סטות", value: isWorker ? data.shifts : data.totalShifts },
                  { label: "דירוג", value: `${Number(data.rating ?? 0).toFixed(1)} (${data.ratingCount ?? 0})` },
                  { label: "Jesta Score", value: data.jestaScore != null ? Math.round(data.jestaScore) : "—" },
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

              {/* Recent ratings (System 1) */}
              {recentRatings.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ ...font.overline, marginBottom: 10 }}>דירוגים אחרונים</div>
                  {recentRatings.map((r) => (
                    <div key={r.id} style={{ background: color.surface2, borderRadius: radius.input,
                      border: `1px solid ${color.borderSubtle}`, padding: "10px 12px", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: color.textPrimary }}>
                          {r.fromUser?.fullName ?? "משתמש"}
                        </span>
                        <RatingStars rating={r.score} size={10} showValue={false} />
                      </div>
                      {r.comment && (
                        <div style={{ fontSize: 12, color: color.textSecondary, lineHeight: 1.5 }}>״{r.comment}״</div>
                      )}
                      <div style={{ fontSize: 10, color: color.textMuted, marginTop: 4 }}>{timeAgo(r.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* CTA — direct offers happen through גיוס ישיר (Pro, System 3) */}
              <motion.button disabled
                style={{ ...styles.buttonSecondary, marginTop: 4,
                  color: color.textMuted, cursor: "not-allowed" }}>
                {isWorker
                  ? <><Zap size={16} strokeWidth={1.75} /> הצעה ישירה — דרך ״גיוס ישיר״ בדאשבורד (פרו)</>
                  : <><Briefcase size={16} strokeWidth={1.75} /> צור קשר עם המעסיק (בקרוב)</>}
              </motion.button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
