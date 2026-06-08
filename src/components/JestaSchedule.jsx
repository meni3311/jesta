/**
 * JestaSchedule — Worker's upcoming shifts screen
 *
 * Props:
 *   onBack          fn — navigate back to feed
 *   isApproved      boolean — Cinema City shift approval status
 *   onLocalApprove  fn — approve the Cinema City shift locally
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Calendar, Clock, MapPin, CheckCircle2, Zap, Star } from "lucide-react";

const SLATE  = "#0f172a";
const MUTED  = "#64748b";
const VIOLET = "#7c3aed";
const GOLD   = "#d97706";

const SHIFTS = [
  {
    id: "w-1",
    employer: "סינמה סיטי",
    title: "עוזר בדוכן פופקורן",
    date: "היום",
    time: "16:00–22:00",
    pay: "₪55",
    payRaw: 55,
    hours: 6,
    dist: "700 מטר",
    emoji: "🍿",
    color: "#7c3aed",
  },
  {
    id: "w-2",
    employer: "משפחת כהן",
    title: "דוגווקר",
    date: "מחר",
    time: "08:00–10:00",
    pay: "₪70",
    payRaw: 70,
    hours: 2,
    dist: '1.2 ק"מ',
    emoji: "🐕",
    color: "#059669",
  },
];

function ShiftCard({ shift, isApproved, onApprove }) {
  const total = shift.payRaw * shift.hours;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{ background: "#fff", borderRadius: 20, border: "1px solid #ede9fe", boxShadow: "0 2px 12px rgba(124,58,237,0.07)", padding: "16px", marginBottom: 12 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${shift.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
          {shift.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: SLATE }}>{shift.title}</div>
          <div style={{ fontSize: 12, color: VIOLET, fontWeight: 700, marginTop: 2 }}>{shift.employer}</div>
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#5b21b6" }}>{shift.pay}</div>
          <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 500 }}>לשעה</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: MUTED, fontWeight: 500 }}>
          <Calendar size={12} color="#c4b5fd" strokeWidth={2} /> {shift.date}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: MUTED, fontWeight: 500 }}>
          <Clock size={12} color="#c4b5fd" strokeWidth={2} /> {shift.time}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: MUTED, fontWeight: 500 }}>
          <MapPin size={12} color="#c4b5fd" strokeWidth={2} /> {shift.dist}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #f1f0fb" }}>
        <div style={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>סה״כ למשמרת: <span style={{ fontWeight: 800, color: SLATE }}>₪{total}</span></div>
        {shift.id === "w-1" && (
          isApproved ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "5px 12px" }}>
              <CheckCircle2 size={13} color="#059669" strokeWidth={2.5} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>אושר!</span>
            </div>
          ) : (
            <motion.button whileTap={{ scale: 0.95 }} onClick={onApprove}
              style={{ background: "linear-gradient(135deg,#9333ea,#ec4899)", color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 3px 10px rgba(147,51,234,0.3)" }}>
              אשר הגעה ✓
            </motion.button>
          )
        )}
      </div>
    </motion.div>
  );
}

export default function JestaSchedule({ onBack, isApproved, onLocalApprove }) {
  return (
    <div dir="rtl" style={{ fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif", width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f8f7ff" }}>
      {/* Header */}
      <div style={{ background: "#fff", padding: "48px 18px 16px", borderBottom: "1px solid #ede9fe", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
            style={{ width: 36, height: 36, borderRadius: "50%", background: "#f1f5f9", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <ArrowRight size={18} color={SLATE} strokeWidth={2.5} />
          </motion.button>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: SLATE }}>המשמרות שלי ⚡</div>
            <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>2 משמרות השבוע</div>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, background: "#fff", borderBottom: "1px solid #ede9fe", flexShrink: 0 }}>
        {[
          { label: "השבוע", value: "2", sub: "משמרות" },
          { label: "הרוויח", value: "₪470", sub: "השבוע" },
          { label: "דירוג", value: "4.9 ⭐", sub: "ממוצע" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "12px 8px", textAlign: "center", borderLeft: i > 0 ? "1px solid #f1f0fb" : "none" }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: SLATE }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 500 }}>{s.label} {s.sub}</div>
          </div>
        ))}
      </div>

      {/* Shifts list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 24px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: MUTED, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>קרובות</div>
        {SHIFTS.map((shift) => (
          <ShiftCard key={shift.id} shift={shift}
            isApproved={shift.id === "w-1" ? isApproved : false}
            onApprove={shift.id === "w-1" ? onLocalApprove : undefined} />
        ))}

        {/* Level progress */}
        <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #ede9fe", padding: "16px", marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: GOLD }}>🏆 ג׳סטר זהב</span>
            <span style={{ fontSize: 12, color: MUTED }}>72%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "#f1f5f9", overflow: "hidden" }}>
            <motion.div initial={{ width: 0 }} animate={{ width: "72%" }} transition={{ duration: 1.2, ease: [0.25, 0, 0.2, 1] }}
              style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#a78bfa,#fbbf24)" }} />
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>עוד 2 משמרות לג׳סטר מאסטר ⚡</div>
        </div>
      </div>
    </div>
  );
}
