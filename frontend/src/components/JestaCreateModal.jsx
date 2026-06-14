/**
 * JestaCreateModal — "Create a Jesta" 3-step employer form
 *
 * System 1: "ג'סטה חירום" toggle — only available when the shift starts
 * within 3 hours; the wage is auto-raised by 20% (breakdown shown live).
 *
 * Props:
 *   prefill  optional job-like object (repost flow) — pre-fills every field
 *            except date/time, which must be chosen anew.
 */
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ChevronRight, ChevronLeft, Check, Rocket, Loader2,
  Utensils, Package, PartyPopper, Shirt, Sparkles, Tag, AlertCircle, BarChart3,
  ShieldCheck, Lock, Siren, Bike, Baby, PawPrint, Warehouse,
} from "lucide-react";
import { createJob } from "../services/api";
import JestaLocationField, { geocodeAddress } from "./JestaLocationField";
import { color, radius, shadow, font, styles } from "../design-system";

// Aligned with the worker availability taxonomy (System 2 matching):
// delivery / babysit / events / pets / warehouse map 1:1; the rest match 'other'.
const CATEGORIES = [
  { id: "delivery",  label: "שליחויות",   icon: Bike },
  { id: "babysit",   label: "בייביסיטר",  icon: Baby },
  { id: "events",    label: "אירועים",    icon: PartyPopper },
  { id: "pets",      label: "חיות מחמד",  icon: PawPrint },
  { id: "warehouse", label: "מחסן",       icon: Warehouse },
  { id: "food",      label: "מזון",       icon: Utensils },
  { id: "logistics", label: "לוגיסטיקה",  icon: Package },
  { id: "fashion",   label: "אופנה",      icon: Shirt },
  { id: "cleaning",  label: "ניקיון",     icon: Sparkles },
  { id: "sales",     label: "מכירות",     icon: Tag },
];

const EMERGENCY_WINDOW_MS = 3 * 60 * 60 * 1000;
const EMERGENCY_FACTOR    = 1.2;

