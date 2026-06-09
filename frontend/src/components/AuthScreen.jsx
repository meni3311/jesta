/**
 * AuthScreen — Jesta dark-luxury onboarding
 *
 * Props:
 *   onGuest  fn  — skip auth, enter as guest (view-only mode)
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";

// ── Google SVG logo (official colours, no external fetch) ────────────────────
function GoogleLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-1.9 13.6-5.1l-6.3-5.2C29.5 35.5 26.9 36 24 36c-5.2 0-9.6-3-11.3-7.3l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.3 5.2C41.1 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"/>
    </svg>
  );
}

// ── Lightning bolt hero icon ──────────────────────────────────────────────────
function BoltHero() {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Outermost glow ring */}
      <motion.div
        animate={{ scale: [1, 1.35, 1], opacity: [0.12, 0, 0.12] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          width: 180, height: 180, borderRadius: "50%",
          background: "radial-gradient(circle, #9333ea 0%, transparent 70%)",
        }}
      />
      {/* Middle ring */}
      <motion.div
        animate={{ scale: [1, 1.22, 1], opacity: [0.22, 0, 0.22] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
        style={{
          position: "absolute",
          width: 130, height: 130, borderRadius: "50%",
          background: "radial-gradient(circle, #a855f7 0%, transparent 70%)",
        }}
      />
      {/* Inner glow */}
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.15, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
        style={{
          position: "absolute",
          width: 90, height: 90, borderRadius: "50%",
          background: "radial-gradient(circle, #c084fc 0%, transparent 70%)",
        }}
      />
      {/* Bolt container */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: 72, height: 72, borderRadius: 22,
          background: "linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #ec4899 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 40px rgba(147,51,234,0.7), 0 0 80px rgba(147,51,234,0.3)",
          position: "relative", zIndex: 1,
        }}
      >
        <span style={{ fontSize: 36, lineHeight: 1 }}>⚡</span>
      </motion.div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AuthScreen({ onGuest }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: import.meta.env.VITE_AUTH_REDIRECT_URL ?? window.location.origin,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success Supabase redirects the browser — no further action needed here
  };

  return (
    <div
      dir="rtl"
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, #06030f 0%, #0d0824 60%, #110932 100%)",
        fontFamily: "'Heebo', 'Segoe UI', system-ui, sans-serif",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ── Ambient grid lines ── */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage:
          "linear-gradient(#7c3aed 1px, transparent 1px), linear-gradient(90deg, #7c3aed 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />

      {/* ── Hero section ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 24px",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Brand wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0, 0.2, 1] }}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#a78bfa",
            letterSpacing: 4,
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          JESTA
        </motion.div>

        {/* Animated bolt */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.15 }}
          style={{ marginBottom: 32 }}
        >
          <BoltHero />
        </motion.div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.3, ease: [0.25, 0, 0.2, 1] }}
          style={{ textAlign: "center" }}
        >
          <div style={{
            fontSize: 26,
            fontWeight: 900,
            lineHeight: 1.25,
            marginBottom: 10,
            background: "linear-gradient(135deg, #e9d5ff 0%, #c4b5fd 40%, #ec4899 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            סוגרים ג׳סטה.
            <br />
            עושים כסף. ⚡
          </div>
          <div style={{
            fontSize: 14,
            color: "#6b7280",
            fontWeight: 500,
            lineHeight: 1.5,
          }}>
            מצא עבודה קצרה ליד הבית תוך דקות
          </div>
        </motion.div>

        {/* Floating sparkles */}
        {[
          { top: "15%", left: "8%",  delay: 0,    size: 6  },
          { top: "25%", right: "10%", delay: 0.7, size: 4  },
          { top: "60%", left: "5%",  delay: 1.2,  size: 5  },
          { top: "70%", right: "8%", delay: 0.4,  size: 7  },
        ].map((s, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0, 0.7, 0], scale: [0.5, 1, 0.5] }}
            transition={{ duration: 2.5, delay: s.delay, repeat: Infinity, repeatDelay: 1.5 }}
            style={{
              position: "absolute",
              top: s.top, left: s.left, right: s.right,
              width: s.size, height: s.size,
              borderRadius: "50%",
              background: "#a855f7",
              boxShadow: `0 0 ${s.size * 2}px #a855f7`,
            }}
          />
        ))}
      </div>

      {/* ── Auth card — slides up ── */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 30, delay: 0.45 }}
        style={{
          background: "linear-gradient(180deg, #12093a 0%, #0f0730 100%)",
          borderTop: "1px solid rgba(167,139,250,0.18)",
          borderRadius: "28px 28px 0 0",
          padding: "28px 24px 36px",
          position: "relative",
          zIndex: 2,
          flexShrink: 0,
        }}
      >
        {/* Handle bar */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: "rgba(167,139,250,0.25)",
          margin: "0 auto 24px",
        }} />

        {/* Heading */}
        <div style={{
          fontSize: 20, fontWeight: 900, color: "#f5f3ff",
          marginBottom: 6, textAlign: "center",
        }}>
          מוכן להתחיל לעשות כסף?
        </div>
        <div style={{
          fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 24,
        }}>
          הרשמה חינמית — לוקח 10 שניות
        </div>

        {/* ── Google button ── */}
        <motion.button
          whileHover={{ scale: 1.025 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "14px 20px",
            borderRadius: 16,
            border: "none",
            background: loading
              ? "rgba(255,255,255,0.06)"
              : "#ffffff",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            boxShadow: loading
              ? "none"
              : "0 0 24px rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.4)",
            transition: "background 0.2s, box-shadow 0.2s",
            marginBottom: 12,
          }}
        >
          {loading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              style={{
                width: 20, height: 20, borderRadius: "50%",
                border: "2.5px solid #7c3aed",
                borderTopColor: "transparent",
              }}
            />
          ) : (
            <GoogleLogo size={20} />
          )}
          <span style={{
            fontSize: 15, fontWeight: 700,
            color: loading ? "#6b7280" : "#111827",
          }}>
            {loading ? "מתחבר..." : "המשך עם Google"}
          </span>
        </motion.button>

        {/* ── Error message ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                fontSize: 12, color: "#f87171", textAlign: "center",
                marginBottom: 10, padding: "6px 0",
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Divider */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, margin: "16px 0",
        }}>
          <div style={{ flex: 1, height: 1, background: "rgba(167,139,250,0.12)" }} />
          <span style={{ fontSize: 11, color: "#4b5563", fontWeight: 500 }}>או</span>
          <div style={{ flex: 1, height: 1, background: "rgba(167,139,250,0.12)" }} />
        </div>

        {/* ── Guest link ── */}
        <motion.button
          whileHover={{ opacity: 1 }}
          whileTap={{ scale: 0.97 }}
          onClick={onGuest}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 14,
            border: "1px solid rgba(167,139,250,0.18)",
            background: "transparent",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13,
            fontWeight: 600,
            color: "#a78bfa",
            opacity: 0.8,
            transition: "opacity 0.2s",
            textAlign: "center",
          }}
        >
          המשך כאורח (מצב צפייה) 👀
        </motion.button>

        {/* Fine print */}
        <div style={{
          fontSize: 10.5, color: "#374151", textAlign: "center", marginTop: 18,
          lineHeight: 1.6,
        }}>
          בהמשך אתה מסכים לתנאי השימוש ומדיניות הפרטיות של Jesta
        </div>
      </motion.div>
    </div>
  );
}
