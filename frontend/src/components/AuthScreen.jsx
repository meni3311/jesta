/**
 * AuthScreen — Jesta dark-luxury onboarding
 *
 * Screens:
 *   "auth"  — login / register form
 *   "otp"   — 6-digit code verification (shown after register)
 *
 * Props:
 *   onAuth(data)  — called with { user, token } on successful login or OTP verify
 *   onGuest()     — skip auth, enter as guest (view-only mode)
 */
import { useState, useRef, createRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { login, register, verifyEmailOtp } from "../services/api";

// ── BoltHero ──────────────────────────────────────────────────────────────────
function BoltHero() {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div animate={{ scale: [1, 1.35, 1], opacity: [0.12, 0, 0.12] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", width: 180, height: 180, borderRadius: "50%",
          background: "radial-gradient(circle, #9333ea 0%, transparent 70%)" }} />
      <motion.div animate={{ scale: [1, 1.22, 1], opacity: [0.22, 0, 0.22] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        style={{ position: "absolute", width: 130, height: 130, borderRadius: "50%",
          background: "radial-gradient(circle, #a855f7 0%, transparent 70%)" }} />
      <motion.div animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.15, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
        style={{ position: "absolute", width: 90, height: 90, borderRadius: "50%",
          background: "radial-gradient(circle, #c084fc 0%, transparent 70%)" }} />
      <motion.div animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 72, height: 72, borderRadius: 22,
          background: "linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #ec4899 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 40px rgba(147,51,234,0.7), 0 0 80px rgba(147,51,234,0.3)",
          position: "relative", zIndex: 1,
        }}>
        <span style={{ fontSize: 36, lineHeight: 1 }}>⚡</span>
      </motion.div>
    </div>
  );
}

// ── Text field ────────────────────────────────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11, color: "#a78bfa",
        fontWeight: 700, marginBottom: 4, letterSpacing: 0.4 }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} dir="auto"
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "12px 14px", borderRadius: 12,
          border: "1px solid rgba(167,139,250,0.22)",
          background: "rgba(255,255,255,0.04)",
          color: "#f5f3ff", fontSize: 14, fontWeight: 500,
          fontFamily: "inherit", outline: "none",
        }}
      />
    </div>
  );
}

// ── Avatar picker ─────────────────────────────────────────────────────────────
function AvatarPicker({ preview, uploading, onFileChange }) {
  const inputRef = useRef(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 11, color: "#a78bfa",
        fontWeight: 700, marginBottom: 10, letterSpacing: 0.4, alignSelf: "flex-start" }}>
        תמונת פרופיל (אופציונלי)
      </label>
      <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
        onClick={() => inputRef.current?.click()}
        style={{
          width: 80, height: 80, borderRadius: "50%", cursor: "pointer",
          border: "2px dashed rgba(167,139,250,0.4)",
          background: preview ? "transparent" : "rgba(124,58,237,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
          boxShadow: preview ? "0 0 24px rgba(124,58,237,0.35)" : "none",
        }}>
        {uploading ? (
          <motion.div animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
            style={{ width: 22, height: 22, borderRadius: "50%",
              border: "2.5px solid rgba(167,139,250,0.4)", borderTopColor: "#a78bfa" }} />
        ) : preview ? (
          <img src={preview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ textAlign: "center" }}>
            <Camera size={22} color="rgba(167,139,250,0.6)" />
            <div style={{ fontSize: 9, color: "rgba(167,139,250,0.5)", marginTop: 4, fontWeight: 600 }}>העלה תמונה</div>
          </div>
        )}
      </motion.div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
      {preview && (
        <div style={{ fontSize: 10, color: "#4ade80", fontWeight: 600, marginTop: 6 }}>✓ תמונה נבחרה</div>
      )}
    </div>
  );
}

