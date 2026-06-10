/**
 * JestaCreateModal — "Create a Jesta" 3-step employer form
 */
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Check, Zap, Rocket, Loader2 } from "lucide-react";
import { createJob } from "../services/api";

const VIOLET   = "#7c3aed";
const VIOLET_D = "#5b21b6";
const VIOLET_L = "#ede9fe";
const GREEN    = "#059669";
const SLATE    = "#0f172a";
const MUTED    = "#64748b";
const BORDER   = "#e2e8f0";
const SURFACE  = "#f8f7ff";

const CATEGORIES = [
  { id: "food",      label: "מזון",       emoji: "🍔" },
  { id: "logistics", label: "לוגיסטיקה",  emoji: "📦" },
  { id: "events",    label: "אירועים",    emoji: "🎉" },
  { id: "fashion",   label: "אופנה",      emoji: "👕" },
  { id: "cleaning",  label: "ניקיון",     emoji: "🧹" },
  { id: "sales",     label: "מכירות",     emoji: "🏷️" },
];

// TODO: replace with real geocoding of the address field (e.g. Google
// Geocoding API or Nominatim) before launch. Until then jobs get a random
// coordinate in the Gush Dan area, so map pins are approximate.
function mockCoords() {
  return { lat: 31.95 + Math.random() * 0.16, lng: 34.74 + Math.random() * 0.10 };
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
                animate={{ background: done ? GREEN : active ? VIOLET : "#e2e8f0", scale: active ? 1.1 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? `0 0 0 4px ${VIOLET_L}` : "none" }}>
                {done
                  ? <Check size={14} color="#fff" strokeWidth={3} />
                  : <span style={{ fontSize: 13, fontWeight: 800, color: active ? "#fff" : MUTED }}>{s.n}</span>
                }
              </motion.div>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? VIOLET : MUTED, whiteSpace: "nowrap" }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ position: "relative", width: 44, height: 2, margin: "0 4px", marginBottom: 18 }}>
                <div style={{ position: "absolute", inset: 0, background: "#e2e8f0", borderRadius: 1 }} />
                <motion.div animate={{ width: step > s.n ? "100%" : "0%" }} transition={{ duration: 0.35, ease: "easeInOut" }}
                  style={{ position: "absolute", left: 0, top: 0, bottom: 0, background: GREEN, borderRadius: 1 }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "11px 13px", borderRadius: 12,
  border: `1.5px solid ${BORDER}`, background: SURFACE,
  fontSize: 14, fontWeight: 500, color: SLATE,
  fontFamily: "inherit", outline: "none", direction: "rtl",
  transition: "border-color 0.15s", boxSizing: "border-box",
};
const labelStyle = { fontSize: 12.5, fontWeight: 700, color: MUTED, marginBottom: 6, display: "block" };

function Field({ label, children }) {
  return <div style={{ marginBottom: 16 }}><label style={labelStyle}>{label}</label>{children}</div>;
}