/** Date object from the form's date + "HH:MM" fields (null when incomplete) */
function formStartDate(data) {
  if (!data.date || !data.startTime) return null;
  const d = new Date(`${data.date}T${data.startTime}:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** Emergency allowed: shift starts within the next 3 hours (not in the past) */
function emergencyEligible(data) {
  const start = formStartDate(data);
  if (!start) return false;
  const until = start.getTime() - Date.now();
  return until <= EMERGENCY_WINDOW_MS && until > -30 * 60 * 1000;
}


const STEPS = [
  { n: 1, label: "פרטי הג׳סטה" },
  { n: 2, label: "זמן ומיקום"  },
  { n: 3, label: "תקציב"       },
];

function StepBar({ step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 24 }}>
      {STEPS.map((s, i) => {
        const done   = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <motion.div
                animate={{ background: done ? color.success : active ? color.primary : color.surface3, scale: active ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: active ? `0 0 0 4px ${color.primarySoft}` : "none" }}>
                {done
                  ? <Check size={14} color="#fff" strokeWidth={2.5} />
                  : <span style={{ fontSize: 13, fontWeight: 700, color: active ? "#fff" : color.textMuted }}>{s.n}</span>
                }
              </motion.div>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, color: active ? color.primaryText : color.textMuted, whiteSpace: "nowrap" }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ position: "relative", width: 44, height: 2, margin: "0 4px", marginBottom: 16 }}>
                <div style={{ position: "absolute", inset: 0, background: color.surface3, borderRadius: 1 }} />
                <motion.div animate={{ width: step > s.n ? "100%" : "0%" }} transition={{ duration: 0.35, ease: "easeInOut" }}
                  style={{ position: "absolute", left: 0, top: 0, bottom: 0, background: color.success, borderRadius: 1 }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const inputStyle = { ...styles.input, direction: "rtl" };
const labelStyle = { fontSize: 12, fontWeight: 500, color: color.textSecondary, marginBottom: 8, display: "block" };
const focusOn  = (e) => (e.target.style.borderColor = color.primary);
const focusOff = (e) => (e.target.style.borderColor = color.borderSubtle);

function Field({ label, children }) {
  return <div style={{ marginBottom: 16 }}><label style={labelStyle}>{label}</label>{children}</div>;
}

function Step1({ data, setData }) {
  return (
    <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25, ease: [0.25, 0, 0.2, 1] }}>
      <Field label="כותרת הג׳סטה *">
        <input style={inputStyle} placeholder='לדוגמה: "עוזר בדוכן פופקורן"' value={data.title}
          onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))}
          onFocus={focusOn} onBlur={focusOff} />
      </Field>
      <Field label="מה צריך לעשות? (תיאור קצר)">
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "none", lineHeight: 1.6 }}
          placeholder="תאר את המשמרת בקצרה..." value={data.description}
          onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
          onFocus={focusOn} onBlur={focusOff} />
      </Field>
      <Field label="קטגוריה *">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {CATEGORIES.map((cat) => {
            const active = data.category === cat.id;
            const Icon = cat.icon;
            return (
              <motion.button key={cat.id} whileTap={{ scale: 0.96 }} onClick={() => setData((d) => ({ ...d, category: cat.id }))}
                style={{ padding: "12px 8px", borderRadius: radius.input,
                  border: `1px solid ${active ? color.primary : color.borderSubtle}`,
                  background: active ? color.primarySoft : color.surface2,
                  cursor: "pointer", fontFamily: font.family,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  transition: "border-color 0.15s, background 0.15s" }}>
                <Icon size={18} color={active ? color.primaryText : color.textSecondary} strokeWidth={1.75} />
                <span style={{ fontSize: 12, fontWeight: active ? 600 : 500, color: active ? color.primaryText : color.textSecondary }}>{cat.label}</span>
              </motion.button>
            );
          })}
        </div>
      </Field>
    </motion.div>
  );
}

function Step2({ data, setData }) {
  return (
    <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25, ease: [0.25, 0, 0.2, 1] }}>
      <Field label="תאריך המשמרת *">
        <input type="date" style={inputStyle} value={data.date}
          onChange={(e) => setData((d) => ({ ...d, date: e.target.value }))}
          onFocus={focusOn} onBlur={focusOff} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>שעת התחלה *</label>
          <input type="time" style={inputStyle} value={data.startTime}
            onChange={(e) => setData((d) => ({ ...d, startTime: e.target.value }))}
            onFocus={focusOn} onBlur={focusOff} />
        </div>
        <div>
          <label style={labelStyle}>שעת סיום *</label>
          <input type="time" style={inputStyle} value={data.endTime}
            onChange={(e) => setData((d) => ({ ...d, endTime: e.target.value }))}
            onFocus={focusOn} onBlur={focusOff} />
        </div>
      </div>
      <Field label="כתובת העסק / מיקום *">
        {/* Autocomplete + "use my current location"; stores address AND lat/lng */}
        <JestaLocationField
          value={{ address: data.address, lat: data.lat, lng: data.lng }}
          onChange={({ address, lat, lng }) => setData((d) => ({ ...d, address, lat, lng }))}
        />
      </Field>
      <Field label="שם העסק / המעסיק">
        <input style={inputStyle} placeholder='לדוגמה: "סינמה סיטי", "משפחת לוי"' value={data.employer}
          onChange={(e) => setData((d) => ({ ...d, employer: e.target.value }))}
          onFocus={focusOn} onBlur={focusOff} />
      </Field>
    </motion.div>
  );
}

/** "ג'סטה חירום" (System 1): available only when the shift starts within
 *  3 hours. Wage is auto-raised 20% server-side; the breakdown is shown live. */
function EmergencyToggle({ data, setData }) {
  const eligible = emergencyEligible(data);
  const on       = data.isEmergency && eligible;

  return (
    <div style={{ marginTop: 12, borderRadius: radius.card,
      border: `1px solid ${on ? "rgba(248,113,113,0.45)" : color.borderSubtle}`,
      background: on ? color.dangerSoft : color.surface2, padding: "14px 16px",
      opacity: eligible ? 1 : 0.75, transition: "border-color 0.2s, background 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={styles.iconBox(36)}>
          <Siren size={17} color={on ? color.danger : color.textSecondary} strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: color.textPrimary,
            display: "flex", alignItems: "center", gap: 6 }}>
            ג׳סטה חירום
            {!eligible && <Lock size={12} color={color.textMuted} strokeWidth={2} />}
          </div>
          <div style={{ fontSize: 11, color: color.textSecondary, marginTop: 2, lineHeight: 1.5 }}>
            {eligible
              ? "השכר יעלה אוטומטית ב-20%, הג׳סטה תוצמד לראש הפיד וג׳סטרים זמינים יקבלו התראה מיידית"
              : "זמין רק כשמשמרת מתחילה תוך 3 שעות — עדכנו את שעת ההתחלה בשלב הקודם"}
          </div>
        </div>
        <motion.button whileTap={eligible ? { scale: 0.92 } : undefined}
          onClick={() => eligible && setData((d) => ({ ...d, isEmergency: !d.isEmergency }))}
          style={{ width: 44, height: 26, borderRadius: 13, border: "none", flexShrink: 0,
            background: on ? color.danger : color.surface3,
            cursor: eligible ? "pointer" : "not-allowed", position: "relative",
            transition: "background 0.2s" }}>
          <motion.div animate={{ x: on ? -18 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20,
              borderRadius: "50%", background: "#fff" }} />
        </motion.button>
      </div>
    </div>
  );
}

/** "ג'סטה מבוטחת" (System 3): Pro-only toggle. On a no-show the system
 *  auto-runs the fallback replacement flow + flags priority support. */
function InsuranceToggle({ data, setData, isPro }) {
  return (
    <div style={{ marginTop: 16, borderRadius: radius.card,
      border: `1px solid ${data.isInsured ? color.success : color.borderSubtle}`,
      background: color.surface2, padding: "14px 16px",
      opacity: isPro ? 1 : 0.75 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={styles.iconBox(36)}>
          <ShieldCheck size={17} color={data.isInsured ? color.success : color.primaryText} strokeWidth={1.75} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: color.textPrimary,
            display: "flex", alignItems: "center", gap: 6 }}>
            ג׳סטה מבוטחת
            {!isPro && <Lock size={12} color={color.textMuted} strokeWidth={2} />}
          </div>
          <div style={{ fontSize: 11, color: color.textSecondary, marginTop: 2, lineHeight: 1.5 }}>
            {isPro
              ? "אם העובד לא מגיע — מחליף אוטומטי + עדיפות בתמיכה"
              : "שדרג לפרו כדי לבטח את הג׳סטה (מחליף אוטומטי בנו-שואו)"}
          </div>
        </div>
        {/* Switch */}
        <motion.button whileTap={isPro ? { scale: 0.92 } : undefined}
          onClick={() => isPro && setData((d) => ({ ...d, isInsured: !d.isInsured }))}
          style={{ width: 44, height: 26, borderRadius: 13, border: "none", flexShrink: 0,
            background: data.isInsured ? color.success : color.surface3,
            cursor: isPro ? "pointer" : "not-allowed", position: "relative",
            transition: "background 0.2s" }}>
          <motion.div animate={{ x: data.isInsured ? -18 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20,
              borderRadius: "50%", background: "#fff" }} />
        </motion.button>
      </div>
    </div>
  );
}

function Step3({ data, setData, isPro }) {
  const hours = useMemo(() => {
    if (!data.startTime || !data.endTime) return 6;
    const [sh, sm] = data.startTime.split(":").map(Number);
    const [eh, em] = data.endTime.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 6;
  }, [data.startTime, data.endTime]);

  // Emergency wage breakdown (System 1): base + 20% bonus, shown live
  const isEmergencyOn = data.isEmergency && emergencyEligible(data);
  const bonusPerHour  = isEmergencyOn ? Math.round(data.hourlyRate * EMERGENCY_FACTOR) - data.hourlyRate : 0;
  const effectiveRate = data.hourlyRate + bonusPerHour;
  const total = Math.round(effectiveRate * hours);

  return (
    <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25, ease: [0.25, 0, 0.2, 1] }}>
      <Field label={`שכר לשעה: ₪${data.hourlyRate}`}>
        <div style={{ padding: "4px 0 8px" }}>
          <input type="range" min={25} max={150} step={5} value={data.hourlyRate}
            onChange={(e) => setData((d) => ({ ...d, hourlyRate: Number(e.target.value) }))}
            style={{ width: "100%", accentColor: color.primary, height: 4 }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: color.textMuted }}>₪25</span>
            <span style={{ fontSize: 11, color: color.textMuted }}>₪150</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {[40, 50, 55, 65, 80, 100].map((v) => {
            const active = data.hourlyRate === v;
            return (
              <motion.button key={v} whileTap={{ scale: 0.92 }} onClick={() => setData((d) => ({ ...d, hourlyRate: v }))}
                style={{ padding: "8px 12px", borderRadius: radius.chip, fontFamily: font.family,
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${active ? color.primary : color.borderSubtle}`,
                  background: active ? color.primarySoft : color.surface2,
                  color: active ? color.primaryText : color.textSecondary,
                  transition: "all 0.15s" }}>
                ₪{v}
              </motion.button>
            );
          })}
        </div>
      </Field>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ borderRadius: radius.card, background: color.surface2,
          border: `1px solid ${color.borderSubtle}`, padding: "16px 20px",
          boxShadow: shadow.card }}>
        <div style={{ ...font.overline, display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: color.textSecondary }}>
          <BarChart3 size={13} color={color.primaryText} strokeWidth={2} /> סיכום המשמרת
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: color.textSecondary, fontWeight: 400 }}>שכר לשעה</span>
          <span style={{ fontSize: 13, color: color.textPrimary, fontWeight: 600 }}>₪{data.hourlyRate}</span>
        </div>
        {isEmergencyOn && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: color.danger, fontWeight: 500,
                display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Siren size={13} strokeWidth={2} /> בונוס חירום (20%)
              </span>
              <span style={{ fontSize: 13, color: color.danger, fontWeight: 600 }}>+₪{bonusPerHour}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: color.textSecondary, fontWeight: 500 }}>שכר סופי לשעה</span>
              <span style={{ fontSize: 13, color: color.textPrimary, fontWeight: 700 }}>₪{effectiveRate}</span>
            </div>
          </>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: color.textSecondary, fontWeight: 400 }}>משך המשמרת</span>
          <span style={{ fontSize: 13, color: color.textPrimary, fontWeight: 600 }}>{hours} שעות</span>
        </div>
        <div style={{ height: 1, background: color.borderSubtle, marginBottom: 12 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 13, color: color.textSecondary, fontWeight: 500 }}>סה״כ מזומן בסוף היום</span>
          <motion.span key={total} initial={{ scale: 1.2 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            style={{ fontSize: 26, fontWeight: 700, color: color.success, lineHeight: 1, letterSpacing: "-0.02em" }}>₪{total}</motion.span>
        </div>
        <div style={{ marginTop: 12, fontSize: 11, color: color.textMuted, fontWeight: 400 }}>ג׳סטרים מקבלים תשלום ישיר בסוף כל משמרת</div>
      </motion.div>

      <Field label="הטבות נוספות (אופציונלי)">
        <input style={{ ...inputStyle, marginTop: 8 }} placeholder='לדוגמה: "אוכל כלול", "נסיעות"' value={data.perks}
          onChange={(e) => setData((d) => ({ ...d, perks: e.target.value }))}
          onFocus={focusOn} onBlur={focusOff} />
      </Field>

      <EmergencyToggle data={data} setData={setData} />
      <InsuranceToggle data={data} setData={setData} isPro={isPro} />
    </motion.div>
  );
}

