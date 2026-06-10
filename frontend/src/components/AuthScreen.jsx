/**
 * AuthScreen — Jesta dark onboarding
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
import { Camera, ArrowRight, RefreshCw, Zap, Search, ClipboardList, Check } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { login, register, verifyEmailOtp, resendOtp } from "../services/api";
import { color, radius, shadow, font, styles } from "../design-system";
import { SegmentedControl, PrimaryButton, SecondaryButton, Spinner } from "./ui";

// ── BoltHero ──────────────────────────────────────────────────────────────────
function BoltHero() {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <motion.div animate={{ scale: [1, 1.25, 1], opacity: [0.18, 0, 0.18] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", width: 160, height: 160, borderRadius: "50%",
          background: `radial-gradient(circle, ${color.primaryGlow} 0%, transparent 70%)` }} />
      <motion.div animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 72, height: 72, borderRadius: 20,
          background: `linear-gradient(135deg, ${color.surface3} 0%, ${color.primarySoft} 100%)`,
          border: `1px solid ${color.borderStrong}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: shadow.glow,
          position: "relative", zIndex: 1,
        }}>
        <Zap size={32} color={color.primaryText} strokeWidth={1.75} />
      </motion.div>
    </div>
  );
}

// ── Text field ────────────────────────────────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12, color: color.textSecondary,
        fontWeight: 500, marginBottom: 4 }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} dir="auto"
        onFocus={e => (e.target.style.borderColor = color.primary)}
        onBlur={e => (e.target.style.borderColor = color.borderSubtle)}
        style={styles.input}
      />
    </div>
  );
}

// ── Avatar picker ─────────────────────────────────────────────────────────────
function AvatarPicker({ preview, uploading, onFileChange }) {
  const inputRef = useRef(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, color: color.textSecondary,
        fontWeight: 500, marginBottom: 8, alignSelf: "flex-start" }}>
        תמונת פרופיל (אופציונלי)
      </label>
      <motion.div whileTap={{ scale: 0.97 }}
        onClick={() => inputRef.current?.click()}
        style={{
          width: 80, height: 80, borderRadius: "50%", cursor: "pointer",
          border: `2px dashed ${color.borderStrong}`,
          background: preview ? color.surface2 : color.surface3,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
        {uploading ? (
          <Spinner size={22} />
        ) : preview ? (
          <img src={preview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ textAlign: "center" }}>
            <Camera size={22} color={color.textSecondary} strokeWidth={1.5} />
            <div style={{ fontSize: 9, color: color.textMuted, marginTop: 4, fontWeight: 500 }}>העלה תמונה</div>
          </div>
        )}
      </motion.div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChange} />
      {preview && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: color.success, fontWeight: 500, marginTop: 8 }}>
          <Check size={11} strokeWidth={2.5} /> תמונה נבחרה
        </div>
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
            width: 44, height: 56, textAlign: "center", fontSize: 24, fontWeight: 700,
            borderRadius: radius.input,
            border: `1px solid ${d.trim() ? color.primary : color.borderSubtle}`,
            background: d.trim() ? color.primarySoft : color.surface3,
            color: color.textPrimary, outline: "none", fontFamily: font.family,
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
      ...styles.screen,
      overflow: "hidden", position: "relative",
    }}>
      {/* Ambient grid */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04, pointerEvents: "none",
        backgroundImage:
          `linear-gradient(${color.primary} 1px, transparent 1px), linear-gradient(90deg, ${color.primary} 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }} />
      {children}
    </div>
  );
}

// Bottom card shared by both sub-screens
const cardStyle = {
  ...styles.sheet,
  padding: "0 20px 32px",
  position: "relative", zIndex: 2, flexShrink: 0,
};

function Handle() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 20px" }}>
      <div style={styles.sheetHandle} />
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
        if (data?.pendingVerification) {
          // Unverified account — backend re-sent an OTP; show the OTP screen
          setPendingEmail(data.email ?? email);
          setOtpCode("");
          setScreen("otp");
        } else {
          onAuth(data);
        }
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
      await resendOtp(pendingEmail);
      setError("קוד חדש נשלח למייל שלך");
    } catch (err) {
      setError(err.message);
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
            <div style={{ fontSize: 22, ...font.heading, marginBottom: 8 }}>
              בדוק את המייל שלך
            </div>
            <div style={{ fontSize: 13, color: color.textSecondary, lineHeight: 1.6 }}>
              שלחנו קוד בן 6 ספרות אל<br />
              <span style={{ color: color.primaryText, fontWeight: 600 }}>{pendingEmail}</span>
            </div>
          </motion.div>
        </div>

        {/* OTP card */}
        <motion.div
          initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 30, delay: 0.3 }}
          style={cardStyle}>
          <Handle />

          {/* Back button */}
          <motion.button whileTap={{ scale: 0.95 }}
            onClick={() => { setScreen("auth"); setError(null); }}
            style={{ background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              color: color.textSecondary, fontSize: 13, fontWeight: 500,
              fontFamily: font.family, marginBottom: 16 }}>
            <ArrowRight size={14} /> חזרה
          </motion.button>

          <div style={{ fontSize: 16, ...font.heading, textAlign: "center", marginBottom: 4 }}>
            הזן קוד אימות
          </div>
          <div style={{ fontSize: 12, color: color.textSecondary, textAlign: "center", marginBottom: 4 }}>
            הקוד תקף ל-30 דקות
          </div>

          <OtpInput value={otpCode} onChange={setOtpCode} />

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                style={{ fontSize: 12, color: color.danger, textAlign: "center",
                  marginBottom: 8, padding: "4px 0" }}>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Verify button */}
          <PrimaryButton onClick={handleVerifyOtp} disabled={loading} style={{ marginBottom: 16 }}>
            {loading ? <Spinner size={18} /> : (
              <><Zap size={16} strokeWidth={2} /> אמת וכנס לחשבון</>
            )}
          </PrimaryButton>

          {/* Resend */}
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleResend} disabled={loading}
            style={{ width: "100%", background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              color: color.textSecondary, fontSize: 12, fontWeight: 500, fontFamily: font.family }}>
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
          style={{ ...font.overline, color: color.primaryText, letterSpacing: "0.32em", marginBottom: 28 }}>
          JESTA
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.15 }}
          style={{ marginBottom: 28 }}>
          <BoltHero />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3 }} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, ...font.heading, lineHeight: 1.25, marginBottom: 8 }}>
            סוגרים ג׳סטה.<br />עושים כסף.
          </div>
          <div style={{ fontSize: 13, color: color.textSecondary, fontWeight: 400 }}>
            מצא עבודה קצרה ליד הבית תוך דקות
          </div>
        </motion.div>
      </div>

      {/* Auth card */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 30, delay: 0.45 }}
        style={{ ...cardStyle, maxHeight: "72%", overflowY: "auto" }}>
        <Handle />

        {/* Tab switcher */}
        <div style={{ marginBottom: 20 }}>
          <SegmentedControl
            id="auth-tab"
            value={tab}
            onChange={(key) => { setTab(key); setError(null); }}
            options={[
              { key: "login",    label: "כניסה" },
              { key: "register", label: "הרשמה" },
            ]}
          />
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

                {/* Role picker — segmented control, shared color language */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, color: color.textSecondary,
                    fontWeight: 500, marginBottom: 4 }}>
                    אני רוצה ל…
                  </label>
                  <SegmentedControl
                    id="auth-role"
                    value={role}
                    onChange={setRole}
                    options={[
                      { key: "WORKER",   label: "למצוא עבודה", icon: Search },
                      { key: "EMPLOYER", label: "לפרסם משרה",  icon: ClipboardList },
                    ]}
                  />
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
              style={{ fontSize: 12, color: color.danger, textAlign: "center",
                marginBottom: 8, padding: "4px 0" }}>
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit — the single primary action */}
        <PrimaryButton onClick={handleSubmit} disabled={loading || avatarUploading}
          style={{ marginBottom: 16 }}>
          {loading ? <Spinner size={18} /> : (
            <><Zap size={16} strokeWidth={2} /> {tab === "login" ? "כניסה לחשבון" : "יצירת חשבון חינם"}</>
          )}
        </PrimaryButton>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0 12px" }}>
          <div style={{ flex: 1, height: 1, background: color.borderSubtle }} />
          <span style={{ fontSize: 11, color: color.textMuted, fontWeight: 500 }}>או</span>
          <div style={{ flex: 1, height: 1, background: color.borderSubtle }} />
        </div>

        <SecondaryButton onClick={onGuest} style={{ height: 48, fontSize: 13, color: color.textSecondary }}>
          המשך כאורח (מצב צפייה)
        </SecondaryButton>

        <div style={{ fontSize: 10, color: color.textMuted, textAlign: "center",
          marginTop: 16, lineHeight: 1.6 }}>
          בהמשך אתה מסכים לתנאי השימוש ומדיניות הפרטיות של Jesta
        </div>
      </motion.div>
    </Wrapper>
  );
}
