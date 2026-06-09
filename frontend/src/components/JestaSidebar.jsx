/**
 * JestaSidebar — Premium RTL navigation drawer
 *
 * Props (new):
 *   user                  { fullName, avatarUrl, role, isVerified, rating, completedJobs }
 *   isGuest               boolean
 *   onOpenProfileSettings opens JestaProfileSettings
 *   onSignOut             clears session
 */
import { useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  X, CalendarDays, Wallet, UserCog, MessageSquare,
  ChevronLeft, Briefcase, BarChart3, PlusCircle,
  Receipt, LogOut, ShieldCheck, ShieldAlert,
} from "lucide-react";

const SURFACE  = "#ffffff";
const BORDER   = "#f1f0fb";
const MUTED    = "#94a3b8";
const GOLD     = "#d97706";
const GOLD_LT  = "#fef3c7";
const VIOLET   = "#7c3aed";
const VIOLET_L = "#f5f3ff";
const SLATE    = "#0f172a";

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

function Divider() {
  return <div style={{ height: 1, background: BORDER, margin: "6px 0" }} />;
}

function LevelBar({ pct = 0 }) {
  const capped = Math.min(100, pct);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: GOLD }}>🏆 ג׳סטר זהב</span>
        <span style={{ fontSize: 10.5, color: MUTED, fontWeight: 500 }}>{capped}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#f1f5f9", overflow: "hidden" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${capped}%` }}
          transition={{ duration: 1.1, delay: 0.3, ease: [0.25, 0, 0.2, 1] }}
          style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg,#a78bfa,#fbbf24)" }} />
      </div>
      <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 500, marginTop: 5 }}>עוד 2 משמרות לג׳סטר מאסטר ⚡</div>
    </div>
  );
}

function NavItem({ icon: Icon, label, sub, badge, accentColor, onClick = () => {} }) {
  const iconBg  = accentColor ? `${accentColor}18` : VIOLET_L;
  const iconClr = accentColor ?? VIOLET;
  return (
    <motion.button whileHover={{ x: -4, backgroundColor: "#f8f7ff" }} whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "11px 14px",
        borderRadius: 14, border: "none", background: "transparent", cursor: "pointer",
        fontFamily: "inherit", textAlign: "right", transition: "background 0.15s" }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        background: iconBg, display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative" }}>
        <Icon size={17} color={iconClr} strokeWidth={2} />
        {badge && (
          <div style={{ position: "absolute", top: -3, left: -3, width: 13, height: 13,
            borderRadius: "50%", background: "#f97316", border: "2px solid #fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 7, fontWeight: 900, color: "#fff" }}>{badge}</div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: SLATE, lineHeight: 1.3 }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 500, marginTop: 2 }}>{sub}</div>}
      </div>
      <ChevronLeft size={15} color="#cbd5e1" strokeWidth={2} style={{ flexShrink: 0 }} />
    </motion.button>
  );
}

function ModeToggle({ isEmployer, onToggle }) {
  return (
    <LayoutGroup id="sidebar-mode">
      <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 50, padding: 4,
        border: "1px solid #e2e8f0", margin: "0 0 6px" }}>
        {[{ key: false, label: "עובד ⚡" }, { key: true, label: "מעסיק 💼" }].map(({ key, label }) => (
          <button key={String(key)} onClick={() => onToggle(key)}
            style={{ flex: 1, padding: "8px 6px", borderRadius: 50, border: "none",
              background: "transparent", cursor: "pointer", fontFamily: "inherit",
              fontSize: 12.5, fontWeight: 700, color: isEmployer === key ? "#fff" : MUTED,
              position: "relative", zIndex: 1, transition: "color 0.2s" }}>
            {isEmployer === key && (
              <motion.div layoutId="mode-pill"
                style={{ position: "absolute", inset: 0, borderRadius: 50, zIndex: -1,
                  background: isEmployer
                    ? "linear-gradient(135deg,#d97706,#92400e)"
                    : "linear-gradient(135deg,#9333ea,#ec4899)",
                  boxShadow: isEmployer
                    ? "0 4px 14px rgba(217,119,6,0.35)"
                    : "0 4px 14px rgba(147,51,234,0.35)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }} />
            )}
            {label}
          </button>
        ))}
      </div>
    </LayoutGroup>
  );
}

function UserAvatar({ user, isEmployer, size = 64, onClick }) {
  const name   = user?.fullName ?? "";
  const src    = user?.avatarUrl;
  const abbrev = initials(name);
  const gradient = isEmployer
    ? "linear-gradient(135deg,#fbbf24,#d97706)"
    : "linear-gradient(135deg,#a78bfa,#7c3aed)";
  const borderColor = isEmployer ? "#fbbf24" : VIOLET;

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <motion.div animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.2, 0.5] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: "absolute", inset: -4, borderRadius: "50%",
          border: `2px solid ${isEmployer ? "rgba(217,119,6,0.4)" : "rgba(147,51,234,0.4)"}`,
          transition: "border-color 0.4s" }} />
      <motion.div whileTap={{ scale: 0.92 }} onClick={onClick}
        style={{ width: size, height: size, borderRadius: "50%", cursor: onClick ? "pointer" : "default",
          background: src ? "transparent" : gradient,
          border: `2.5px solid ${borderColor}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 4px 20px ${isEmployer ? "rgba(217,119,6,0.25)" : "rgba(124,58,237,0.25)"}`,
          overflow: "hidden" }}>
        {src
          ? <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 20, fontWeight: 900, color: "#fff",
              fontFamily: "'Heebo',system-ui,sans-serif" }}>{abbrev || "👤"}</span>
        }
      </motion.div>
      <div style={{ position: "absolute", bottom: 2, left: 2, width: 12, height: 12,
        borderRadius: "50%", background: "#4ade80", border: "2px solid #fff" }} />
    </div>
  );
}

