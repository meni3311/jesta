/**
 * JestaJobDetails — Detail screen (dark design system)
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
import { color, radius, shadow, font, styles } from "../design-system";
import { Avatar, Badge } from "./ui";

// ─── Hero SVG slides (illustrations — exempt from UI color tokens) ───────────
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
          <stop offset="0%" stopColor="#1c1c26" /><stop offset="100%" stopColor="#242432" />
        </linearGradient>
        <linearGradient id="floor2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2a38" /><stop offset="100%" stopColor="#1c1c26" />
        </linearGradient>
      </defs>
      <rect width="360" height="260" fill="url(#bg2)" />
      <rect x="0" y="185" width="360" height="75" fill="url(#floor2)" />
      {[30,155].map((x,i)=>(
        <g key={i}>
          <line x1={x+10} y1="50" x2={x+10} y2="185" stroke="#4c4c66" strokeWidth="3" />
          <line x1={x+10} y1="50" x2={x+120} y2="50" stroke="#4c4c66" strokeWidth="3" />
          <line x1={x+120} y1="50" x2={x+120} y2="185" stroke="#4c4c66" strokeWidth="3" />
          {["#e11d48","#7c3aed","#059669","#0369a1","#d97706","#64748b"].map((c,j)=>(
            <path key={j}
              d={`M${x+20+j*16},50 Q${x+28+j*16},60 ${x+18+j*16},80 L${x+20+j*16},185 L${x+32+j*16},185 L${x+34+j*16},80 Q${x+24+j*16},60 ${x+32+j*16},50 Z`}
              fill={c} opacity="0.85" />
          ))}
        </g>
      ))}
      <text x="180" y="35" textAnchor="middle" fill="#94a3b8" fontSize="18" fontWeight="900"
        fontFamily="'Heebo','Segoe UI',system-ui,sans-serif" letterSpacing="4">URBAN</text>
    </svg>
  ),

  ({ style }) => (
    <svg viewBox="0 0 360 260" xmlns="http://www.w3.org/2000/svg" style={style}>
      <defs>
        <linearGradient id="sky3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#13131a" /><stop offset="100%" stopColor="#1e1e3a" />
        </linearGradient>
        <linearGradient id="grass3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14532d" /><stop offset="100%" stopColor="#052e16" />
        </linearGradient>
      </defs>
      <rect width="360" height="260" fill="url(#sky3)" />
      <rect x="0" y="170" width="360" height="90" fill="url(#grass3)" />
      {[30,280].map((x,i)=>(
        <g key={i}>
          <rect x={x+8} y="100" width="10" height="75" fill="#3f2d20" />
          <ellipse cx={x+13} cy="90" rx="30" ry="40" fill="#14532d" opacity="0.9" />
          <ellipse cx={x+13} cy="78" rx="20" ry="28" fill="#166534" />
        </g>
      ))}
      <circle cx="180" cy="118" r="12" fill="#94a3b8" />
      <line x1="180" y1="130" x2="180" y2="165" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
      <line x1="180" y1="138" x2="165" y2="152" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      <line x1="180" y1="138" x2="195" y2="152" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
];

function Divider() {
  return <div style={{ height: 1, background: color.borderSubtle, margin: "20px 0" }} />;
}

function Chip({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: color.textSecondary, fontWeight: 400 }}>
      <Icon size={14} color={color.primaryText} strokeWidth={1.75} />
      {children}
    </div>
  );
}

const heroButton = {
  width: 36, height: 36, borderRadius: "50%",
  background: "rgba(19,19,26,0.85)",
  border: `1px solid ${color.borderStrong}`,
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};

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
    <div dir="rtl" style={{ ...styles.screen }}>
      {/* Hero */}
      <div style={{ position: "relative", height: 268, flexShrink: 0 }}>
        <AnimatePresence mode="wait">
          <motion.div key={slide} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} style={{ position: "absolute", inset: 0 }}>
            <SlideComp style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </motion.div>
        </AnimatePresence>
        <div style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 36, background: color.bg, borderRadius: `${radius.sheet}px ${radius.sheet}px 0 0`, zIndex: 5 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(10,10,15,0.5) 0%, transparent 45%, rgba(10,10,15,0.3) 100%)", zIndex: 2 }} />
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          style={{ ...heroButton, position: "absolute", top: 48, insetInlineStart: 16, zIndex: 10 }}>
          <ArrowRight size={18} color={color.textPrimary} strokeWidth={2} />
        </motion.button>
        <div style={{ position: "absolute", top: 48, insetInlineEnd: 16, zIndex: 10, display: "flex", gap: 8 }}>
          {[
            { Icon: Share2, action: () => {} },
            { Icon: Heart,  action: () => setSaved((s) => !s), fill: saved },
          ].map(({ Icon, action, fill }, i) => (
            <motion.button key={i} whileTap={{ scale: 0.9 }} onClick={action}
              style={heroButton}>
              <Icon size={16} strokeWidth={1.75} color={fill ? color.danger : color.textPrimary} fill={fill ? color.danger : "none"} />
            </motion.button>
          ))}
        </div>
        <button onClick={prevSlide} style={{ ...heroButton, width: 28, height: 28, position: "absolute", top: "50%", right: 12, zIndex: 10, transform: "translateY(-50%)" }}>
          <ChevronRight size={16} color={color.textPrimary} />
        </button>
        <button onClick={nextSlide} style={{ ...heroButton, width: 28, height: 28, position: "absolute", top: "50%", left: 12, zIndex: 10, transform: "translateY(-50%)" }}>
          <ChevronLeft size={16} color={color.textPrimary} />
        </button>
        <div style={{ position: "absolute", bottom: 44, left: "50%", zIndex: 10, transform: "translateX(-50%)", display: "flex", gap: 4 }}>
          {Slides.map((_, i) => (
            <div key={i} onClick={() => setSlide(i)} style={{ width: i === slide ? 16 : 6, height: 6, borderRadius: 3, background: i === slide ? color.textPrimary : color.borderStrong, cursor: "pointer", transition: "width 0.2s" }} />
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", background: color.bg }}>
        <div style={{ padding: "8px 20px 108px" }}>
          <h1 style={{ fontSize: 21, ...font.heading, lineHeight: 1.3, margin: "0 0 4px" }}>{title}</h1>
          <div style={{ fontSize: 13, color: color.textSecondary, fontWeight: 400, marginBottom: 16 }}>משרה זמנית &bull; {employer}, ראשון לציון</div>

          {/* Rating banner */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr", background: color.surface1, border: `1px solid ${color.borderSubtle}`, borderRadius: radius.card, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: color.textPrimary }}>292</div>
              <div style={{ fontSize: 11, color: color.textSecondary, fontWeight: 400, marginTop: 4 }}>ביקורות נוער</div>
            </div>
            <div style={{ background: color.borderSubtle }} />
            <div style={{ padding: "12px 8px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <Badge variant="primary" icon={Zap}>ג׳סטר מובחר</Badge>
              <div style={{ fontSize: 11, color: color.textSecondary, fontWeight: 400 }}>מועדף על נוער</div>
            </div>
            <div style={{ background: color.borderSubtle }} />
            <div style={{ padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: color.textPrimary }}>4.95</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 4 }}>
                {[1,2,3,4,5].map((s) => <Star key={s} size={9} fill={color.warning} color={color.warning} />)}
              </div>
            </div>
          </div>

          <Divider />

          {/* Employer */}
          <div style={{ marginBottom: 8 }}>
            <motion.div whileTap={{ scale: 0.98 }}
              onClick={() => onOpenProfile?.("employer", { name: `אורן / ${employer}`, business: employer })}
              style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12, cursor: "pointer" }}>
              <Avatar size={52} employer />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: color.textPrimary, lineHeight: 1.3 }}>באירוח של אורן / {employer}</div>
                <div style={{ fontSize: 12, color: color.textSecondary, fontWeight: 400, marginTop: 2 }}>מעסיק מצטיין &bull; 3 שנים בג׳סטה</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <CheckCircle2 size={12} color={color.success} strokeWidth={2} />
                  <span style={{ fontSize: 11, color: color.success, fontWeight: 500 }}>זהות מאומתת</span>
                </div>
              </div>
              <Badge variant="primary">פרופיל</Badge>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
              style={{ display: "flex", alignItems: "flex-start", gap: 12, background: color.surface1, borderRadius: radius.input, padding: "12px 16px", border: `1px solid ${color.borderSubtle}` }}>
              <Trophy size={18} color={color.warning} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12, color: color.textSecondary, fontWeight: 400, lineHeight: 1.6 }}>
                <span style={{ fontWeight: 600, color: color.textPrimary }}>ב-5% מהמעסיקים המובילים — </span>
                המקום הזה מוגדר כסביבת עבודה בטוחה, הוגנת ומתגמלת לנוער.
              </div>
            </motion.div>
          </div>

          <Divider />

          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: color.textPrimary, marginBottom: 12 }}>פרטי המשמרת</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Chip icon={Clock}>{time} &bull; 6 שעות</Chip>
              <Chip icon={MapPin}>{employer} &bull; {dist}</Chip>
              <Chip icon={CalendarDays}>משמרת חד-פעמית &bull; אפשרות לחזרה</Chip>
              <Chip icon={Banknote}>{pay} לשעה &bull; מזומן בסוף המשמרת</Chip>
            </div>
          </div>

          <Divider />

          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: color.textPrimary, marginBottom: 8 }}>מה תעשה/י במשמרת?</div>
            <div style={{ fontSize: 13, ...font.body }}>
              לעמוד בדוכן הפופקורן ועמדת השתייה, להגיש ללקוחות, לשמור על ניקיון העמדה ולספק חוויית קנייה נהדרת.
              אין צורך בניסיון — אנחנו מלמדים הכל בהתחלה!
            </div>
          </div>

          <Divider />

          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: color.textPrimary, marginBottom: 12 }}>מה כלול?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: CheckCircle2, iconColor: color.success,     text: "אוכל כלול במהלך המשמרת" },
                { icon: CheckCircle2, iconColor: color.success,     text: "תשלום מזומן בסוף המשמרת" },
                { icon: Shield,       iconColor: color.primaryText, text: "סביבת עבודה בטוחה ומפוקחת" },
                { icon: Sparkles,     iconColor: color.primaryText, text: "אפשרות להפוך לג׳סטר קבוע" },
              ].map(({ icon: Icon, iconColor, text }, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: color.textSecondary, fontWeight: 400 }}>
                  <Icon size={15} color={iconColor} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                  {text}
                </div>
              ))}
            </div>
          </div>

          <Divider />

          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.4 }}
            style={{ display: "flex", alignItems: "center", gap: 12, background: color.successSoft, borderRadius: radius.input, padding: "12px 16px", border: `1px solid ${color.borderSubtle}` }}>
            <Diamond size={20} color={color.success} strokeWidth={1.75} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 13, color: color.textSecondary, fontWeight: 400, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 600, color: color.success }}>מציאה אמיתית! </span>
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
          background: color.surface1, borderTop: `1px solid ${color.borderSubtle}`,
          padding: "12px 20px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 19, fontWeight: 700, color: color.textPrimary, letterSpacing: "-0.02em" }}>{pay}</span>
            <span style={{ fontSize: 12, color: color.textSecondary, fontWeight: 400 }}> / לשעה</span>
          </div>
          <div style={{ fontSize: 11, color: color.textSecondary, fontWeight: 400, marginTop: 2 }}>₪{payRaw * 6} סה״כ למשמרת &bull; היום</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
            <CheckCircle2 size={11} color={color.success} strokeWidth={2} />
            <span style={{ fontSize: 11, color: color.success, fontWeight: 500 }}>ביטול ללא קנס עד שעתיים לפני</span>
          </div>
        </div>

        {/* Hero CTA — the single primary action */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ backgroundColor: color.primaryHover }}
          onClick={() => onApply?.(job)}
          style={{ ...styles.buttonPrimary, flex: 1, width: "auto" }}
        >
          <Zap size={16} color="#fff" strokeWidth={2} /> אני בפנים!
        </motion.button>
      </motion.div>
    </div>
  );
}
