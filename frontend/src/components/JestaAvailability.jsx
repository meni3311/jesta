/**
 * JestaAvailability — weekly availability setup screen (System 2)
 *
 * Full-screen flow reached from the sidebar:
 *   • Weekly grid: 7 days × 2-hour blocks — tap to toggle available hours
 *   • Minimum wage slider
 *   • Category preferences (multi-select):
 *     שליחויות / בייביסיטר / אירועים / חיות מחמד / מחסן / אחר
 *   • Toggle: "פתוח להצעות עבודה ישירות מפרו"
 *
 * Persists via PUT /api/users/availability (replaces all rows atomically).
 *
 * Props:
 *   onBack()
 *   onSaved(profile)  — notify App so the sidebar indicator updates
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, CalendarCheck, Loader2, CheckCircle2, AlertCircle,
  Bike, Baby, PartyPopper, PawPrint, Warehouse, Shapes, Sparkles, Banknote,
} from "lucide-react";
import { getMyAvailability, saveAvailability } from "../services/api";
import { color, radius, font, styles } from "../design-system";

// 0 = Sunday … 6 = Saturday (matches the DB convention)
const DAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

// 2-hour blocks, 08:00 → 24:00
const BLOCKS = [
  ["08:00", "10:00"], ["10:00", "12:00"], ["12:00", "14:00"], ["14:00", "16:00"],
  ["16:00", "18:00"], ["18:00", "20:00"], ["20:00", "22:00"], ["22:00", "24:00"],
];

// Worker category taxonomy (System 2 spec)
const CATEGORIES = [
  { id: "delivery",  label: "שליחויות",  icon: Bike },
  { id: "babysit",   label: "בייביסיטר", icon: Baby },
  { id: "events",    label: "אירועים",   icon: PartyPopper },
  { id: "pets",      label: "חיות מחמד", icon: PawPrint },
  { id: "warehouse", label: "מחסן",      icon: Warehouse },
  { id: "other",     label: "אחר",       icon: Shapes },
];

const cellKey = (day, blockIdx) => `${day}:${blockIdx}`;

export default function JestaAvailability({ onBack, onSaved }) {
  const [selected,       setSelected]       = useState(() => new Set());
  const [minWage,        setMinWage]        = useState(40);
  const [categories,     setCategories]     = useState([]);
  const [isOpenToOffers, setIsOpenToOffers] = useState(true);
  const [status,         setStatus]         = useState("loading"); // loading | ok | error
  const [saving,         setSaving]         = useState(false);
  const [savedFlash,     setSavedFlash]     = useState(false);
  const [error,          setError]          = useState(null);

  // Load the existing profile
  useEffect(() => {
    let cancelled = false;
    getMyAvailability()
      .then((profile) => {
        if (cancelled) return;
        const next = new Set();
        for (const s of profile.slots ?? []) {
          const idx = BLOCKS.findIndex(([st]) => st === s.startTime);
          if (idx !== -1) next.add(cellKey(s.dayOfWeek, idx));
        }
        setSelected(next);
        setMinWage(profile.minWage ?? 40);
        setCategories(profile.categories ?? []);
        setIsOpenToOffers(profile.isOpenToOffers ?? true);
        setStatus("ok");
      })
      .catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const toggleCell = useCallback((day, blockIdx) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = cellKey(day, blockIdx);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleCategory = useCallback((id) => {
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }, []);

  const slotCount = selected.size;
  const slots = useMemo(() =>
    [...selected].map((key) => {
      const [day, blockIdx] = key.split(":").map(Number);
      const [startTime, endTime] = BLOCKS[blockIdx];
      return { dayOfWeek: day, startTime, endTime };
    }), [selected]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true); setError(null);
    try {
      const profile = await saveAvailability({ slots, minWage, categories, isOpenToOffers });
      onSaved?.(profile);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2200);
    } catch (err) {
      setError(err.message ?? "השמירה נכשלה, נסו שוב");
    } finally {
      setSaving(false);
    }
  }, [saving, slots, minWage, categories, isOpenToOffers, onSaved]);

  return (
    <div dir="rtl" style={styles.screen}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ background: color.surface1, padding: "48px 20px 16px",
        borderBottom: `1px solid ${color.borderSubtle}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} style={styles.iconButton}>
            <ArrowRight size={18} color={color.textPrimary} strokeWidth={2} />
          </motion.button>
          <div>
            <div style={{ fontSize: 20, ...font.heading, display: "flex", alignItems: "center", gap: 8 }}>
              הזמינות שלי <CalendarCheck size={17} color={color.primaryText} strokeWidth={1.75} />
            </div>
            <div style={{ fontSize: 12, color: color.textSecondary, fontWeight: 400, marginTop: 2 }}>
              סמנו מתי אתם פנויים — מעסיקי פרו ישלחו לכם הצעות אישיות
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 24px" }}>
        {status === "loading" && (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <Loader2 size={26} color={color.primary} style={{ animation: "spin 0.7s linear infinite" }} />
          </div>
        )}

        {status === "error" && (
          <div style={{ textAlign: "center", padding: "32px 20px", fontSize: 13,
            color: color.danger, fontWeight: 500 }}>
            שגיאה בטעינת הזמינות. נסו שוב מאוחר יותר.
          </div>
        )}

        {status === "ok" && (
          <>
            {/* ── Weekly grid: 7 days × 2h blocks ── */}
            <div style={{ ...styles.card, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "grid",
                gridTemplateColumns: `44px repeat(${DAYS.length}, 1fr)`, gap: 4 }}>
                {/* Header row */}
                <div />
                {DAYS.map((d) => (
                  <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700,
                    color: color.textSecondary, paddingBottom: 4 }}>{d}</div>
                ))}
                {/* Block rows */}
                {BLOCKS.map(([start], blockIdx) => (
                  <FragmentRow key={start}
                    label={start}
                    cells={DAYS.map((_, day) => ({
                      on: selected.has(cellKey(day, blockIdx)),
                      onTap: () => toggleCell(day, blockIdx),
                    }))} />
                ))}
              </div>
              <div style={{ fontSize: 10, color: color.textMuted, marginTop: 10, textAlign: "center" }}>
                {slotCount > 0
                  ? `${slotCount} משבצות של שעתיים נבחרו`
                  : "הקישו על משבצת כדי לסמן שאתם פנויים בשעות האלה"}
              </div>
            </div>

            {/* ── Minimum wage slider ── */}
            <div style={{ ...styles.card, padding: 16, marginBottom: 16 }}>
              <div style={{ ...font.overline, display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Banknote size={13} color={color.primaryText} strokeWidth={2} /> שכר מינימלי לשעה
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: color.textMuted }}>₪30</span>
                <motion.span key={minWage} initial={{ scale: 1.15 }} animate={{ scale: 1 }}
                  style={{ fontSize: 16, fontWeight: 700, color: color.primaryText }}>₪{minWage}</motion.span>
                <span style={{ fontSize: 11, color: color.textMuted }}>₪120</span>
              </div>
              <input type="range" min={30} max={120} step={5} value={minWage}
                onChange={(e) => setMinWage(Number(e.target.value))}
                style={{ width: "100%", accentColor: color.primary, height: 4 }} />
              <div style={{ fontSize: 10, color: color.textMuted, marginTop: 8 }}>
                תקבלו הצעות רק לג׳סטות שמשלמות ₪{minWage}+ לשעה
              </div>
            </div>

            {/* ── Category preferences ── */}
            <div style={{ ...styles.card, padding: 16, marginBottom: 16 }}>
              <div style={{ ...font.overline, marginBottom: 10 }}>סוגי עבודות שמתאימים לי</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {CATEGORIES.map(({ id, label, icon: Icon }) => {
                  const active = categories.includes(id);
                  return (
                    <motion.button key={id} whileTap={{ scale: 0.95 }} onClick={() => toggleCategory(id)}
                      style={{ padding: "10px 6px", borderRadius: radius.input,
                        border: `1px solid ${active ? color.primary : color.borderSubtle}`,
                        background: active ? color.primarySoft : color.surface2,
                        cursor: "pointer", fontFamily: font.family,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <Icon size={16} color={active ? color.primaryText : color.textSecondary} strokeWidth={1.75} />
                      <span style={{ fontSize: 11, fontWeight: active ? 700 : 500,
                        color: active ? color.primaryText : color.textSecondary }}>{label}</span>
                    </motion.button>
                  );
                })}
              </div>
              <div style={{ fontSize: 10, color: color.textMuted, marginTop: 10 }}>
                לא בחרתם כלום? תקבלו הצעות מכל הקטגוריות
              </div>
            </div>

            {/* ── Open to direct offers toggle ── */}
            <div style={{ ...styles.card, padding: "14px 16px", marginBottom: 20,
              border: `1px solid ${isOpenToOffers ? color.primary : color.borderSubtle}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={styles.iconBox(36)}>
                  <Sparkles size={17} color={isOpenToOffers ? color.primaryText : color.textSecondary} strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: color.textPrimary }}>
                    פתוח להצעות עבודה ישירות מפרו
                  </div>
                  <div style={{ fontSize: 11, color: color.textSecondary, marginTop: 2, lineHeight: 1.5 }}>
                    מעסיקים עם מנוי פרו יוכלו למצוא אתכם ולשלוח הצעה אישית
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.92 }}
                  onClick={() => setIsOpenToOffers((v) => !v)}
                  style={{ width: 44, height: 26, borderRadius: 13, border: "none", flexShrink: 0,
                    background: isOpenToOffers ? color.primary : color.surface3,
                    cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                  <motion.div animate={{ x: isOpenToOffers ? -18 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20,
                      borderRadius: "50%", background: "#fff" }} />
                </motion.button>
              </div>
            </div>

            {error && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                fontSize: 12, color: color.danger, fontWeight: 500, marginBottom: 12 }}>
                <AlertCircle size={14} strokeWidth={2} /> {error}
              </div>
            )}

            {/* ── Save ── */}
            <motion.button whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving}
              style={{ ...styles.buttonPrimary,
                ...(savedFlash && { background: color.success, boxShadow: "none" }) }}>
              {saving
                ? <Loader2 size={16} color="#fff" style={{ animation: "spin 0.7s linear infinite" }} />
                : savedFlash
                ? <><CheckCircle2 size={16} strokeWidth={2} /> הזמינות נשמרה!</>
                : "שמור זמינות"}
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}

/** One grid row: time label + 7 tappable day cells */
function FragmentRow({ label, cells }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end",
        fontSize: 9, color: color.textMuted, fontWeight: 600, paddingLeft: 4,
        fontVariantNumeric: "tabular-nums" }}>
        {label}
      </div>
      {cells.map(({ on, onTap }, i) => (
        <motion.button key={i} whileTap={{ scale: 0.85 }} onClick={onTap}
          style={{ height: 30, borderRadius: 6, cursor: "pointer",
            border: `1px solid ${on ? color.primary : color.borderSubtle}`,
            background: on ? color.primary : color.surface2,
            transition: "background 0.12s, border-color 0.12s", padding: 0 }} />
      ))}
    </>
  );
}