const EMPTY_FORM = {
  title: "", description: "", category: null,
  date: "", startTime: "", endTime: "",
  address: "", lat: null, lng: null, hourlyRate: 50, perks: "",
  isInsured: false, isEmergency: false,
};

export default function JestaCreateModal({ isOpen, onClose, onPublish, user = null, prefill = null }) {
  const isPro = !!user?.isPro;
  const [step,       setStep]       = useState(1);
  const [publishing, setPublishing] = useState(false);
  const [error,      setError]      = useState(null);
  const [data, setData] = useState(EMPTY_FORM);

  // Repost flow (System 4): pre-fill everything except date/time — a reposted
  // job must get a fresh shift window.
  useEffect(() => {
    if (!isOpen || !prefill) return;
    setStep(1);
    setData({
      ...EMPTY_FORM,
      title:       prefill.title ?? "",
      description: prefill.description ?? "",
      category:    prefill.category ?? null,
      address:     prefill.address ?? "",
      lat:         prefill.lat ?? null,
      lng:         prefill.lng ?? null,
      hourlyRate:  Math.round(prefill.basePay ?? prefill.pay ?? 50),
      perks:       Array.isArray(prefill.perks) ? prefill.perks.join(", ") : (prefill.perks ?? ""),
    });
  }, [isOpen, prefill]);

  const canProceed = useMemo(() => {
    if (step === 1) return data.title.trim() !== "" && data.category !== null;
    if (step === 2) return data.date !== "" && data.startTime !== "" && data.endTime !== "" && data.address.trim() !== "";
    return true;
  }, [step, data]);

  const handleNext = () => { if (canProceed) setStep((s) => s + 1); };
  const handleBack = () => setStep((s) => s - 1);

  const reset = () => {
    setStep(1);
    setError(null);
    setData(EMPTY_FORM);
  };

  const handlePublish = async () => {
    if (publishing) return;
    setError(null);
    setPublishing(true);
    try {
      // Coordinates: set when the employer picked an autocomplete suggestion or
      // used their current location. If they typed a free-text address instead,
      // forward-geocode it now — a job must never be saved with fake coordinates.
      let { lat, lng } = data;
      if (lat == null || lng == null) {
        const geo = await geocodeAddress(data.address.trim());
        if (!geo) {
          setError("לא הצלחנו לאתר את הכתובת — בחרו כתובת מהרשימה או השתמשו במיקום הנוכחי");
          setPublishing(false);
          return;
        }
        ({ lat, lng } = geo);
      }

      // Build ISO datetimes from the date + time fields
      const startTime = new Date(`${data.date}T${data.startTime}:00`).toISOString();
      const endTime   = new Date(`${data.date}T${data.endTime}:00`).toISOString();
      const perks     = data.perks ? data.perks.split(",").map((p) => p.trim()).filter(Boolean) : [];

      const payload = {
        title:       data.title.trim(),
        description: data.description.trim() || undefined,
        pay:         data.hourlyRate,          // base wage — server adds the 20% emergency bonus
        category:    data.category ?? undefined,
        address:     data.address.trim(),
        lat, lng,
        startTime,
        endTime,
        perks,
        ...(data.isInsured && isPro && { isInsured: true }),
        ...(data.isEmergency && emergencyEligible(data) && { isEmergency: true }),
      };

      const newJob = await createJob(payload);
      onPublish(newJob);   // pass the real API response to App.jsx
      onClose();
      setTimeout(reset, 400);
    } catch (err) {
      setError(err.message ?? "שגיאה בפרסום, נסה שוב");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{ position: "absolute", inset: 0, zIndex: 6000, background: "rgba(10,10,15,0.78)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <motion.div key="modal" dir="rtl"
            initial={{ scale: 0.9, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: "91%", maxHeight: "86%", zIndex: 6001,
              background: color.surface1, borderRadius: radius.sheet,
              border: `1px solid ${color.borderSubtle}`,
              boxShadow: shadow.card,
              display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: font.family }}>
            <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 17, ...font.heading, lineHeight: 1.2 }}>פרסם ג׳סטה חדשה</div>
                  <div style={{ fontSize: 12, color: color.textSecondary, fontWeight: 400, marginTop: 2 }}>שלב {step} מתוך 3</div>
                </div>
                <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
                  style={{ ...styles.iconButton, width: 32, height: 32 }}>
                  <X size={16} color={color.textSecondary} strokeWidth={2} />
                </motion.button>
              </div>
              <StepBar step={step} />
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 8px" }}>
              <AnimatePresence mode="wait">
                {step === 1 && <Step1 key="s1" data={data} setData={setData} />}
                {step === 2 && <Step2 key="s2" data={data} setData={setData} />}
                {step === 3 && <Step3 key="s3" data={data} setData={setData} isPro={isPro} />}
              </AnimatePresence>
            </div>

            <div style={{ padding: "12px 20px 20px", borderTop: `1px solid ${color.borderSubtle}`, flexShrink: 0, background: color.surface1 }}>
              {/* Error message */}
              {error && (
                <div style={{ marginBottom: 12, padding: "8px 16px", borderRadius: radius.input,
                  background: color.surface2, border: `1px solid ${color.borderSubtle}`,
                  fontSize: 12, fontWeight: 500, color: color.danger, textAlign: "center",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <AlertCircle size={14} strokeWidth={2} /> {error}
                </div>
              )}
              <div style={{ display: "flex", gap: 12 }}>
                {step > 1 ? (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleBack} disabled={publishing}
                    style={{ ...styles.buttonSecondary, width: "auto", padding: "0 16px", fontSize: 14,
                      opacity: publishing ? 0.5 : 1 }}>
                    <ChevronRight size={15} strokeWidth={2} /> חזרה
                  </motion.button>
                ) : <div style={{ flex: "0 0 auto" }} />}

                <motion.button
                  whileTap={(canProceed && !publishing) ? { scale: 0.98 } : undefined}
                  whileHover={(canProceed && !publishing) ? { backgroundColor: color.primaryHover } : undefined}
                  onClick={step < 3 ? handleNext : handlePublish}
                  disabled={!canProceed || publishing}
                  style={{
                    ...styles.buttonPrimary, flex: 1, width: "auto",
                    ...(!(canProceed && !publishing) && {
                      background: color.surface3, color: color.textMuted,
                      boxShadow: "none", cursor: "not-allowed",
                    }),
                  }}>
                  {publishing
                    ? <><Loader2 size={15} strokeWidth={2} style={{ animation: "spin 0.7s linear infinite" }} /> מפרסם...</>
                    : step < 3
                      ? <> המשך <ChevronLeft size={15} strokeWidth={2} /> </>
                      : <> <Rocket size={15} strokeWidth={2} /> פרסם ג׳סטה </>
                  }
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
