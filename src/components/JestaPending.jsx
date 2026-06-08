/**
 * JestaPending — "Waiting for employer approval" screen
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock, MapPin, Zap } from "lucide-react";

const STAGES = [
  { id: 0, text: "שולחים בקשה לאורן...",          sub: "מעבירים את הפרופיל שלך",          icon: "📡", done: false },
  { id: 1, text: "אורן בודק את הפרופיל שלך",      sub: "בדרך כלל זה לוקח כמה דקות",       icon: "👀", done: false },
  { id: 2, text: "הבקשה התקבלה! 🎉",              sub: "אורן ממתין לך ב-16:00 בדיוק",     icon: "✅", done: true  },
];

const RINGS = [
  { r: 48,  delay: 0,    opacity: 0.35 },
  { r: 72,  delay: 0.35, opacity: 0.22 },
  { r: 96,  delay: 0.7,  opacity: 0.13 },
  { r: 118, delay: 1.05, opacity: 0.07 },
];

function FloatParticle({ emoji, x, delay, duration }) {
  return (
    <motion.span
      style={{ position: "absolute", bottom: 60, left: `${x}%`, fontSize: 16, pointerEvents: "none", userSelect: "none" }}
      initial={{ y: 0, opacity: 0 }}
      animate={{ y: -220, opacity: [0, 0.9, 0.9, 0] }}
      transition={{ duration, delay, repeat: Infinity, repeatDelay: duration * 0.6, ease: "easeOut" }}
    >{emoji}</motion.span>
  );
}

const BG_PARTICLES = [
  { emoji: "⚡", x: 12,  delay: 0,   duration: 3.2 },
  { emoji: "⭐", x: 28,  delay: 1.1, duration: 3.8 },
  { emoji: "✨", x: 55,  delay: 0.5, duration: 2.9 },
  { emoji: "⚡", x: 70,  delay: 1.7, duration: 3.5 },
  { emoji: "⭐", x: 85,  delay: 0.3, duration: 4.0 },
  { emoji: "✨", x: 42,  delay: 2.1, duration: 3.1 },
];

export default function JestaPending({ job, onBack }) {
  const [stageIdx, setStageIdx] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStageIdx(1), 1600);
    const t2 = setTimeout(() => setStageIdx(2), 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const stage    = STAGES[stageIdx];
  const isDone   = stage.done;
  const title    = job?.title    ?? "עוזר בדוכן פופקורן";
  const employer = job?.employer ?? "סינמה סיטי";
  const pay      = job?.pay      ?? "₪55";
  const time     = job?.time     ?? "היום, 16:00–22:00";
  const dist     = job?.dist     ?? "700 מטר ממך";

  return (
    <div dir="rtl" style={{ fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif", width: "100%", height: "100%", background: "linear-gradient(160deg, #3b0f8c 0%, #1e0654 45%, #0d0328 100%)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "25%", left: "50%", transform: "translate(-50%,-50%)", width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.35) 0%, transparent 70%)", pointerEvents: "none" }} />
      {BG_PARTICLES.map((p, i) => <FloatParticle key={i} {...p} />)}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "48px 18px 0" }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onBack}
          style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", fontSize: 18 }}>✕</motion.button>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: -0.5 }}>גסטה</span>
          <Zap size={14} fill="#facc15" color="#facc15" />
        </div>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
        <div style={{ position: "relative", width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
          {RINGS.map(({ r, delay, opacity }) => (
            <motion.div key={r} style={{ position: "absolute", width: r * 2, height: r * 2, borderRadius: "50%", border: `1.5px solid rgba(167,139,250,${opacity})` }}
              animate={{ scale: [1, 1.08, 1], opacity: [opacity, opacity * 0.4, opacity] }}
              transition={{ duration: 2.2, delay, repeat: Infinity, ease: "easeInOut" }} />
          ))}
          <motion.div
            animate={isDone ? { scale: [1, 1.12, 1.06], boxShadow: ["0 0 0 0px rgba(74,222,128,0)", "0 0 0 12px rgba(74,222,128,0.25)", "0 0 0 6px rgba(74,222,128,0.15)"] } : { scale: [1, 1.03, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 88, height: 88, borderRadius: "50%", background: isDone ? "linear-gradient(135deg, #4ade80, #16a34a)" : "linear-gradient(135deg, #a78bfa, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, border: `3px solid ${isDone ? "#4ade80" : "#c4b5fd"}`, boxShadow: isDone ? "0 0 32px rgba(74,222,128,0.5)" : "0 0 32px rgba(167,139,250,0.45)", zIndex: 2 }}>
            {isDone ? "✅" : "👨‍💼"}
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={stageIdx}
            initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.38, ease: [0.25, 0, 0.2, 1] }} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 8, letterSpacing: -0.3 }}>{stage.text}</div>
            <div style={{ fontSize: 14, color: "rgba(196,181,253,0.8)", fontWeight: 500 }}>{stage.sub}</div>
          </motion.div>
        </AnimatePresence>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 28 }}>
          {STAGES.map((s, i) => (
            <motion.div key={i} animate={{ width: i === stageIdx ? 24 : 8, background: i < stageIdx ? "#4ade80" : i === stageIdx ? "#a78bfa" : "rgba(255,255,255,0.2)" }} style={{ height: 6, borderRadius: 3 }} transition={{ duration: 0.3 }} />
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.45 }}
          style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #a78bfa, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>👨‍💼</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>אורן / {employer}</div>
              <div style={{ fontSize: 11.5, color: "rgba(196,181,253,0.75)", fontWeight: 500 }}>מעסיק מאומת ⭐</div>
            </div>
            <div style={{ marginRight: "auto", fontSize: 17, fontWeight: 900, color: "#a3e635" }}>{pay}<span style={{ fontSize: 11, fontWeight: 500, color: "rgba(163,230,53,0.7)" }}>/שעה</span></div>
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)", marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(196,181,253,0.8)", fontWeight: 500 }}>
              <Clock size={12} color="#c4b5fd" strokeWidth={2} /> {time}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(196,181,253,0.8)", fontWeight: 500 }}>
              <MapPin size={12} color="#c4b5fd" strokeWidth={2} /> {dist}
            </div>
          </div>
        </motion.div>
      </div>

      <div style={{ padding: "0 16px 28px", display: "flex", gap: 10 }}>
        <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
          style={{ flex: "0 0 auto", padding: "13px 18px", borderRadius: 50, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          בטל
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }}
          style={{ flex: 1, padding: "13px 10px", borderRadius: 50, border: "none", background: isDone ? "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)" : "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)", color: "#fff", fontSize: 15, fontWeight: 900, cursor: isDone ? "pointer" : "default", fontFamily: "inherit", boxShadow: isDone ? "0 6px 22px rgba(74,222,128,0.38)" : "0 6px 22px rgba(91,33,182,0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.4s, box-shadow 0.4s" }}>
          <AnimatePresence mode="wait">
            {isDone ? (
              <motion.span key="done" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle2 size={16} strokeWidth={2.5} /> אישור! נתראה שם 🎉
              </motion.span>
            ) : (
              <motion.span key="wait" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} style={{ display: "inline-block" }}>⏳</motion.span>
                ממתין לאישור...
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}
