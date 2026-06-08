import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { INITIAL_JOBS }          from "./components/JestaJobsFeed";
import JestaJobsFeed             from "./components/JestaJobsFeed";
import JestaJobDetails           from "./components/JestaJobDetails";
import JestaPending              from "./components/JestaPending";
import JestaSchedule             from "./components/JestaSchedule";
import JestaEmployerDashboard    from "./components/JestaEmployerDashboard";
import JestaSidebar              from "./components/JestaSidebar";
import JestaCreateModal          from "./components/JestaCreateModal";
import JestaPublicProfile, { WORKER_DEFAULTS, EMPLOYER_DEFAULTS } from "./components/JestaPublicProfile";

// ── Transition variants ───────────────────────────────────────────────────────
const slide = {
  enterLeft:  { x: "-100%", opacity: 0 },
  enterRight: { x: "100%",  opacity: 0 },
  center:     { x: 0,       opacity: 1 },
  exitLeft:   { x: "-100%", opacity: 0 },
  exitRight:  { x: "100%",  opacity: 0 },
};
const slideUp = {
  enter:  { y: "60%", opacity: 0 },
  center: { y: 0,     opacity: 1 },
  exit:   { y: "60%", opacity: 0 },
};
const tx   = { type: "tween",  ease: [0.32, 0, 0.1, 1], duration: 0.38 };
const txUp = { type: "spring", stiffness: 320, damping: 34 };

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  // ── Jobs state (feeds the live map) ────────────────────────────────────────
  const [jobs, setJobs] = useState(INITIAL_JOBS);

  // ── Global approval state — shared between JestaSchedule & EmployerDashboard
  const [approvedWorkerIds, setApprovedWorkerIds] = useState(new Set());

  const approveWorker = (workerId) => {
    setApprovedWorkerIds((prev) => new Set([...prev, workerId]));
  };

  // Derived convenience: Cinema City shift (w-1) drives the pending card in Schedule
  const cinemaApproved = approvedWorkerIds.has("w-1");

  // ── Screen routing ──────────────────────────────────────────────────────────
  // "feed" | "details" | "pending" | "schedule" | "employer-dashboard"
  const [screen,   setScreen]   = useState("feed");
  const [selected, setSelected] = useState(null);
  const [dir,      setDir]      = useState(1);

  // ── Overlay states ──────────────────────────────────────────────────────────
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Profile modal — type: "worker"|"employer", data: partial userData object
  const [profileModal, setProfileModal] = useState({ isOpen: false, type: "worker", data: null });

  const openProfile = (typeOrData, extraData = null) => {
    if (typeof typeOrData === "string") {
      setProfileModal({ isOpen: true, type: typeOrData, data: extraData });
    } else {
      const type = typeOrData?.type ?? "worker";
      setProfileModal({ isOpen: true, type, data: typeOrData });
    }
  };
  const closeProfile = () => setProfileModal((p) => ({ ...p, isOpen: false }));

  // ── Navigation helpers ──────────────────────────────────────────────────────
  const goTo = (screen, job = null, direction = 1) => {
    setSelected(job);
    setDir(direction);
    setScreen(screen);
    setSidebarOpen(false);
  };

  const goToDetails          = (job) => goTo("details", job, 1);
  const goToPending          = (job) => goTo("pending", job, 1);
  const goToSchedule         = ()    => goTo("schedule", null, 1);
  const goToEmployerDashboard= ()    => goTo("employer-dashboard", null, 1);
  const goBack               = ()    => goTo("feed", null, -1);

  // ── Publish new job ─────────────────────────────────────────────────────────
  const handlePublish = (newJob) => {
    setJobs((prev) => [newJob, ...prev]);
    setSidebarOpen(false);
    setScreen("feed");
  };

  const handleOpenCreate = () => {
    setSidebarOpen(false);
    setTimeout(() => setCreateModalOpen(true), 280);
  };

  // ── Screen motion helpers ───────────────────────────────────────────────────
  const pushEnter  = dir === -1 ? slide.enterRight : slide.enterLeft;
  const pushExit   = dir === 1  ? slide.exitLeft   : slide.exitRight;

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "flex-start",
      minHeight: "100vh", background: "#06030f",
      padding: "24px 0", overflow: "hidden",
    }}>
      {/* Phone frame */}
      <div style={{
        width: 360, height: 780, borderRadius: 44, overflow: "hidden",
        position: "relative", border: "1.5px solid #1e1040",
        boxShadow: "0 0 0 7px #0d0824, 0 40px 80px rgba(0,0,0,0.8)",
      }}>

        <AnimatePresence mode="wait" initial={false}>

          {screen === "feed" && (
            <motion.div key="feed" style={{ position: "absolute", inset: 0 }}
              initial={pushEnter} animate={slide.center} exit={pushExit} transition={tx}>
              <JestaJobsFeed
                jobs={jobs}
                onJobSelect={goToDetails}
                onApply={goToPending}
                onOpenSidebar={() => setSidebarOpen(true)}
                onOpenProfile={openProfile}
              />
            </motion.div>
          )}

          {screen === "details" && (
            <motion.div key="details" style={{ position: "absolute", inset: 0 }}
              initial={dir === 1 ? slide.enterLeft : slide.enterRight}
              animate={slide.center}
              exit={dir === -1 ? slide.exitRight : slide.exitLeft}
              transition={tx}>
              <JestaJobDetails job={selected} onBack={goBack} onApply={goToPending} onOpenProfile={openProfile} />
            </motion.div>
          )}

          {screen === "pending" && (
            <motion.div key="pending" style={{ position: "absolute", inset: 0 }}
              initial={slide.enterLeft} animate={slide.center} exit={slide.exitRight} transition={tx}>
              <JestaPending job={selected} onBack={goBack} />
            </motion.div>
          )}

          {screen === "schedule" && (
            <motion.div key="schedule" style={{ position: "absolute", inset: 0 }}
              initial={slideUp.enter} animate={slideUp.center} exit={slideUp.exit} transition={txUp}>
              <JestaSchedule
                onBack={goBack}
                isApproved={cinemaApproved}
                onLocalApprove={() => approveWorker("w-1")}
              />
            </motion.div>
          )}

          {screen === "employer-dashboard" && (
            <motion.div key="employer-dashboard" style={{ position: "absolute", inset: 0 }}
              initial={slideUp.enter} animate={slideUp.center} exit={slideUp.exit} transition={txUp}>
              <JestaEmployerDashboard
                onBack={goBack}
                onOpenCreate={handleOpenCreate}
                onApproveWorker={approveWorker}
                approvedWorkerIds={approvedWorkerIds}
                onOpenProfile={openProfile}
              />
            </motion.div>
          )}

        </AnimatePresence>

        {/* Sidebar */}
        <JestaSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onGoToSchedule={goToSchedule}
          onOpenCreateModal={handleOpenCreate}
          onGoToEmployerDashboard={goToEmployerDashboard}
          onOpenProfile={openProfile}
        />

        {/* Create modal */}
        <JestaCreateModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onPublish={handlePublish}
        />

        {/* Public profile modal — topmost layer (z-7000) */}
        <JestaPublicProfile
          isOpen={profileModal.isOpen}
          onClose={closeProfile}
          type={profileModal.type}
          userData={profileModal.data}
        />

      </div>
    </div>
  );
}