// ── OTP digit boxes ───────────────────────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const digits = [...value.padEnd(6, " ")].slice(0, 6);
  const refs   = useRef(Array.from({ length: 6 }, () => createRef()));

  const handleChange = (i, raw) => {
    const ch = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits.map(d => d.trim())];
    next[i] = ch;
    onChange(next.join(""));
    if (ch && i < 5) refs.current[i + 1].current?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (!digits[i].trim() && i > 0) {
        const next = [...digits.map(d => d.trim())];
        next[i - 1] = "";
        onChange(next.join(""));
        refs.current[i - 1].current?.focus();
      }
    }
    if (e.key === "ArrowLeft"  && i < 5) refs.current[i + 1].current?.focus();
    if (e.key === "ArrowRight" && i > 0) refs.current[i - 1].current?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) { onChange(pasted.padEnd(6, "").slice(0, 6)); }
    e.preventDefault();
  };

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", margin: "20px 0" }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs.current[i]}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d.trim()}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          style={{
            width: 44, height: 54, textAlign: "center", fontSize: 24, fontWeight: 900,
            borderRadius: 12, border: `1.5px solid ${d.trim() ? "rgba(124,58,237,0.7)" : "rgba(167,139,250,0.22)"}`,
            background: d.trim() ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.04)",
            color: "#c4b5fd", outline: "none", fontFamily: "inherit",
            boxShadow: d.trim() ? "0 0 12px rgba(124,58,237,0.25)" : "none",
            transition: "all 0.15s",
          }}
        />
      ))}
    </div>
  );
}

