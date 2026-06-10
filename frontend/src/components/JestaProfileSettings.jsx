/**
 * JestaProfileSettings — full-screen profile edit & email verification
 *
 * Props:
 *   user          { id, email, fullName, phone, avatarUrl, isVerified, role }
 *   onBack()      navigate back
 *   onUserUpdate(updatedUser)  called after successful PATCH
 */
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Camera, ShieldCheck, ShieldAlert,
  Mail, Phone, User, Save,
} from "lucide-react";
import { updateProfile, uploadAvatar, sendVerificationEmail } from "../services/api";

const VIOLET = "#7c3aed";
const PINK   = "#ec4899";

// ── Helpers ────────────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 800, color: "#a78bfa",
      letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10, marginTop: 20 }}>
      {children}
    </div>
  );
}

function InputRow({ icon: Icon, label, value, onChange, type = "text", placeholder, readOnly = false }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, color: "#6b7280",
        fontWeight: 700, marginBottom: 5, letterSpacing: 0.3 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
          <Icon size={15} color={readOnly ? "#cbd5e1" : "#a78bfa"} strokeWidth={2} />
        </div>
        <input type={type} value={value ?? ""}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder} readOnly={readOnly} dir="auto"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "12px 38px 12px 14px", borderRadius: 12,
            border: `1px solid ${readOnly ? "rgba(226,232,240,0.6)" : "rgba(124,58,237,0.25)"}`,
            background: readOnly ? "rgba(241,245,249,0.5)" : "#fff",
            color: readOnly ? "#94a3b8" : "#0f172a", fontSize: 14, fontWeight: 500,
            fontFamily: "inherit", outline: "none",
            boxShadow: readOnly ? "none" : "0 1px 4px rgba(124,58,237,0.08)",
          }} />
      </div>
    </div>
  );
}

