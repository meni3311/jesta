/**
 * JestaSidebar — Premium RTL navigation drawer
 *
 * Props (new):
 *   user                  { fullName, avatarUrl, role, isVerified, rating, completedJobs }
 *   isGuest               boolean
 *   onOpenProfileSettings opens JestaProfileSettings
 *   onSignOut             clears session
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, CalendarDays, Wallet, UserCog, MessageSquare,
  ChevronLeft, Briefcase, BarChart3, PlusCircle,
  Receipt, LogOut, ShieldCheck, ShieldAlert, Zap, Star, Eye, Trophy,
} from "lucide-react";
import { color, radius, font, styles } from "../design-system";
import { Avatar, Badge, SegmentedControl, PrimaryButton } from "./ui";

function Divider() {
  return <div style={{ height: 1, background: color.borderSubtle, margin: "8px 0" }} />;
}

function LevelBar({ pct = 0, completedJobs = 0 }) {
  const capped = Math.min(100, pct);
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, color: color.primaryText }}>
          <Trophy size={11} strokeWidth={2} /> ג׳סטר זהב
        </span>
        <span style={{ fontSize: 10, color: color.textMuted, fontWeight: 500 }}>{capped}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: color.surface3, overflow: "hidden" }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${capped}%` }}
          transition={{ duration: 1.1, delay: 0.3, ease: [0.25, 0, 0.2, 1] }}
          style={{ height: "100%", borderRadius: 3, background: color.primary }} />
      </div>
      <div style={{ fontSize: 10, color: color.textMuted, fontWeight: 400, marginTop: 4 }}>
        {completedJobs} ג׳סטות הושלמו
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, sub, badge, onClick = () => {} }) {
  return (
    <motion.button whileHover={{ x: -4, backgroundColor: color.surface2 }} whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px",
        borderRadius: radius.input, border: "none", background: "transparent", cursor: "pointer",
        fontFamily: font.family, textAlign: "right", transition: "background 0.15s" }}>
      <div style={{ ...styles.iconBox(36), position: "relative" }}>
        <Icon size={16} color={color.primaryText} strokeWidth={1.75} />
        {badge && (
          <div style={{ position: "absolute", top: -4, insetInlineEnd: -4, minWidth: 14, height: 14,
            borderRadius: 7, background: color.primary, border: `2px solid ${color.surface1}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 700, color: "#fff", boxSizing: "content-box" }}>{badge}</div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: color.textPrimary, lineHeight: 1.3 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: color.textSecondary, fontWeight: 400, marginTop: 2 }}>{sub}</div>}
      </div>
      <ChevronLeft size={15} color={color.textMuted} strokeWidth={2} style={{ flexShrink: 0 }} />
    </motion.button>
  );
}

export default function JestaSidebar({
  isOpen, onClose, onGoToSchedule, onOpenCreateModal,
  onGoToEmployerDashboard, onSwitchMode, onOpenProfile,
  onOpenProfileSettings, onSignOut,
  user = null, isGuest = false, mode = "worker",
}) {
  // Initialise from the authoritative mode coming from App, then keep in sync.
  // This ensures employers see the employer nav immediately on login / session
  // restore without having to manually toggle the mode switch.
  const [isEmployer, setIsEmployer] = useState(mode === "employer");
  useEffect(() => { setIsEmployer(mode === "employer"); }, [mode]);
  const isVerified  = user?.isVerified ?? false;
  const displayName = isGuest ? "אורח" : (user?.fullName ?? "משתמש");

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }} onClick={onClose}
            style={{ position: "absolute", inset: 0, zIndex: 5000,
              background: "rgba(10,10,15,0.6)" }} />

          <motion.div key="panel" dir="rtl"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "83%",
              zIndex: 5001, background: color.surface1,
              borderLeft: `1px solid ${color.borderSubtle}`,
              display: "flex", flexDirection: "column",
              overflow: "hidden", fontFamily: font.family,
              boxShadow: "-12px 0 48px rgba(0,0,0,0.5)" }}>

            {/* Header */}
            <div style={{ padding: "52px 20px 16px", position: "relative" }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
                style={{ ...styles.iconButton, width: 32, height: 32, position: "absolute", top: 16, left: 16 }}>
                <X size={15} color={color.textSecondary} strokeWidth={2} />
              </motion.button>

              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 4 }}>
                {/* Avatar */}
                {isGuest ? (
                  <div style={{ ...styles.iconBox(64), borderRadius: "50%" }}>
                    <Eye size={26} color={color.textMuted} strokeWidth={1.5} />
                  </div>
                ) : (
                  <Avatar size={64} src={user?.avatarUrl} employer={isEmployer} online surface={color.surface1}
                    onClick={() => { onOpenProfile?.(isEmployer ? "employer" : "worker"); onClose(); }} />
                )}

                {/* Identity */}
                <div style={{ flex: 1, paddingTop: 4 }}>
                  <div style={{ fontSize: 17, ...font.heading,
                    lineHeight: 1.25, marginBottom: 8 }}>{displayName}</div>

                  {isGuest ? (
                    <Badge variant="locked">מצב צפייה</Badge>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                      <Badge variant="primary" icon={isEmployer ? Briefcase : Star}>
                        {isEmployer ? "מעסיק" : `${user?.rating?.toFixed(1) ?? "–"} · ${user?.completedJobs ?? 0} ג׳סטות`}
                      </Badge>

                      {/* Verification pill */}
                      <Badge variant={isVerified ? "approved" : "pending"}
                        icon={isVerified ? ShieldCheck : ShieldAlert}>
                        {isVerified ? "מאומת" : "מייל לא מאומת"}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {!isGuest && !isEmployer && (
                <LevelBar pct={Math.min(100, (user?.completedJobs ?? 0) * 10)}
                  completedJobs={user?.completedJobs ?? 0} />
              )}
            </div>

            <Divider />

            {/* Role toggle — segmented control, shared color language */}
            <div style={{ padding: "4px 16px 8px" }}>
              <SegmentedControl
                id="sidebar-mode"
                value={isEmployer}
                onChange={(val) => {
                  setIsEmployer(val);
                  onSwitchMode?.(val ? "employer" : "worker");
                  onClose();
                }}
                options={[
                  { key: false, label: "עובד",  icon: Zap },
                  { key: true,  label: "מעסיק", icon: Briefcase },
                ]}
              />
            </div>

            <Divider />

            {/* Nav */}
            <div style={{ padding: "4px 12px", flex: 1, overflowY: "auto" }}>
              <AnimatePresence mode="wait">
                {isEmployer ? (
                  <motion.div key="employer-nav"
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.22 }}>
                    <NavItem icon={BarChart3}  label="דאשבורד וסטטיסטיקות" sub="הג׳סטות והמועמדים שלך" onClick={() => { onGoToEmployerDashboard?.(); onClose(); }} />
                    <NavItem icon={PlusCircle} label="פרסם ג׳סטה חדשה"   sub="הוסף משרה חדשה"    onClick={() => { onOpenCreateModal?.(); onClose(); }} />
                    {/* TODO: payments history needs a payments table + endpoint
                        (none exist yet) — shown disabled until then */}
                    <div style={{ opacity: 0.45, pointerEvents: "none" }}>
                      <NavItem icon={Receipt} label="היסטוריית תשלומים" sub="בקרוב" />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="worker-nav"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22 }}>
                    <NavItem icon={CalendarDays} label="לוח המשמרות שלי" sub="המשמרות והבקשות שלך" onClick={() => { onGoToSchedule?.(); onClose(); }} />
                    {/* TODO: work/earnings history needs a payments/earnings
                        endpoint (none exists yet) — shown disabled until then */}
                    <div style={{ opacity: 0.45, pointerEvents: "none" }}>
                      <NavItem icon={Wallet} label="היסטוריית עבודות" sub="בקרוב" />
                    </div>
                    <NavItem icon={UserCog}      label="הגדרות פרופיל ואימות" sub="עדכן תמונה ופרטים" onClick={() => { onOpenProfileSettings?.(); onClose(); }} />
                  </motion.div>
                )}
              </AnimatePresence>

              <Divider />

              {/* CTA — the single primary action in the drawer */}
              <div style={{ padding: "8px 4px" }}>
                <PrimaryButton
                  onClick={() => { isEmployer ? onGoToEmployerDashboard?.() : onOpenCreateModal?.(); onClose(); }}
                  style={{ fontSize: 14 }}>
                  <Briefcase size={16} color="#fff" strokeWidth={2} />
                  <span>{isEmployer ? "דאשבורד מעסיק" : "צריך עובד? פרסם ג׳סטה"}</span>
                </PrimaryButton>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "8px 16px 24px" }}>
              <Divider />
              {/* TODO: replace with the real support WhatsApp number once one
                  exists — disabled until then so the button isn't a dead end */}
              <motion.button disabled
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 8px", borderRadius: radius.input, border: "none", opacity: 0.45,
                  background: "transparent", cursor: "not-allowed", fontFamily: font.family, textAlign: "right" }}>
                <div style={styles.iconBox(32)}>
                  <MessageSquare size={15} color={color.textSecondary} strokeWidth={1.75} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: color.textSecondary }}>עזרה ב-WhatsApp (בקרוב)</div>
                </div>
              </motion.button>

              {!isGuest && onSignOut && (
                <motion.button whileHover={{ x: -3 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { onSignOut(); onClose(); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 8px", borderRadius: radius.input, border: "none",
                    background: "transparent", cursor: "pointer", fontFamily: font.family, textAlign: "right" }}>
                  {/* Destructive: surface bg, red text only */}
                  <div style={styles.iconBox(32)}>
                    <LogOut size={15} color={color.danger} strokeWidth={1.75} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: color.danger }}>יציאה מהחשבון</div>
                  </div>
                </motion.button>
              )}

              <div style={{ textAlign: "left", marginTop: 8 }}>
                <span style={{ fontSize: 10, color: color.textMuted, fontWeight: 400 }}>Jesta v1.0.0</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