// ── Dark wrapper — declared OUTSIDE main component so React never remounts it ──
function Wrapper({ children }) {
  return (
    <div dir="rtl" style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      background: "linear-gradient(180deg, #06030f 0%, #0d0824 60%, #110932 100%)",
      fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif",
      overflow: "hidden", position: "relative",
    }}>
      {/* Ambient grid */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none",
        backgroundImage:
          "linear-gradient(#7c3aed 1px, transparent 1px), linear-gradient(90deg, #7c3aed 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AuthScreen({ onAuth, onGuest }) {
  // "auth" = login/register form | "otp" = verify code
  const [screen,   setScreen]   = useState("auth");
  const [tab,      setTab]      = useState("login");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // Auth form fields
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role,     setRole]     = useState("WORKER");

  // Avatar
  const [avatarPreview,   setAvatarPreview]   = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPublicUrl, setAvatarPublicUrl] = useState(null);

  // OTP screen
  const [pendingEmail, setPendingEmail] = useState("");
  const [otpCode,      setOtpCode]      = useState("");

  // ── Avatar upload ──────────────────────────────────────────────────────────
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
    setAvatarUploading(true);

    try {
      const ext  = file.name.split('.').pop();
      const path = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('avatars').upload(path, file, { cacheControl: '3600', upsert: false });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarPublicUrl(data.publicUrl);
    } catch (err) {
      console.warn('[Jesta] Avatar upload failed:', err.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── Submit auth form ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);
    if (!email || !password)                   { setError("יש למלא אימייל וסיסמה"); return; }
    if (password.length < 8)                   { setError("הסיסמה חייבת להכיל לפחות 8 תווים"); return; }
    if (tab === "register" && !fullName)        { setError("יש למלא שם מלא"); return; }
    if (tab === "register" && avatarUploading)  { setError("ממתין לסיום העלאת התמונה..."); return; }

    setLoading(true);
    try {
      if (tab === "login") {
        const data = await login({ email, password });
        onAuth(data);
      } else {
        // register → backend sends OTP, returns { pendingVerification, email }
        await register({
          email, password, fullName, role,
          ...(avatarPublicUrl && { avatarUrl: avatarPublicUrl }),
        });
        // Preserve email for OTP screen, then switch screens
        setPendingEmail(email);
        setOtpCode("");
        setError(null);
        setScreen("otp");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Submit OTP ─────────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otpCode.replace(/\s/g, "").length < 6) { setError("יש להזין קוד בן 6 ספרות"); return; }
    setError(null);
    setLoading(true);
    try {
      const data = await verifyEmailOtp(pendingEmail, otpCode.replace(/\s/g, ""));
      onAuth(data); // { user, token } → logged in
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setError(null);
    setLoading(true);
    setOtpCode("");
    try {
      // Re-trigger registration is not ideal; we call send-verification if we have a token
      // For simplicity: re-register attempt will hit ConflictException, so we just inform user
      // In production: add a dedicated POST /auth/resend-otp endpoint
      setError("לא ניתן לשלוח מחדש כרגע. אנא בדוק את תיבת הדואר שלך או נסה להירשם שוב.");
    } finally {
      setLoading(false);
    }
  };

  // ── OTP Screen ─────────────────────────────────────────────────────────────
  if (screen === "otp") {
    return (
      <Wrapper>
        {/* Hero */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "0 24px", position: "relative", zIndex: 1 }}>
          <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            style={{ marginBottom: 24 }}>
            <BoltHero />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#e9d5ff", marginBottom: 8 }}>
              בדוק את המייל שלך 📬
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
              שלחנו קוד בן 6 ספרות אל<br />
              <span style={{ color: "#a78bfa", fontWeight: 700 }}>{pendingEmail}</span>
            </div>
          </motion.div>
        </div>

        {/* OTP card */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 30, delay: 0.3 }}
          style={{
            background: "linear-gradient(180deg, #12093a 0%, #0f0730 100%)",
            borderTop: "1px solid rgba(167,139,250,0.18)",
            borderRadius: "28px 28px 0 0",
            padding: "24px 20px 32px",
            position: "relative", zIndex: 2, flexShrink: 0,
          }}>
          <div style={{ width: 36, height: 4, borderRadius: 2,
            background: "rgba(167,139,250,0.25)", margin: "0 auto 20px" }} />

          {/* Back button */}
          <motion.button whileTap={{ scale: 0.9 }}
            onClick={() => { setScreen("auth"); setError(null); }}
            style={{ background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              color: "#6b7280", fontSize: 13, fontWeight: 600,
              fontFamily: "inherit", marginBottom: 16 }}>
            <ArrowRight size={14} /> חזרה
          </motion.button>

          <div style={{ fontSize: 16, fontWeight: 800, color: "#e9d5ff",
            textAlign: "center", marginBottom: 4 }}>
            הזן קוד אימות
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 4 }}>
            הקוד תקף ל-30 דקות
          </div>

          <OtpInput value={otpCode} onChange={setOtpCode} />

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ fontSize: 12, color: "#f87171", textAlign: "center",
                  marginBottom: 8, padding: "4px 0" }}>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Verify button */}
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            onClick={handleVerifyOtp} disabled={loading}
            style={{
              width: "100%", padding: "14px", borderRadius: 16, border: "none",
              background: loading
                ? "rgba(124,58,237,0.4)"
                : "linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #ec4899 100%)",
              color: "#fff", fontSize: 15, fontWeight: 900,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit", marginBottom: 14,
              boxShadow: loading ? "none" : "0 6px 22px rgba(124,58,237,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
            {loading ? (
              <motion.div animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                style={{ width: 18, height: 18, borderRadius: "50%",
                  border: "2.5px solid rgba(255,255,255,0.5)", borderTopColor: "#fff" }} />
            ) : (
              <>⚡ אמת וכנס לחשבון</>
            )}
          </motion.button>

          {/* Resend */}
          <motion.button whileTap={{ scale: 0.95 }} onClick={handleResend} disabled={loading}
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              color: "#6b7280", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            <RefreshCw size={13} /> לא קיבלתי קוד — שלח שוב
          </motion.button>
        </motion.div>
      </Wrapper>
    );
  }

  // ── Auth Screen (login / register) ─────────────────────────────────────────
  return (
    <Wrapper>
      {/* Hero */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "0 24px", position: "relative", zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa",
            letterSpacing: 4, textTransform: "uppercase", marginBottom: 28 }}>
          JESTA
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.15 }}
          style={{ marginBottom: 28 }}>
          <BoltHero />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3 }} style={{ textAlign: "center" }}>
          <div style={{
            fontSize: 24, fontWeight: 900, lineHeight: 1.25, marginBottom: 8,
            background: "linear-gradient(135deg, #e9d5ff 0%, #c4b5fd 40%, #ec4899 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            סוגרים ג׳סטה.<br />עושים כסף. ⚡
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>
            מצא עבודה קצרה ליד הבית תוך דקות
          </div>
        </motion.div>
        {[
          { top: "15%", left: "8%",   delay: 0,   size: 6 },
          { top: "25%", right: "10%", delay: 0.7, size: 4 },
          { top: "60%", left: "5%",   delay: 1.2, size: 5 },
          { top: "70%", right: "8%",  delay: 0.4, size: 7 },
        ].map((s, i) => (
          <motion.div key={i}
            animate={{ opacity: [0, 0.7, 0], scale: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, delay: s.delay, repeat: Infinity, repeatDelay: 1.5 }}
            style={{ position: "absolute", top: s.top, left: s.left, right: s.right,
              width: s.size, height: s.size, borderRadius: "50%",
              background: "#a855f7", boxShadow: `0 0 ${s.size * 2}px #a855f7` }} />
        ))}
      </div>

      {/* Auth card */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 30, delay: 0.45 }}
        style={{
          background: "linear-gradient(180deg, #12093a 0%, #0f0730 100%)",
          borderTop: "1px solid rgba(167,139,250,0.18)",
          borderRadius: "28px 28px 0 0",
          padding: "24px 20px 32px",
          position: "relative", zIndex: 2, flexShrink: 0,
          maxHeight: "72%", overflowY: "auto",
        }}>
        <div style={{ width: 36, height: 4, borderRadius: 2,
          background: "rgba(167,139,250,0.25)", margin: "0 auto 20px" }} />

        {/* Tab switcher */}
        <div style={{ display: "flex", background: "rgba(255,255,255,0.05)",
          borderRadius: 12, padding: 3, marginBottom: 18 }}>
          {[{ key: "login", label: "כניסה" }, { key: "register", label: "הרשמה" }].map(({ key, label }) => (
            <button key={key} onClick={() => { setTab(key); setError(null); }}
              style={{
                flex: 1, padding: "9px 0", border: "none", borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                background: tab === key ? "linear-gradient(135deg, #7c3aed, #9333ea)" : "transparent",
                color: tab === key ? "#fff" : "#6b7280",
                boxShadow: tab === key ? "0 2px 12px rgba(124,58,237,0.4)" : "none",
                transition: "all 0.2s",
              }}>
              {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, x: tab === "login" ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}>
            <Field label="אימייל" type="email" value={email}
              onChange={setEmail} placeholder="you@example.com" />
            <Field label="סיסמה" type="password" value={password}
              onChange={setPassword} placeholder="לפחות 8 תווים" />

            {tab === "register" && (
              <>
                <Field label="שם מלא" value={fullName}
                  onChange={setFullName} placeholder="ישראל ישראלי" />

                {/* Role picker */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#a78bfa",
                    fontWeight: 700, marginBottom: 4, letterSpacing: 0.4 }}>
                    אני רוצה ל…
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      { val: "WORKER",   label: "מצוא עבודה 🔍" },
                      { val: "EMPLOYER", label: "לפרסם משרה 📋" },
                    ].map(({ val, label }) => (
                      <button key={val} onClick={() => setRole(val)}
                        style={{
                          flex: 1, padding: "9px 4px", border: "none", borderRadius: 10,
                          fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                          background: role === val
                            ? "linear-gradient(135deg, #7c3aed, #ec4899)"
                            : "rgba(255,255,255,0.05)",
                          color: role === val ? "#fff" : "#6b7280",
                          boxShadow: role === val ? "0 2px 10px rgba(124,58,237,0.35)" : "none",
                          transition: "all 0.2s",
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Avatar upload */}
                <AvatarPicker
                  preview={avatarPreview}
                  uploading={avatarUploading}
                  onFileChange={handleAvatarChange}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              style={{ fontSize: 12, color: "#f87171", textAlign: "center",
                marginBottom: 8, padding: "4px 0" }}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={handleSubmit} disabled={loading || avatarUploading}
          style={{
            width: "100%", padding: "14px", borderRadius: 16, border: "none",
            background: (loading || avatarUploading)
              ? "rgba(124,58,237,0.4)"
              : "linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #ec4899 100%)",
            color: "#fff", fontSize: 15, fontWeight: 900,
            cursor: (loading || avatarUploading) ? "not-allowed" : "pointer",
            fontFamily: "inherit", letterSpacing: 0.3, marginBottom: 14,
            boxShadow: (loading || avatarUploading) ? "none" : "0 6px 22px rgba(124,58,237,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "box-shadow 0.2s",
          }}>
          {loading ? (
            <motion.div animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              style={{ width: 18, height: 18, borderRadius: "50%",
                border: "2.5px solid rgba(255,255,255,0.5)", borderTopColor: "#fff" }} />
          ) : (
            <>⚡ {tab === "login" ? "כניסה לחשבון" : "יצירת חשבון חינם"}</>
          )}
        </motion.button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 12px" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(167,139,250,0.12)" }} />
          <span style={{ fontSize: 11, color: "#4b5563", fontWeight: 500 }}>או</span>
          <div style={{ flex: 1, height: 1, background: "rgba(167,139,250,0.12)" }} />
        </div>

        <motion.button whileHover={{ opacity: 1 }} whileTap={{ scale: 0.97 }}
          onClick={onGuest}
          style={{
            width: "100%", padding: "12px", borderRadius: 14,
            border: "1px solid rgba(167,139,250,0.18)",
            background: "transparent", cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 600, color: "#a78bfa", opacity: 0.8,
            transition: "opacity 0.2s", textAlign: "center",
          }}>
          המשך כאורח (מצב צפייה) 👀
        </motion.button>

        <div style={{ fontSize: 10, color: "#374151", textAlign: "center",
          marginTop: 16, lineHeight: 1.6 }}>
          בהמשך אתה מסכים לתנאי השימוש ומדיניות הפרטיות של Jesta
        </div>
      </motion.div>
    </Wrapper>
  );
}
