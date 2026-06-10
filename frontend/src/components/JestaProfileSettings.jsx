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
  Mail, Phone, User, Save, UserRound,
} from "lucide-react";
import { updateProfile, uploadAvatar, sendVerificationEmail } from "../services/api";
import { color, radius, shadow, font, styles } from "../design-system";
import { PrimaryButton, SectionLabel, Spinner } from "./ui";

// ── Helpers ────────────────────────────────────────────────────────────────────

function InputRow({ icon: Icon, label, value, onChange, type = "text", placeholder, readOnly = false }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, color: color.textSecondary,
        fontWeight: 500, marginBottom: 8 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <div style={{ position: "absolute", insetInlineStart: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", display: "flex" }}>
          <Icon size={16} color={readOnly ? color.textMuted : color.primaryText} strokeWidth={1.75} />
        </div>
        <input type={type} value={value ?? ""}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder} readOnly={readOnly} dir="auto"
          onFocus={e => { if (!readOnly) e.target.style.borderColor = color.primary; }}
          onBlur={e => { e.target.style.borderColor = color.borderSubtle; }}
          style={{
            ...styles.input,
            paddingInlineStart: 40,
            ...(readOnly && { color: color.textMuted, background: color.surface2, cursor: "default" }),
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
        background: color.surface3,
        border: `1px solid ${color.borderStrong}`,
        color: type === "success" ? color.success : color.danger,
        fontSize: 13, fontWeight: 600,
        padding: "12px 20px", borderRadius: radius.chip,
        boxShadow: shadow.card,
        fontFamily: font.family,
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
      showToast("התמונה עודכנה");
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
      showToast("הפרופיל עודכן בהצלחה");
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
      showToast("מייל אימות נשלח! בדוק את תיבת הדואר");
    } catch (err) {
      showToast(err.message ?? "שגיאה בשליחת המייל", "error");
    } finally {
      setVerifying(false);
    }
  };

  const isVerified = user?.isVerified ?? false;

  return (
    <div dir="rtl" style={{
      ...styles.screen,
      position: "relative", overflowY: "auto", display: "block",
    }}>
      {/* Header */}
      <div style={{
        background: color.surface1,
        borderBottom: `1px solid ${color.borderSubtle}`,
        padding: "52px 20px 60px", position: "relative", flexShrink: 0,
      }}>
        {/* Back */}
        <motion.button whileTap={{ scale: 0.92 }} onClick={onBack}
          style={{ ...styles.iconButton, position: "absolute", top: 16, insetInlineStart: 16, border: "none" }}>
          <ArrowRight size={18} color={color.textPrimary} strokeWidth={2} />
        </motion.button>

        <div style={{ ...font.overline, textAlign: "center", marginBottom: 8 }}>
          JESTA
        </div>
        <div style={{ fontSize: 20, ...font.heading, textAlign: "center", marginBottom: 4 }}>
          הגדרות פרופיל
        </div>
        <div style={{ fontSize: 13, color: color.textSecondary, textAlign: "center" }}>
          עדכן תמונה, שם ופרטי יצירת קשר
        </div>

        {/* Avatar — overlaps card below */}
        <div style={{ position: "absolute", bottom: -40, left: "50%",
          transform: "translateX(-50%)", zIndex: 2 }}>
          <div style={{ position: "relative" }}>
            <motion.div whileTap={{ scale: 0.96 }}
              onClick={() => inputRef.current?.click()}
              style={{ width: 80, height: 80, borderRadius: "50%", cursor: "pointer",
                background: avatarUrl
                  ? color.surface2
                  : `linear-gradient(135deg, ${color.surface3} 0%, ${color.primarySoft} 100%)`,
                border: `2px solid ${color.borderStrong}`,
                boxShadow: shadow.card,
                overflow: "hidden", display: "flex", alignItems: "center",
                justifyContent: "center", position: "relative" }}>

              {avatarUploading ? (
                <Spinner size={24} />
              ) : avatarUrl ? (
                <img src={avatarUrl} alt="avatar"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <UserRound size={36} color={color.primaryText} strokeWidth={1.5} />
              )}
            </motion.div>

            {/* Camera / edit badge */}
            <motion.div
              whileTap={{ scale: 0.9 }}
              onClick={() => inputRef.current?.click()}
              style={{ position: "absolute", bottom: 0, insetInlineEnd: -4,
                width: 28, height: 28, borderRadius: "50%",
                background: color.primary,
                border: `2px solid ${color.bg}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer" }}>
              <Camera size={13} color="#fff" strokeWidth={2} />
            </motion.div>
          </div>
          <input ref={inputRef} type="file" accept="image/*"
            style={{ display: "none" }} onChange={handleAvatarChange} />
        </div>
      </div>

      {/* Form card */}
      <div style={{ ...styles.card, margin: "52px 16px 0",
        padding: "20px 16px 24px", flexShrink: 0 }}>

        <SectionLabel>פרטים אישיים</SectionLabel>

        <InputRow icon={User}  label="שם מלא"           value={fullName}
          onChange={setFullName} placeholder="ישראל ישראלי" />
        <InputRow icon={Phone} label="טלפון נייד"        value={phone}
          onChange={setPhone}   placeholder="05X-XXXXXXX" type="tel" />
        <InputRow icon={Mail}  label="אימייל (לא ניתן לשינוי)" value={user?.email ?? ""}
          readOnly />

        {/* Save button — the single primary action on this screen */}
        <PrimaryButton onClick={handleSave} disabled={saving} style={{ marginTop: 8 }}>
          {saving ? <Spinner size={18} /> : (
            <><Save size={18} color="#fff" strokeWidth={2} /> שמור שינויים</>
          )}
        </PrimaryButton>
      </div>

      {/* Email Verification card */}
      <div style={{ ...styles.card, margin: "12px 16px 24px",
        padding: "20px 16px 24px", flexShrink: 0 }}>

        <SectionLabel>אימות אימייל</SectionLabel>

        {/* Status banner */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: isVerified ? color.successSoft : color.warningSoft,
          border: `1px solid ${color.borderSubtle}`,
          borderRadius: radius.input, padding: "16px", marginBottom: 16,
        }}>
          <div style={{ ...styles.iconBox(40), background: color.surface2 }}>
            {isVerified
              ? <ShieldCheck size={20} color={color.success} strokeWidth={1.75} />
              : <ShieldAlert size={20} color={color.warning} strokeWidth={1.75} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600,
              color: isVerified ? color.success : color.warning, marginBottom: 2 }}>
              {isVerified ? "המייל שלך מאומת" : "מייל לא מאומת"}
            </div>
            <div style={{ fontSize: 12, color: color.textSecondary, lineHeight: 1.6 }}>
              {isVerified
                ? `האימייל ${user?.email} מאומת ומוגן.`
                : `${user?.email} — לחץ כדי לשלוח קישור אימות`}
            </div>
          </div>
        </div>

        {!isVerified && (
          <motion.button whileTap={{ scale: 0.98 }}
            onClick={handleVerify} disabled={verifying}
            style={{
              ...styles.buttonSecondary, height: 48, fontSize: 14,
              ...(verifying && { opacity: 0.5, cursor: "not-allowed" }),
            }}>
            {verifying ? (
              <><Spinner size={16} /> שולח מייל אימות...</>
            ) : (
              <><Mail size={16} strokeWidth={2} /> שלח מייל אימות</>
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
