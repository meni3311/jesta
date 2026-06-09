/**
 * GuestPromptModal — blocks guests from protected actions
 *
 * Props:
 *   isOpen      boolean
 *   onClose()   dismiss
 *   onSignUp()  route to registration (sets authState back to false)
 */
import { motion, AnimatePresence } from "framer-motion";

const VIOLET  = "#7c3aed";
const PINK    = "#ec4899";

export default function GuestPromptModal({ isOpen, onClose, onSignUp }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "absolute", inset: 0, zIndex: 9000,
              background: "rgba(6,3,15,0.82)",
              backdropFilter: "blur(6px)",
            }}
          />

          {/* Card */}
          <motion.div
            key="card"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 9001,
              background: "linear-gradient(180deg, #12093a 0%, #0d0727 100%)",
              borderTop: "1px solid rgba(167,139,250,0.2)",
              borderRadius: "28px 28px 0 0",
              padding: "28px 24px 40px",
              fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif",
              direction: "rtl",
            }}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2,
              background: "rgba(167,139,250,0.25)", margin: "0 auto 24px" }} />

            {/* Icon */}
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              {/* Animated glow ring behind bolt */}
              <div style={{ position: "relative", display: "inline-flex",
                alignItems: "center", justifyContent: "center" }}>
                <motion.div
                  animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  style={{ position: "absolute", width: 90, height: 90,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, #9333ea 0%, transparent 70%)" }} />
                <div style={{
                  width: 60, height: 60, borderRadius: 18,
                  background: `linear-gradient(135deg, ${VIOLET}, ${PINK})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 32px rgba(147,51,234,0.6)",
                  position: "relative",
                }}>
                  <span style={{ fontSize: 28 }}>⚡</span>
                </div>
              </div>
            </div>

            {/* Headline */}
            <div style={{
              fontSize: 22, fontWeight: 900, textAlign: "center",
              lineHeight: 1.3, marginBottom: 10,
              background: `linear-gradient(135deg, #e9d5ff 0%, #c4b5fd 50%, ${PINK} 100%)`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              רגע! בשביל לעשות ג׳סטות
              <br />צריך להירשם... ⚡
            </div>

            {/* Sub-text */}
            <div style={{ fontSize: 14, color: "#6b7280", textAlign: "center",
              lineHeight: 1.6, marginBottom: 28 }}>
              ההרשמה חינמית ולוקחת 10 שניות.
              <br />
              אחרי זה אתה מוכן לסגור ג׳סטות בלי הגבלה!
            </div>

            {/* Sign up CTA */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={onSignUp}
              style={{
                width: "100%", padding: "15px", borderRadius: 18, border: "none",
                background: `linear-gradient(135deg, ${VIOLET} 0%, #9333ea 50%, ${PINK} 100%)`,
                color: "#fff", fontSize: 16, fontWeight: 900, cursor: "pointer",
                fontFamily: "inherit", letterSpacing: 0.3, marginBottom: 12,
                boxShadow: "0 8px 28px rgba(124,58,237,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                position: "relative", overflow: "hidden",
              }}
            >
              {/* Shimmer sweep */}
              <motion.div aria-hidden="true"
                animate={{ x: ["-100%", "250%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
                style={{
                  position: "absolute", top: 0, left: 0, width: "40%", height: "100%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
                  transform: "skewX(-18deg)", pointerEvents: "none",
                }} />
              <span>🚀 להרשמה מהירה לחץ כאן</span>
            </motion.button>

            {/* Dismiss */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              style={{
                width: "100%", padding: "12px", borderRadius: 14,
                border: "1px solid rgba(167,139,250,0.15)",
                background: "transparent", cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 600, color: "#6b7280",
              }}>
              אולי אחר כך
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