export default function JestaSidebar({
  isOpen, onClose, onGoToSchedule, onOpenCreateModal,
  onGoToEmployerDashboard, onSwitchMode, onOpenProfile,
  onOpenProfileSettings, onSignOut,
  user = null, isGuest = false,
}) {
  const [isEmployer, setIsEmployer] = useState(false);
  const isVerified  = user?.isVerified ?? false;
  const displayName = isGuest ? "אורח 👀" : (user?.fullName ?? "משתמש");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }} onClick={onClose}
            style={{ position: "absolute", inset: 0, zIndex: 5000,
              background: "rgba(15,23,42,0.45)",
              backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} />

          <motion.div key="panel" dir="rtl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "83%",
              zIndex: 5001, background: SURFACE, borderLeft: `1px solid ${BORDER}`,
              borderRadius: "0 0 0 28px", display: "flex", flexDirection: "column",
              overflow: "hidden", fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif",
              boxShadow: "-12px 0 48px rgba(109,40,217,0.12)" }}>

            {/* Ambient glow */}
            <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200,
              borderRadius: "50%",
              background: isEmployer
                ? "radial-gradient(circle,rgba(217,119,6,0.08) 0%,transparent 70%)"
                : "radial-gradient(circle,rgba(147,51,234,0.10) 0%,transparent 70%)",
              pointerEvents: "none", transition: "background 0.5s" }} />

            {/* Header */}
            <div style={{ padding: "52px 20px 16px", position: "relative" }}>
              <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
                style={{ position: "absolute", top: 16, left: 16, width: 32, height: 32,
                  borderRadius: "50%", background: "#f1f5f9", border: "1px solid #e2e8f0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer" }}>
                <X size={15} color={MUTED} strokeWidth={2.5} />
              </motion.button>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 4 }}>
                {/* Avatar */}
                {isGuest ? (
                  <div style={{ width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
                    background: "linear-gradient(135deg,#e2e8f0,#cbd5e1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 26, border: "2.5px solid #e2e8f0" }}>👀</div>
                ) : (
                  <UserAvatar user={user} isEmployer={isEmployer}
                    onClick={() => { onOpenProfile?.(isEmployer ? "employer" : "worker"); onClose(); }} />
                )}

                {/* Identity */}
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: SLATE,
                    lineHeight: 1.25, marginBottom: 5 }}>{displayName}</div>

                  {isGuest ? (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5,
                      background: "#f1f5f9", border: "1px solid #e2e8f0",
                      borderRadius: 20, padding: "3px 10px" }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: MUTED }}>מצב צפייה</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5,
                        background: GOLD_LT, border: "1px solid #fde68a",
                        borderRadius: 20, padding: "3px 10px", width: "fit-content" }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: GOLD }}>
                          {isEmployer ? "💼 מעסיק" : `${user?.rating?.toFixed(1) ?? "–"} ⭐`}
                        </span>
                        {!isEmployer && (
                          <span style={{ fontSize: 11, color: "#92400e", fontWeight: 500, opacity: 0.7 }}>
                            {user?.completedJobs ?? 0} ג׳סטות
                          </span>
                        )}
                      </div>

                      {/* Verification pill */}
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4,
                        background: isVerified ? "rgba(74,222,128,0.1)" : "rgba(251,191,36,0.1)",
                        border: `1px solid ${isVerified ? "rgba(74,222,128,0.3)" : "rgba(251,191,36,0.3)"}`,
                        borderRadius: 20, padding: "2px 9px", width: "fit-content" }}>
                        {isVerified
                          ? <ShieldCheck size={11} color="#4ade80" strokeWidth={2.5} />
                          : <ShieldAlert size={11} color="#fbbf24" strokeWidth={2.5} />}
                        <span style={{ fontSize: 10.5, fontWeight: 700,
                          color: isVerified ? "#4ade80" : "#fbbf24" }}>
                          {isVerified ? "מאומת ✓" : "מייל לא מאומת ⚠️"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!isGuest && !isEmployer && (
                <LevelBar pct={Math.min(100, (user?.completedJobs ?? 0) * 10)} />
              )}
            </div>

            <Divider />

            {/* Mode toggle */}
            <div style={{ padding: "4px 14px 6px" }}>
              <ModeToggle isEmployer={isEmployer} onToggle={(val) => {
                setIsEmployer(val);
                onSwitchMode?.(val ? "employer" : "worker");
                onClose();
              }} />
            </div>

            <Divider />

            {/* Nav */}
            <div style={{ padding: "4px 10px", flex: 1, overflowY: "auto" }}>
              <AnimatePresence mode="wait">
                {isEmployer ? (
                  <motion.div key="employer-nav"
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.22 }}>
                    <NavItem icon={BarChart3}  label="דאשבורד וסטטיסטיקות" sub="3 ג׳סטות פעילות"   accentColor="#d97706" onClick={() => { onGoToEmployerDashboard?.(); onClose(); }} />
                    <NavItem icon={PlusCircle} label="פרסם ג׳סטה חדשה"   sub="הוסף משרה חדשה"    accentColor="#059669" onClick={() => { onOpenCreateModal?.(); onClose(); }} />
                    <NavItem icon={Receipt}    label="היסטוריית תשלומים"  sub="₪2,400 שולמו"      accentColor="#0369a1" />
                  </motion.div>
                ) : (
                  <motion.div key="worker-nav"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22 }}>
                    <NavItem icon={CalendarDays} label="לוח המשמרות שלי" sub="2 משמרות השבוע" badge="2" onClick={() => { onGoToSchedule?.(); onClose(); }} />
                    <NavItem icon={Wallet}       label="היסטוריית עבודות" sub="₪1,240 נצברו" />
                    <NavItem icon={UserCog}      label="הגדרות פרופיל ואימות" sub="עדכן תמונה ופרטים" onClick={() => { onOpenProfileSettings?.(); onClose(); }} />
                  </motion.div>
                )}
              </AnimatePresence>

              <Divider />

              {/* CTA button */}
              <div style={{ padding: "10px 4px 6px" }}>
                <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { isEmployer ? onGoToEmployerDashboard?.() : onOpenCreateModal?.(); onClose(); }}
                  style={{ width: "100%", padding: "15px 20px", borderRadius: 50, border: "none",
                    background: isEmployer
                      ? "linear-gradient(135deg,#d97706,#92400e)"
                      : "linear-gradient(135deg,#9333ea,#ec4899)",
                    color: "#fff", fontSize: 14.5, fontWeight: 900, cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: isEmployer ? "0 6px 24px rgba(217,119,6,0.35)" : "0 6px 24px rgba(147,51,234,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    position: "relative", overflow: "hidden", transition: "background 0.35s, box-shadow 0.35s" }}>
                  <motion.div animate={{ x: ["-120%","220%"] }}
                    transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.8, ease: "easeInOut" }}
                    style={{ position: "absolute", top: 0, left: 0, width: "45%", height: "100%",
                      background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)",
                      pointerEvents: "none" }} />
                  <Briefcase size={16} color="rgba(255,255,255,0.9)" strokeWidth={2} />
                  <span>{isEmployer ? "דאשבורד מעסיק 📊" : "צריך עובד? פרסם ג׳סטה 💼"}</span>
                </motion.button>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "10px 14px 24px" }}>
              <Divider />
              <motion.button whileHover={{ x: -3 }} whileTap={{ scale: 0.97 }}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "11px 8px", borderRadius: 12, border: "none",
                  background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MessageSquare size={16} color={MUTED} strokeWidth={2} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: MUTED }}>עזרה ב-WhatsApp 💬</div>
                </div>
              </motion.button>

              {!isGuest && onSignOut && (
                <motion.button whileHover={{ x: -3 }} whileTap={{ scale: 0.97 }}
                  onClick={() => { onSignOut(); onClose(); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 8px", borderRadius: 12, border: "none",
                    background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: "rgba(239,68,68,0.08)", display: "flex",
                    alignItems: "center", justifyContent: "center" }}>
                    <LogOut size={16} color="#ef4444" strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#ef4444" }}>יציאה מהחשבון</div>
                  </div>
                </motion.button>
              )}

              <div style={{ textAlign: "left", marginTop: 6 }}>
                <span style={{ fontSize: 10, color: "#cbd5e1", fontWeight: 500 }}>Jesta v1.0.0</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