function Step1({ data, setData }) {
  return (
    <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25, ease: [0.25, 0, 0.2, 1] }}>
      <Field label="כותרת הג׳סטה *">
        <input style={inputStyle} placeholder='לדוגמה: "עוזר בדוכן פופקורן"' value={data.title}
          onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))}
          onFocus={(e) => (e.target.style.borderColor = VIOLET)} onBlur={(e) => (e.target.style.borderColor = BORDER)} />
      </Field>
      <Field label="מה צריך לעשות? (תיאור קצר)">
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "none", lineHeight: 1.55 }}
          placeholder="תאר את המשמרת בקצרה..." value={data.description}
          onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
          onFocus={(e) => (e.target.style.borderColor = VIOLET)} onBlur={(e) => (e.target.style.borderColor = BORDER)} />
      </Field>
      <Field label="קטגוריה *">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {CATEGORIES.map((cat) => {
            const active = data.category === cat.id;
            return (
              <motion.button key={cat.id} whileTap={{ scale: 0.94 }} onClick={() => setData((d) => ({ ...d, category: cat.id }))}
                style={{ padding: "9px 6px", borderRadius: 12, border: `1.5px solid ${active ? VIOLET : BORDER}`, background: active ? VIOLET_L : SURFACE, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "border-color 0.15s, background 0.15s" }}>
                <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                <span style={{ fontSize: 11.5, fontWeight: active ? 800 : 600, color: active ? VIOLET : MUTED }}>{cat.label}</span>
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
          onFocus={(e) => (e.target.style.borderColor = VIOLET)} onBlur={(e) => (e.target.style.borderColor = BORDER)} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>שעת התחלה *</label>
          <input type="time" style={inputStyle} value={data.startTime}
            onChange={(e) => setData((d) => ({ ...d, startTime: e.target.value }))}
            onFocus={(e) => (e.target.style.borderColor = VIOLET)} onBlur={(e) => (e.target.style.borderColor = BORDER)} />
        </div>
        <div>
          <label style={labelStyle}>שעת סיום *</label>
          <input type="time" style={inputStyle} value={data.endTime}
            onChange={(e) => setData((d) => ({ ...d, endTime: e.target.value }))}
            onFocus={(e) => (e.target.style.borderColor = VIOLET)} onBlur={(e) => (e.target.style.borderColor = BORDER)} />
        </div>
      </div>
      <Field label="כתובת העסק / מיקום *">
        <input style={inputStyle} placeholder='לדוגמה: "קניון עזריאלי, תל אביב"' value={data.address}
          onChange={(e) => setData((d) => ({ ...d, address: e.target.value }))}
          onFocus={(e) => (e.target.style.borderColor = VIOLET)} onBlur={(e) => (e.target.style.borderColor = BORDER)} />
      </Field>
      <Field label="שם העסק / המעסיק">
        <input style={inputStyle} placeholder='לדוגמה: "סינמה סיטי", "משפחת לוי"' value={data.employer}
          onChange={(e) => setData((d) => ({ ...d, employer: e.target.value }))}
          onFocus={(e) => (e.target.style.borderColor = VIOLET)} onBlur={(e) => (e.target.style.borderColor = BORDER)} />
      </Field>
    </motion.div>
  );
}

function Step3({ data, setData }) {
  const hours = useMemo(() => {
    if (!data.startTime || !data.endTime) return 6;
    const [sh, sm] = data.startTime.split(":").map(Number);
    const [eh, em] = data.endTime.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 6;
  }, [data.startTime, data.endTime]);
  const total = Math.round(data.hourlyRate * hours);

  return (
    <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25, ease: [0.25, 0, 0.2, 1] }}>
      <Field label={`שכר לשעה: ₪${data.hourlyRate}`}>
        <div style={{ padding: "4px 0 8px" }}>
          <input type="range" min={25} max={150} step={5} value={data.hourlyRate}
            onChange={(e) => setData((d) => ({ ...d, hourlyRate: Number(e.target.value) }))}
            style={{ width: "100%", accentColor: VIOLET, height: 4 }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 10.5, color: MUTED }}>₪25</span>
            <span style={{ fontSize: 10.5, color: MUTED }}>₪150</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {[40, 50, 55, 65, 80, 100].map((v) => (
            <motion.button key={v} whileTap={{ scale: 0.9 }} onClick={() => setData((d) => ({ ...d, hourlyRate: v }))}
              style={{ padding: "5px 12px", borderRadius: 20, fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${data.hourlyRate === v ? VIOLET : BORDER}`, background: data.hourlyRate === v ? VIOLET_L : SURFACE, color: data.hourlyRate === v ? VIOLET : MUTED, transition: "all 0.15s" }}>
              ₪{v}
            </motion.button>
          ))}
        </div>
      </Field>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ borderRadius: 18, background: "linear-gradient(135deg,#4c1d95 0%,#2e1065 100%)", padding: "18px 20px", position: "relative", overflow: "hidden", boxShadow: "0 8px 28px rgba(91,33,182,0.4)" }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle,rgba(167,139,250,0.3) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 12, color: "rgba(196,181,253,0.75)", fontWeight: 600, marginBottom: 10 }}>📊 סיכום המשמרת</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: "rgba(196,181,253,0.8)", fontWeight: 500 }}>שכר לשעה</span>
            <span style={{ fontSize: 13, color: "#e9d5ff", fontWeight: 700 }}>₪{data.hourlyRate}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: "rgba(196,181,253,0.8)", fontWeight: 500 }}>משך המשמרת</span>
            <span style={{ fontSize: 13, color: "#e9d5ff", fontWeight: 700 }}>{hours} שעות</span>
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.1)", marginBottom: 14 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 13, color: "rgba(196,181,253,0.8)", fontWeight: 600 }}>סה״כ מזומן בסוף היום</span>
            <motion.span key={total} initial={{ scale: 1.25 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 22 }}
              style={{ fontSize: 26, fontWeight: 900, color: "#a3e635", lineHeight: 1 }}>₪{total}</motion.span>
          </div>
          <div style={{ marginTop: 10, fontSize: 11.5, color: "rgba(196,181,253,0.6)", fontWeight: 500 }}>💸 ג׳סטרים מקבלים תשלום ישיר בסוף כל משמרת</div>
        </div>
      </motion.div>

      <Field label="הטבות נוספות (אופציונלי)">
        <input style={{ ...inputStyle, marginTop: 8 }} placeholder='לדוגמה: "אוכל כלול", "נסיעות"' value={data.perks}
          onChange={(e) => setData((d) => ({ ...d, perks: e.target.value }))}
          onFocus={(e) => (e.target.style.borderColor = VIOLET)} onBlur={(e) => (e.target.style.borderColor = BORDER)} />
      </Field>
    </motion.div>
  );
}

export default function JestaCreateModal({ isOpen, onClose, onPublish }) {
  const [step,       setStep]       = useState(1);
  const [publishing, setPublishing] = useState(false);
  const [error,      setError]      = useState(null);
  const [data, setData] = useState({
    title: "", description: "", category: null,
    date: "", startTime: "", endTime: "",
    address: "", hourlyRate: 50, perks: "",
  });

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
    setData({ title: "", description: "", category: null, date: "", startTime: "", endTime: "", address: "", hourlyRate: 50, perks: "" });
  };

  const handlePublish = async () => {
    if (publishing) return;
    setError(null);
    setPublishing(true);
    try {
      // TODO: data.category is collected in the UI but the jobs table has no
      // `category` column yet — add one (schema + DTO) to persist it.
      const { lat, lng } = mockCoords();
      // Build ISO datetimes from the date + time fields
      const startTime = new Date(`${data.date}T${data.startTime}:00`).toISOString();
      const endTime   = new Date(`${data.date}T${data.endTime}:00`).toISOString();
      const perks     = data.perks ? data.perks.split(",").map((p) => p.trim()).filter(Boolean) : [];

      const payload = {
        title:       data.title.trim(),
        description: data.description.trim() || undefined,
        pay:         data.hourlyRate,
        address:     data.address.trim(),
        lat, lng,
        startTime,
        endTime,
        perks,
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
          style={{ position: "absolute", inset: 0, zIndex: 6000, background: "rgba(6,3,15,0.72)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <motion.div key="modal" dir="rtl"
            initial={{ scale: 0.9, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: "91%", maxHeight: "86%", zIndex: 6001, background: "#fff", borderRadius: 26, boxShadow: "0 24px 72px rgba(0,0,0,0.55)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif" }}>
            <div style={{ padding: "20px 18px 0", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: SLATE, lineHeight: 1.2 }}>פרסם ג׳סטה חדשה 💼</div>
                  <div style={{ fontSize: 12, color: MUTED, fontWeight: 500, marginTop: 2 }}>שלב {step} מתוך 3</div>
                </div>
                <motion.button whileTap={{ scale: 0.86 }} onClick={onClose}
                  style={{ width: 32, height: 32, borderRadius: "50%", background: "#f1f5f9", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={16} color={MUTED} strokeWidth={2.5} />
                </motion.button>
              </div>
              <StepBar step={step} />
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 8px" }}>
              <AnimatePresence mode="wait">
                {step === 1 && <Step1 key="s1" data={data} setData={setData} />}
                {step === 2 && <Step2 key="s2" data={data} setData={setData} />}
                {step === 3 && <Step3 key="s3" data={data} setData={setData} />}
              </AnimatePresence>
            </div>

            <div style={{ padding: "12px 18px 18px", borderTop: `1px solid ${BORDER}`, flexShrink: 0, background: "#fff" }}>
              {/* Error message */}
              {error && (
                <div style={{ marginBottom: 10, padding: "9px 14px", borderRadius: 12,
                  background: "#fef2f2", border: "1px solid #fecaca",
                  fontSize: 12.5, fontWeight: 600, color: "#dc2626", textAlign: "center" }}>
                  ⚠️ {error}
                </div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                {step > 1 ? (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={handleBack} disabled={publishing}
                    style={{ padding: "12px 16px", borderRadius: 50, border: `1.5px solid ${BORDER}`, background: SURFACE, color: MUTED, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, opacity: publishing ? 0.5 : 1 }}>
                    <ChevronRight size={15} strokeWidth={2.5} /> חזרה
                  </motion.button>
                ) : <div style={{ flex: "0 0 auto" }} />}

                <motion.button
                  whileTap={{ scale: (canProceed && !publishing) ? 0.96 : 1 }}
                  whileHover={(canProceed && !publishing) ? { scale: 1.015 } : {}}
                  onClick={step < 3 ? handleNext : handlePublish}
                  disabled={!canProceed || publishing}
                  style={{ flex: 1, padding: "13px 10px", borderRadius: 50, border: "none", background: (canProceed && !publishing) ? (step < 3 ? "linear-gradient(135deg,#9333ea 0%,#ec4899 100%)" : "linear-gradient(135deg,#7c3aed 0%,#db2777 100%)") : "#e2e8f0", color: (canProceed && !publishing) ? "#fff" : MUTED, fontSize: 15, fontWeight: 900, cursor: (canProceed && !publishing) ? "pointer" : "not-allowed", fontFamily: "inherit", boxShadow: (canProceed && !publishing) ? "0 6px 20px rgba(147,51,234,0.35)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "background 0.2s, box-shadow 0.2s", position: "relative", overflow: "hidden" }}>
                  {step === 3 && canProceed && !publishing && (
                    <motion.div animate={{ left: ["-100%", "200%"] }} transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
                      style={{ position: "absolute", top: 0, width: "45%", height: "100%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)", pointerEvents: "none" }} />
                  )}
                  {publishing
                    ? <><Loader2 size={15} strokeWidth={2} style={{ animation: "spin 0.7s linear infinite" }} /> מפרסם...</>
                    : step < 3
                      ? <> המשך <ChevronLeft size={15} strokeWidth={2.5} /> </>
                      : <> <Rocket size={15} strokeWidth={2} /> פרסם ג׳סטה! 🚀 </>
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