function Toast({ message, type = "success" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      style={{
        position: "absolute", bottom: 80, left: "50%", transform: "translateX(-50%)",
        zIndex: 9999, whiteSpace: "nowrap",
        background: type === "success"
          ? "linear-gradient(135deg,#7c3aed,#ec4899)"
          : "rgba(239,68,68,0.9)",
        color: "#fff", fontSize: 13, fontWeight: 700,
        padding: "10px 20px", borderRadius: 50,
        boxShadow: "0 8px 24px rgba(124,58,237,0.4)",
        fontFamily: "'Heebo',system-ui,sans-serif",
      }}>
      {message}
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function JestaProfileSettings({ user, onBack, onUserUpdate }) {
  const [fullName,  setFullName]  = useState(user?.fullName  ?? "");
  const [phone,     setPhone]     = useState(user?.phone     ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? null);

  const [saving,          setSaving]          = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [verifying,       setVerifying]       = useState(false);

  const [toast, setToast] = useState(null);  // { message, type }

  const inputRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3200);
  };

  // ── Avatar change ──────────────────────────────────────────────────────────
  // Sends the file to the NestJS backend (POST /users/avatar), which uploads
  // to Supabase storage and returns the updated user.  We call onUserUpdate()
  // immediately so the Sidebar reflects the new photo without a page reload.
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected after an error
    e.target.value = "";
    setAvatarUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const updatedUser = await uploadAvatar(formData);

      // The DB stores the clean public URL.
      // We append ?t= only in memory so the browser discards its cached copy
      // of the old avatar and re-fetches the new one — across every screen that
      // renders this user (Sidebar, ProfileSettings) — without the timestamp
      // ever being written back to the database.
      const freshUrl = `${updatedUser.avatarUrl}?t=${Date.now()}`;
      const userWithFreshAvatar = { ...updatedUser, avatarUrl: freshUrl };

      setAvatarUrl(freshUrl);
      onUserUpdate?.(userWithFreshAvatar);  // ← live-update Sidebar immediately
      showToast("תמונה עודכנה ✓");
    } catch (err) {
      showToast("שגיאה בהעלאת תמונה", "error");
      console.error("[Jesta] Avatar upload:", err.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── Save profile ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!fullName.trim()) { showToast("שם מלא נדרש", "error"); return; }
    setSaving(true);
    try {
      const updated = await updateProfile({
        fullName: fullName.trim(),
        ...(phone     && { phone }),
        ...(avatarUrl && { avatarUrl }),
      });
      onUserUpdate?.(updated);
      showToast("הפרופיל עודכן בהצלחה ⚡");
    } catch (err) {
      showToast(err.message ?? "שגיאה בשמירה", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Send verification email ────────────────────────────────────────────────
  const handleVerify = async () => {
    setVerifying(true);
    try {
      await sendVerificationEmail();
      showToast("מייל אימות נשלח! בדוק את תיבת הדואר 📬");
    } catch (err) {
      showToast(err.message ?? "שגיאה בשליחת המייל", "error");
    } finally {
      setVerifying(false);
    }
  };

  const isVerified = user?.isVerified ?? false;

  return (
    <div dir="rtl" style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      background: "#f8f7ff", fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif",
      position: "relative", overflowY: "auto",
    }}>
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${VIOLET} 0%, #9333ea 55%, ${PINK} 100%)`,
        padding: "52px 20px 60px", position: "relative", flexShrink: 0,
      }}>
        {/* Back */}
        <motion.button whileTap={{ scale: 0.88 }} onClick={onBack}
          style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36,
            borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer" }}>
          <ArrowRight size={18} color="#fff" strokeWidth={2.5} />
        </motion.button>

        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)",
          letterSpacing: 3, textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>
          JESTA
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff",
          textAlign: "center", marginBottom: 4 }}>
          הגדרות פרופיל
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)",
          textAlign: "center" }}>
          עדכן תמונה, שם ופרטי יצירת קשר
        </div>

        {/* Avatar bubble — overlaps card below */}
        <div style={{ position: "absolute", bottom: -40, left: "50%",
          transform: "translateX(-50%)", zIndex: 2 }}>
          <div style={{ position: "relative" }}>

            {/* Pulsing neon ring — only shown when no photo */}
            {!avatarUrl && !avatarUploading && (
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.15, 0.6] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                style={{ position: "absolute", inset: -5, borderRadius: "50%",
                  border: "2px solid rgba(167,139,250,0.55)", pointerEvents: "none" }} />
            )}

            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => inputRef.current?.click()}
              style={{ width: 80, height: 80, borderRadius: "50%", cursor: "pointer",
                background: avatarUrl ? "transparent"
                  : "linear-gradient(135deg,#a78bfa,#7c3aed)",
                border: "3px solid #fff",
                boxShadow: avatarUrl
                  ? "0 6px 24px rgba(124,58,237,0.35)"
                  : "0 6px 24px rgba(124,58,237,0.45), 0 0 0 4px rgba(167,139,250,0.15), inset 0 0 16px rgba(167,139,250,0.15)",
                overflow: "hidden", display: "flex", alignItems: "center",
                justifyContent: "center", position: "relative" }}>

              {avatarUploading ? (
                /* Upload spinner */
                <motion.div animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  style={{ width: 26, height: 26, borderRadius: "50%",
                    border: "3px solid rgba(255,255,255,0.35)", borderTopColor: "#fff" }} />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <>
                  {/* Neon shimmer sweep across the placeholder */}
                  <motion.div
                    animate={{ x: ["-120%", "220%"] }}
                    transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
                    style={{ position: "absolute", top: 0, left: 0,
                      width: "45%", height: "100%",
                      background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent)",
                      pointerEvents: "none", zIndex: 1 }} />

                  {/* User's first initial */}
                  <span style={{ fontSize: 26, fontWeight: 900, color: "#fff",
                    fontFamily: "'Heebo',system-ui,sans-serif",
                    textShadow: "0 0 14px rgba(167,139,250,0.9)", zIndex: 2, lineHeight: 1 }}>
                    {(user?.fullName ?? "").charAt(0).toUpperCase() || "?"}
                  </span>

                  {/* Tiny lightning motif */}
                  <div style={{ position: "absolute", bottom: 6, right: 6,
                    fontSize: 10, lineHeight: 1, zIndex: 3,
                    filter: "drop-shadow(0 0 4px rgba(167,139,250,0.9))" }}>
                    ⚡
                  </div>
                </>
              )}
            </motion.div>

            {/* Camera / edit badge */}
            <motion.div
              whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
              onClick={() => inputRef.current?.click()}
              style={{ position: "absolute", bottom: 0, left: 0,
                width: 28, height: 28, borderRadius: "50%",
                background: "linear-gradient(135deg,#7c3aed,#ec4899)",
                border: "2.5px solid #fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 10px rgba(124,58,237,0.5)", cursor: "pointer" }}>
              <Camera size={13} color="#fff" strokeWidth={2.5} />
            </motion.div>
          </div>
          <input ref={inputRef} type="file" accept="image/*"
            style={{ display: "none" }} onChange={handleAvatarChange} />
        </div>
      </div>

      {/* Form card */}
      <div style={{ background: "#fff", margin: "0 16px", marginTop: 52, borderRadius: 20,
        padding: "20px 18px 24px", boxShadow: "0 4px 24px rgba(124,58,237,0.08)",
        border: "1px solid rgba(124,58,237,0.1)", flexShrink: 0 }}>

        <SectionLabel>פרטים אישיים</SectionLabel>

        <InputRow icon={User}  label="שם מלא"           value={fullName}
          onChange={setFullName} placeholder="ישראל ישראלי" />
        <InputRow icon={Phone} label="טלפון נייד"        value={phone}
          onChange={setPhone}   placeholder="05X-XXXXXXX" type="tel" />
        <InputRow icon={Mail}  label="אימייל (לא ניתן לשינוי)" value={user?.email ?? ""}
          readOnly />

        {/* Save button */}
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={handleSave} disabled={saving}
          style={{
            width: "100%", marginTop: 6, padding: "14px", borderRadius: 14, border: "none",
            background: saving
              ? "rgba(124,58,237,0.35)"
              : `linear-gradient(135deg, ${VIOLET}, #9333ea, ${PINK})`,
            color: "#fff", fontSize: 15, fontWeight: 900,
            cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            boxShadow: saving ? "none" : "0 6px 20px rgba(124,58,237,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "box-shadow 0.2s",
          }}>
          {saving ? (
            <motion.div animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              style={{ width: 18, height: 18, borderRadius: "50%",
                border: "2.5px solid rgba(255,255,255,0.5)", borderTopColor: "#fff" }} />
          ) : (
            <><Save size={16} color="#fff" strokeWidth={2.5} /> שמור שינויים</>
          )}
        </motion.button>
      </div>

      {/* Email Verification card */}
      <div style={{ background: "#fff", margin: "12px 16px 24px", borderRadius: 20,
        padding: "20px 18px 24px", boxShadow: "0 4px 24px rgba(124,58,237,0.08)",
        border: `1px solid ${isVerified ? "rgba(74,222,128,0.25)" : "rgba(251,191,36,0.25)"}`,
        flexShrink: 0 }}>

        <SectionLabel>אימות אימייל</SectionLabel>

        {/* Status banner */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: isVerified ? "rgba(74,222,128,0.08)" : "rgba(251,191,36,0.08)",
          border: `1px solid ${isVerified ? "rgba(74,222,128,0.25)" : "rgba(251,191,36,0.25)"}`,
          borderRadius: 14, padding: "14px 16px", marginBottom: 16,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: isVerified ? "rgba(74,222,128,0.15)" : "rgba(251,191,36,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isVerified
              ? <ShieldCheck size={20} color="#4ade80" strokeWidth={2} />
              : <ShieldAlert size={20} color="#fbbf24" strokeWidth={2} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800,
              color: isVerified ? "#15803d" : "#92400e", marginBottom: 2 }}>
              {isVerified ? "המייל שלך מאומת ✓" : "מייל לא מאומת ⚠️"}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              {isVerified
                ? `האימייל ${user?.email} מאומת ומוגן.`
                : `${user?.email} — לחץ כדי לשלוח קישור אימות`}
            </div>
          </div>
        </div>

        {!isVerified && (
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={handleVerify} disabled={verifying}
            style={{
              width: "100%", padding: "13px", borderRadius: 14, border: "none",
              background: verifying
                ? "rgba(251,191,36,0.3)"
                : "linear-gradient(135deg, #d97706, #92400e)",
              color: "#fff", fontSize: 14, fontWeight: 900,
              cursor: verifying ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              boxShadow: verifying ? "none" : "0 4px 16px rgba(217,119,6,0.35)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "box-shadow 0.2s",
            }}>
            {verifying ? (
              <>
                <motion.div animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  style={{ width: 16, height: 16, borderRadius: "50%",
                    border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff" }} />
                שולח מייל אימות...
              </>
            ) : (
              <><Mail size={15} color="#fff" strokeWidth={2.5} /> שלח מייל אימות ⚡</>
            )}
          </motion.button>
        )}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast key="toast" message={toast.message} type={toast.type} />}
      </AnimatePresence>
    </div>
  );
}
