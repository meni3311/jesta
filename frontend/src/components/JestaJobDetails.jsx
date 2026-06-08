/**
 * JestaJobDetails — Detail screen (clean light mode)
 *
 * Props:
 *   job          the selected job object passed from App.jsx
 *   onBack       navigates back to the feed
 *   onApply      navigates to JestaPending
 *   onOpenProfile opens employer/worker public profile modal
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Share2, Heart, Star, MapPin, Clock,
  Zap, CheckCircle2, Shield, ChevronLeft, ChevronRight,
  Diamond, Trophy, Sparkles, CalendarDays, Banknote,
} from "lucide-react";

// ─── Palette (light mode) ─────────────────────────────────────────────────────
const VIOLET     = "#7c3aed";
const VIOLET_MID = "#7c3aed";
const GOLD       = "#d97706";
const GOLD_LT    = "#fef3c7";
const SLATE      = "#0f172a";
const MUTED      = "#64748b";
const BORDER     = "#ede9fe";

// ─── Hero SVG slides ──────────────────────────────────────────────────────────
const Slides = [
  ({ style }) => (
    <svg viewBox="0 0 360 260" xmlns="http://www.w3.org/2000/svg" style={style}>
      <defs>
        <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1c1033" /><stop offset="100%" stopColor="#2d1b4e" />
        </linearGradient>
        <linearGradient id="popLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <rect width="360" height="260" fill="url(#bg1)" />
      {[0,72,144,216,288].map((x,i)=>(
        <rect key={i} x={x} y="0" width="70" height="160" fill={i%2===0?"#1a0e30":"#1e1238"} />
      ))}
      <rect x="80" y="18" width="200" height="36" rx="8" fill="#2a1550" stroke="#a855f7" strokeWidth="1.5" />
      <text x="180" y="42" textAnchor="middle" fill="#e879f9" fontSize="16" fontWeight="800"
        fontFamily="'Heebo','Segoe UI',system-ui,sans-serif" letterSpacing="2">CINEMA CITY</text>
      {[60,160,260].map((x,i)=>(
        <rect key={i} x={x} y="64" width="70" height="50" rx="4" fill="#150b2a" stroke="#4c1d95" strokeWidth="1" />
      ))}
      <rect x="0" y="155" width="360" height="105" fill="#251040" />
      <rect x="0" y="148" width="360" height="12" rx="2" fill="#4c1d95" />
      {[60,155,250].map((x,i)=>(
        <g key={i}>
          <polygon points={`${x},145 ${x+36},145 ${x+30},195 ${x+6},195`} fill={i===1?"#dc2626":"#ea580c"} />
          <polygon points={`${x},145 ${x+36},145 ${x+33},155 ${x+3},155`} fill={i===1?"#b91c1c":"#c2410c"} />
          <rect x={x+3} y="145" width="30" height="4" rx="2" fill={i===1?"#fca5a5":"#fdba74"} />
          {[0,1,2].map(s=>(
            <line key={s} x1={x+8+s*8} y1="155" x2={x+6+s*8} y2="195" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
          ))}
          {[-4,0,4,-2,2].map((ox,pi)=>(
            <circle key={pi} cx={x+18+ox} cy={138+Math.abs(ox)} r="5" fill="url(#popLight)" opacity="0.9" />
          ))}
        </g>
      ))}
      {[105,200].map((x,i)=>(
        <g key={i}>
          <polygon points={`${x+2},148 ${x+22},148 ${x+18},195 ${x+6},195`} fill={i===0?"#0369a1":"#065f46"} />
          <rect x={x} y="143" width="26" height="7" rx="3" fill="rgba(255,255,255,0.3)" />
          <line x1={x+13} y1="135" x2={x+13} y2="143" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
        </g>
      ))}
    </svg>
  ),

  ({ style }) => (
    <svg viewBox="0 0 360 260" xmlns="http://www.w3.org/2000/svg" style={style}>
      <defs>
        <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fdf4e7" /><stop offset="100%" stopColor="#fce8d5" />
        </linearGradient>
        <linearGradient id="floor2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8d5b8" /><stop offset="100%" stopColor="#d4b896" />
        </linearGradient>
      </defs>
      <rect width="360" height="260" fill="url(#bg2)" />
      <rect x="0" y="185" width="360" height="75" fill="url(#floor2)" />
      {[30,155].map((x,i)=>(
        <g key={i}>
          <line x1={x+10} y1="50" x2={x+10} y2="185" stroke="#b45309" strokeWidth="3" />
          <line x1={x+10} y1="50" x2={x+120} y2="50" stroke="#b45309" strokeWidth="3" />
          <line x1={x+120} y1="50" x2={x+120} y2="185" stroke="#b45309" strokeWidth="3" />
          {["#e11d48","#7c3aed","#059669","#0369a1","#d97706","#1e293b"].map((c,j)=>(
            <path key={j}
              d={`M${x+20+j*16},50 Q${x+28+j*16},60 ${x+18+j*16},80 L${x+20+j*16},185 L${x+32+j*16},185 L${x+34+j*16},80 Q${x+24+j*16},60 ${x+32+j*16},50 Z`}
              fill={c} opacity="0.85" />
          ))}
        </g>
      ))}
      <text x="180" y="35" textAnchor="middle" fill="#92400e" fontSize="18" fontWeight="900"
        fontFamily="'Heebo','Segoe UI',system-ui,sans-serif" letterSpacing="4">URBAN</text>
    </svg>
  ),

  ({ style }) => (
    <svg viewBox="0 0 360 260" xmlns="http://www.w3.org/2000/svg" style={style}>
      <defs>
        <linearGradient id="sky3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfdbfe" /><stop offset="100%" stopColor="#dbeafe" />
        </linearGradient>
        <linearGradient id="grass3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" /><stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <rect width="360" height="260" fill="url(#sky3)" />
      <rect x="0" y="170" width="360" height="90" fill="url(#grass3)" />
      {[30,280].map((x,i)=>(
        <g key={i}>
          <rect x={x+8} y="100" width="10" height="75" fill="#92400e" />
          <ellipse cx={x+13} cy="90" rx="30" ry="40" fill="#15803d" opacity="0.9" />
          <ellipse cx={x+13} cy="78" rx="20" ry="28" fill="#16a34a" />
        </g>
      ))}
      <circle cx="180" cy="118" r="12" fill="#1e293b" />
      <line x1="180" y1="130" x2="180" y2="165" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
      <line x1="180" y1="138" x2="165" y2="152" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
      <line x1="180" y1="138" x2="195" y2="152" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
];

function Divider() {
  return <div style={{ height: 1, background: "#f1f5f9", margin: "18px 0" }} />;
}

function Chip({ icon: Icon, color = MUTED, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569", fontWeight: 500 }}>
      <Icon size={14} color={color} strokeWidth={2} />
      {children}
    </div>
  );
}

export default function JestaJobDetails({ job, onBack, onApply, onOpenProfile }) {
  const initialSlide = job?.slideIndex ?? 0;
  const [slide, setSlide] = useState(initialSlide);
  const [saved, setSaved] = useState(false);

  const prevSlide = () => setSlide((s) => (s - 1 + Slides.length) % Slides.length);
  const nextSlide = () => setSlide((s) => (s + 1) % Slides.length);
  const SlideComp = Slides[slide];

  const title    = job?.title    ?? "עוזר בדוכן פופקורן ושתייה";
  const employer = job?.employer ?? "סינמה סיטי";
  const pay      = job?.pay      ?? "₪55";
  const payRaw   = job?.payRaw   ?? 55;
  const time     = job?.time     ?? "היום, 16:00–22:00";
  const dist     = job?.dist     ?? "700 מטר ממך";

  return (
    <div dir="rtl" style={{ fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif", width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#fff" }}>
      {/* Hero */}
      <div style={{ position: "relative", height: 268, flexShrink: 0 }}>
        <AnimatePresence mode="wait">
          <motion.div key={slide} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} style={{ position: "absolute", inset: 0 }}>
            <SlideComp style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </motion.div>
        </AnimatePresence>
        <div style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 36, background: "#fff", borderRadius: "32px 32px 0 0", zIndex: 5 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.38) 0%, transparent 45%, rgba(0,0,0,0.18) 100%)", zIndex: 2 }} />
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          style={{ position: "absolute", top: 48, right: 14, zIndex: 10, width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.92)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
          <ArrowRight size={18} color={SLATE} strokeWidth={2.5} />
        </motion.button>
        <div style={{ position: "absolute", top: 48, left: 14, zIndex: 10, display: "flex", gap: 8 }}>
          {[
            { Icon: Share2, action: () => {} },
            { Icon: Heart,  action: () => setSaved((s) => !s), fill: saved },
          ].map(({ Icon, action, fill }, i) => (
            <motion.button key={i} whileTap={{ scale: 0.88 }} onClick={action}
              style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.92)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
              <Icon size={16} strokeWidth={2} color={fill ? "#e11d48" : SLATE} fill={fill ? "#e11d48" : "none"} />
            </motion.button>
          ))}
        </div>
        <button onClick={prevSlide} style={{ position: "absolute", top: "50%", right: 10, zIndex: 10, transform: "translateY(-50%)", width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.75)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronRight size={16} color={SLATE} />
        </button>
        <button onClick={nextSlide} style={{ position: "absolute", top: "50%", left: 10, zIndex: 10, transform: "translateY(-50%)", width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.75)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ChevronLeft size={16} color={SLATE} />
        </button>
        <div style={{ position: "absolute", bottom: 44, left: "50%", zIndex: 10, transform: "translateX(-50%)", display: "flex", gap: 5 }}>
          {Slides.map((_, i) => (
            <div key={i} onClick={() => setSlide(i)} style={{ width: i === slide ? 16 : 6, height: 6, borderRadius: 3, background: i === slide ? "#fff" : "rgba(255,255,255,0.45)", cursor: "pointer", transition: "width 0.2s" }} />
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
        <div style={{ padding: "6px 20px 108px" }}>
          <h1 style={{ fontSize: 21, fontWeight: 800, color: SLATE, lineHeight: 1.3, margin: "0 0 4px" }}>{title}</h1>
          <div style={{ fontSize: 13.5, color: MUTED, fontWeight: 500, marginBottom: 14 }}>משרה זמנית &bull; {employer}, ראשון לציון</div>

          {/* Rating banner */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr", border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden", marginBottom: 18 }}>
            <div style={{ padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: SLATE }}>292</div>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 500, marginTop: 2 }}>ביקורות נוער</div>
            </div>
            <div style={{ background: BORDER }} />
            <div style={{ padding: "10px 6px", textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 3, background: GOLD_LT, borderRadius: 8, padding: "3px 7px", marginBottom: 3 }}>
                <Zap size={11} fill={GOLD} color={GOLD} />
                <span style={{ fontSize: 10, fontWeight: 800, color: GOLD }}>ג׳סטר מובחר</span>
              </div>
              <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 500 }}>מועדף על נוער</div>
            </div>
            <div style={{ background: BORDER }} />
            <div style={{ padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: SLATE }}>4.95</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 1, marginTop: 3 }}>
                {[1,2,3,4,5].map((s) => <Star key={s} size={9} fill={GOLD} color={GOLD} />)}
              </div>
            </div>
          </div>

          <Divider />

          {/* Employer */}
          <div style={{ marginBottom: 6 }}>
            <motion.div whileTap={{ scale: 0.98 }}
              onClick={() => onOpenProfile?.("employer", { name: `אורן / ${employer}`, business: employer })}
              style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12, cursor: "pointer" }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #a78bfa, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: "2.5px solid #ede9fe", boxShadow: "0 4px 16px rgba(124,58,237,0.2)" }}>👨‍💼</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: SLATE, lineHeight: 1.3 }}>באירוח של אורן / {employer}</div>
                <div style={{ fontSize: 12.5, color: MUTED, fontWeight: 500, marginTop: 2 }}>מעסיק מצטיין &bull; 3 שנים בג׳סטה</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 5 }}>
                  <CheckCircle2 size={12} color="#059669" strokeWidth={2.5} />
                  <span style={{ fontSize: 11.5, color: "#059669", fontWeight: 700 }}>זהות מאומתת</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: VIOLET, fontWeight: 700, background: "#ede9fe", padding: "4px 9px", borderRadius: 20, flexShrink: 0 }}>פרופיל ›</div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, background: GOLD_LT, borderRadius: 14, padding: "11px 13px", border: "1px solid #fde68a" }}>
              <Trophy size={18} color={GOLD} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: "#92400e", fontWeight: 500, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 800 }}>ב-5% מהמעסיקים המובילים — </span>
                המקום הזה מוגדר כסביבת עבודה בטוחה, הוגנת ומתגמלת לנוער.
              </div>
            </motion.div>
          </div>

          <Divider />

          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: SLATE, marginBottom: 12 }}>פרטי המשמרת</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Chip icon={Clock}        color={VIOLET_MID}>{time} &bull; 6 שעות</Chip>
              <Chip icon={MapPin}       color={VIOLET_MID}>{employer} &bull; {dist}</Chip>
              <Chip icon={CalendarDays} color={VIOLET_MID}>משמרת חד-פעמית &bull; אפשרות לחזרה</Chip>
              <Chip icon={Banknote}     color={VIOLET_MID}>{pay} לשעה &bull; מזומן בסוף המשמרת</Chip>
            </div>
          </div>

          <Divider />

          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: SLATE, marginBottom: 10 }}>מה תעשה/י במשמרת?</div>
            <div style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.7, fontWeight: 400 }}>
              לעמוד בדוכן הפופקורן ועמדת השתייה, להגיש ללקוחות, לשמור על ניקיון העמדה ולספק חוויית קנייה נהדרת.
              אין צורך בניסיון — אנחנו מלמדים הכל בהתחלה! 🍿
            </div>
          </div>

          <Divider />

          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: SLATE, marginBottom: 10 }}>מה כלול?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {[
                { icon: CheckCircle2, color: "#059669", text: "אוכל כלול במהלך המשמרת 🍕" },
                { icon: CheckCircle2, color: "#059669", text: "תשלום מזומן בסוף המשמרת 💸" },
                { icon: Shield,       color: VIOLET_MID, text: "סביבת עבודה בטוחה ומפוקחת" },
                { icon: Sparkles,     color: GOLD,       text: "אפשרות להפוך לג׳סטר קבוע" },
              ].map(({ icon: Icon, color, text }, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#334155", fontWeight: 500 }}>
                  <Icon size={15} color={color} strokeWidth={2} style={{ flexShrink: 0 }} />
                  {text}
                </div>
              ))}
            </div>
          </div>

          <Divider />

          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.4 }}
            style={{ display: "flex", alignItems: "center", gap: 12, background: "#f0fdf4", borderRadius: 14, padding: "13px 14px", border: "1px solid #bbf7d0" }}>
            <Diamond size={20} color="#059669" strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: "#065f46", fontWeight: 500, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 800 }}>מציאה אמיתית! </span>
              העבודה הזו בדרך כלל נתפסת תוך פחות מ-10 דקות.
            </div>
          </motion.div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 30, delay: 0.12 }}
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 50,
          background: "#fff", borderTop: "1px solid #f1f5f9",
          boxShadow: "0 -4px 24px rgba(124,58,237,0.08)",
          padding: "12px 18px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontSize: 19, fontWeight: 900, color: SLATE }}>{pay}</span>
            <span style={{ fontSize: 12.5, color: MUTED, fontWeight: 500 }}> / לשעה</span>
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 500, marginTop: 1 }}>₪{payRaw * 6} סה״כ למשמרת &bull; היום</div>
          <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 4 }}>
            <CheckCircle2 size={11} color="#059669" strokeWidth={2.5} />
            <span style={{ fontSize: 10.5, color: "#059669", fontWeight: 600 }}>ביטול ללא קנס עד שעתיים לפני</span>
          </div>
        </div>

        {/* CTA with shimmer */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.02 }}
          onClick={() => onApply?.(job)}
          style={{
            flex: 1, padding: "14px 10px", borderRadius: 50, border: "none",
            background: "linear-gradient(135deg, #9333ea 0%, #ec4899 100%)",
            color: "#fff", fontSize: 15.5, fontWeight: 900,
            cursor: "pointer", fontFamily: "inherit", letterSpacing: 0.2,
            boxShadow: "0 6px 22px rgba(147,51,234,0.38)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            position: "relative", overflow: "hidden",
          }}
        >
          {/* Repeating shimmer sweep */}
          <motion.div
            aria-hidden="true"
            style={{
              position: "absolute", top: 0, left: 0,
              width: "45%", height: "100%",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)",
              transform: "skewX(-18deg)",
              pointerEvents: "none",
            }}
            animate={{ left: ["-50%", "160%"] }}
            transition={{ duration: 1.3, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
          />
          <span style={{ display: "flex", alignItems: "center", gap: 6, position: "relative", zIndex: 1 }}>
            <Zap size={15} fill="#facc15" color="#facc15" /> אני בפנים!
          </span>
        </motion.button>
      </motion.div>
    </div>
  );
}
