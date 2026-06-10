/**
 * JestaPending — "Waiting for employer approval" screen
 *
 * Real data: polls GET /api/jobs/applications/me every few seconds and
 * advances to the "approved" stage only when the employer actually
 * approves the application (PENDING → APPROVED in the DB).
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, MapPin, Zap, X, Check, UserRound, Loader2 } from "lucide-react";
import { getMyApplications } from "../services/api";
import { color, radius, shadow, font, styles } from "../design-system";
import { Avatar } from "./ui";

const POLL_MS = 5000;

function buildStages(employer) {
  return [
    { id: 0, text: `שולחים בקשה ל${employer}...`,   sub: "מעבירים את הפרופיל שלך",      done: false },
    { id: 1, text: `${employer} בודק את הבקשה שלך`, sub: "בדרך כלל זה לוקח כמה דקות",   done: false },
    { id: 2, text: "הבקשה התקבלה!",                 sub: "נתראה במשמרת",                done: true  },
  ];
}

const RINGS = [
  { r: 48,  delay: 0,    opacity: 0.30 },
  { r: 72,  delay: 0.35, opacity: 0.18 },
  { r: 96,  delay: 0.7,  opacity: 0.10 },
  { r: 118, delay: 1.05, opacity: 0.05 },
];

export default function JestaPending({ job, onBack }) {
  const [stageIdx, setStageIdx] = useState(0);
  const [rejected, setRejected] = useState(false);

  const employer = job?.employer ?? "המעסיק";

  // Visual "sending..." stage, then move to "reviewing" once the request is in
  useEffect(() => {
    const t1 = setTimeout(() => setStageIdx((s) => (s === 0 ? 1 : s)), 1600);
    return () => clearTimeout(t1);
  }, []);

  // Poll the real application status until it's APPROVED or REJECTED
  useEffect(() => {
    if (!job?.id) return;
    let stopped = false;

    const check = async () => {
      try {
        const apps = await getMyApplications();
        if (stopped) return;
        const app = apps.find((a) => a.job?.id === job.id || a.jobId === job.id);
        if (!app) return;
        if (app.status === "APPROVED" || app.status === "COMPLETED") {
          setStageIdx(2);
          stopped = true;
        } else if (app.status === "REJECTED") {
          setRejected(true);
          stopped = true;
        }
      } catch (err) {
        console.warn("[Pending] Status poll failed:", err.message);
      }
    };

    check();
    const interval = setInterval(() => { if (!stopped) check(); else clearInterval(interval); }, POLL_MS);
    return () => { stopped = true; clearInterval(interval); };
  }, [job?.id]);

  const STAGES   = buildStages(employer);
  const stage    = rejected
    ? { text: "הבקשה לא אושרה הפעם", sub: "אל דאגה — יש עוד המון ג׳סטות בפיד", done: false }
    : STAGES[stageIdx];
  const isDone   = !rejected && (stage.done ?? false);
  const title    = job?.title ?? "";
  const pay      = job?.pay   ?? "";
  const time     = job?.time  ?? "";
  const dist     = job?.dist  ?? "";
  void title;

  return (
    <div dir="rtl" style={{ ...styles.screen, position: "relative", overflow: "hidden" }}>
      {/* Ambient glow behind the center orb */}
      <div style={{ position: "absolute", top: "25%", left: "50%", transform: "translate(-50%,-50%)",
        width: 260, height: 260, borderRadius: "50%",
        background: `radial-gradient(circle, ${color.primaryGlow} 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "48px 20px 0" }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          style={styles.iconButton}>
          <X size={16} color={color.textPrimary} strokeWidth={2} />
        </motion.button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 22, ...font.heading }}>גסטה</span>
          <Zap size={14} color={color.primaryText} strokeWidth={2} />
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        <div style={{ position: "relative", width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
          {RINGS.map(({ r, delay, opacity }) => (
            <motion.div key={r} style={{ position: "absolute", width: r * 2, height: r * 2, borderRadius: "50%",
              border: `1px solid rgba(124,58,237,${opacity})` }}
              animate={{ scale: [1, 1.08, 1], opacity: [opacity, opacity * 0.4, opacity] }}
              transition={{ duration: 2.2, delay, repeat: Infinity, ease: "easeInOut" }} />
          ))}
          <motion.div
            animate={isDone ? { scale: [1, 1.08, 1.04] } : { scale: [1, 1.03, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 88, height: 88, borderRadius: "50%",
              background: isDone ? color.successSoft : `linear-gradient(135deg, ${color.surface3} 0%, ${color.primarySoft} 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px solid ${isDone ? color.success : color.borderStrong}`,
              boxShadow: isDone ? "0 0 32px rgba(16,185,129,0.3)" : shadow.glow, zIndex: 2 }}>
            {isDone
              ? <Check size={38} color={color.success} strokeWidth={2} />
              : <UserRound size={38} color={color.primaryText} strokeWidth={1.5} />}
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={rejected ? "rejected" : stageIdx}
            initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.38, ease: [0.25, 0, 0.2, 1] }} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, ...font.heading, marginBottom: 8 }}>{stage.text}</div>
            <div style={{ fontSize: 14, color: color.textSecondary, fontWeight: 400 }}>{stage.sub}</div>
          </motion.div>
        </AnimatePresence>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 28 }}>
          {STAGES.map((s, i) => (
            <motion.div key={i}
              animate={{ width: i === stageIdx ? 24 : 8,
                background: i < stageIdx ? color.success : i === stageIdx ? color.primary : color.surface3 }}
              style={{ height: 6, borderRadius: 3 }} transition={{ duration: 0.3 }} />
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.45 }}
          style={{ ...styles.card, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <Avatar size={40} employer surface={color.surface1} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: color.textPrimary }}>{employer}</div>
              <div style={{ fontSize: 11, color: color.textSecondary, fontWeight: 400 }}>
                {job?.employerRating ? `דירוג ${job.employerRating.toFixed(1)}` : "מעסיק"}
              </div>
            </div>
            <div style={{ marginInlineStart: "auto", fontSize: 17, fontWeight: 700, color: color.success, letterSpacing: "-0.02em" }}>
              {pay}<span style={{ fontSize: 11, fontWeight: 400, color: color.textSecondary }}>/שעה</span>
            </div>
          </div>
          <div style={{ height: 1, background: color.borderSubtle, marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: color.textSecondary, fontWeight: 400 }}>
              <Clock size={12} color={color.textMuted} strokeWidth={2} /> {time}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: color.textSecondary, fontWeight: 400 }}>
              <MapPin size={12} color={color.textMuted} strokeWidth={2} /> {dist}
            </div>
          </div>
        </motion.div>
      </div>

      <div style={{ padding: "0 16px 28px", display: "flex", gap: 12 }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onBack}
          style={{ ...styles.buttonSecondary, flex: "0 0 auto", width: "auto", padding: "0 20px", fontSize: 14, color: color.textSecondary }}>
          בטל
        </motion.button>
        <motion.button whileTap={{ scale: 0.98 }}
          style={{
            ...styles.buttonPrimary, flex: 1, width: "auto",
            ...(isDone && { background: color.successSoft, color: color.success, boxShadow: "0 0 20px rgba(16,185,129,0.25)", border: `1px solid ${color.success}` }),
            ...(!isDone && !rejected && { cursor: "default" }),
          }}>
          <AnimatePresence mode="wait">
            {rejected ? (
              <motion.span key="rejected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                חזרה לפיד הג׳סטות
              </motion.span>
            ) : isDone ? (
              <motion.span key="done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CheckCircle2 size={16} strokeWidth={2} /> אישור! נתראה שם
              </motion.span>
            ) : (
              <motion.span key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Loader2 size={16} strokeWidth={2} style={{ animation: "spin 1.2s linear infinite" }} />
                ממתין לאישור...
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
