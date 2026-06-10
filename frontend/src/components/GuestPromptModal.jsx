/**
 * GuestPromptModal — blocks guests from protected actions
 *
 * Props:
 *   isOpen      boolean
 *   onClose()   dismiss
 *   onSignUp()  route to registration (sets authState back to false)
 */
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import { color, radius, shadow, font, styles } from "../design-system";
import { SheetHandle, PrimaryButton, SecondaryButton } from "./ui";

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
              background: "rgba(10,10,15,0.82)",
            }}
          />

          {/* Sheet */}
          <motion.div
            key="card"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            style={{
              position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 9001,
              ...styles.sheet,
              padding: "0 20px 40px",
              fontFamily: font.family,
              direction: "rtl",
            }}
          >
            <SheetHandle />

            {/* Icon */}
            <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
              <div style={{
                width: 60, height: 60, borderRadius: radius.card,
                background: `linear-gradient(135deg, ${color.surface3} 0%, ${color.primarySoft} 100%)`,
                border: `1px solid ${color.borderStrong}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: shadow.glow,
              }}>
                <Zap size={26} color={color.primaryText} strokeWidth={1.75} />
              </div>
            </div>

            {/* Headline */}
            <div style={{
              fontSize: 22, ...font.heading, textAlign: "center",
              lineHeight: 1.3, marginBottom: 8,
            }}>
              רגע! בשביל לעשות ג׳סטות
              <br />צריך להירשם
            </div>

            {/* Sub-text */}
            <div style={{ fontSize: 14, color: color.textSecondary, textAlign: "center",
              lineHeight: 1.6, marginBottom: 28, maxWidth: 260, marginInline: "auto" }}>
              ההרשמה חינמית ולוקחת 10 שניות.
              אחרי זה אתה מוכן לסגור ג׳סטות בלי הגבלה!
            </div>

            {/* Sign up CTA */}
            <PrimaryButton onClick={onSignUp} style={{ marginBottom: 12 }}>
              להרשמה מהירה לחץ כאן
            </PrimaryButton>

            {/* Dismiss */}
            <SecondaryButton onClick={onClose} style={{ height: 48, fontSize: 13, color: color.textSecondary }}>
              אולי אחר כך
            </SecondaryButton>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
