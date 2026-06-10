/**
 * JestaJobsFeed — Full-screen map + draggable bottom sheet + advanced filters
 *
 * Interaction model:
 *   • Map pin tap   → navigate directly to JestaJobDetails (same as card tap)
 *   • Card tap      → navigate to full JestaJobDetails screen (onJobSelect)
 *   • Apply button  → lives only in JestaJobDetails
 *
 * Filter chain: keyword → radius (Haversine) → minWage → minRating
 *
 * Props:
 *   jobs            Job[]
 *   onJobSelect(job) card tap / pin tap → Details
 *   onApply(job)     kept in signature for Details screen usage
 *   onOpenSidebar()  avatar tap → Sidebar
 *   onOpenProfile()  employer name tap → PublicProfile
 */
import {
  useState, useRef, useEffect, useMemo, useCallback,
} from "react";
import {
  motion, AnimatePresence, useMotionValue, animate,
} from "framer-motion";
import {
  Clock, MapPin, CheckCircle2, Zap, Search,
  SlidersHorizontal, Star, X as IconX, ChevronRight,
} from "lucide-react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const VIOLET    = "#7c3aed";
const VIOLET_LT = "#ede9fe";
const MUTED     = "#94a3b8";
const SLATE     = "#0f172a";
const GOLD      = "#fbbf24";

// ─── Constants ────────────────────────────────────────────────────────────────
const SNAP       = { OPEN: 150, PEEK: 490, MIN: 690 };
const MAP_CENTER = [32.030, 34.800];
const MAP_ZOOM   = 11;
// TODO: replace with navigator.geolocation (with user permission) — for now
// the radius filter measures from a fixed central point in Gush Dan.
const USER_LAT   = 32.0608;
const USER_LNG   = 34.7874;

const FILTER_DEFAULTS = { radius: 50, minWage: 40, minRating: 0, keyword: "" };

// ─── Haversine ────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Leaflet price icon ───────────────────────────────────────────────────────
function createPriceIcon(pay, isActive, isNew = false) {
  const bg     = isActive
    ? "linear-gradient(135deg,#c084fc 0%,#6d28d9 100%)"
    : "linear-gradient(135deg,#8b5cf6 0%,#4c1d95 100%)";
  const tail   = isActive ? "#6d28d9" : "#4c1d95";
  const shadow = isActive
    ? "0 4px 18px rgba(124,58,237,0.75)"
    : "0 3px 12px rgba(109,40,217,0.45)";
  const newAnim = isNew
    ? "@keyframes jp{0%{transform:scale(0) translateY(-12px);opacity:0}60%{transform:scale(1.2) translateY(2px);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}"
    : "";
  const newStyle = isNew ? "animation:jp .55s cubic-bezier(.34,1.56,.64,1) both;" : "";
  return window.L.divIcon({
    className: "",
    iconSize: [56, 46], iconAnchor: [28, 46],
    html: `<style>${newAnim}</style>
      <div style="background:${bg};color:#fff;
        font-family:'Heebo','Segoe UI',sans-serif;font-size:13px;font-weight:900;
        padding:6px 12px;border-radius:14px;
        border:2.5px solid rgba(255,255,255,0.88);
        white-space:nowrap;box-shadow:${shadow};
        display:inline-block;letter-spacing:-0.3px;
        transform:${isActive ? "scale(1.08)" : "scale(1)"};
        transition:transform .2s;position:relative;${newStyle}">
        ${pay}
        <div style="position:absolute;bottom:-9px;left:50%;
          transform:translateX(-50%);width:0;height:0;
          border-left:6px solid transparent;border-right:6px solid transparent;
          border-top:9px solid ${tail};"></div>
      </div>`,
  });
}

// ─── Live Leaflet map ─────────────────────────────────────────────────────────
function LiveMap({ jobs, activePin, onPinClick, visibleJobIds }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef({});

  useEffect(() => {
    if (!containerRef.current || !window.L || mapRef.current) return;
    const L = window.L;
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
    const map = L.map(containerRef.current, {
      center: MAP_CENTER, zoom: MAP_ZOOM,
      scrollWheelZoom: false, zoomControl: false, attributionControl: false,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);
    L.circleMarker([USER_LAT, USER_LNG], { radius: 8,  fillColor: "#60a5fa", color: "#fff", weight: 2.5, fillOpacity: 1 }).addTo(map);
    L.circleMarker([USER_LAT, USER_LNG], { radius: 16, fillColor: "#3b82f6", color: "transparent", fillOpacity: 0.18 }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markersRef.current = {}; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    jobs.forEach((job) => {
      if (markersRef.current[job.id]) return;
      const marker = window.L.marker([job.lat, job.lng], {
        icon: createPriceIcon(job.pay, activePin === job.id, !!job.isNew),
      }).addTo(mapRef.current);
      marker.on("click", () => onPinClick(job));
      markersRef.current[job.id] = marker;
      if (job.isNew) mapRef.current.flyTo([job.lat, job.lng], 14, { animate: true, duration: 1.1 });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  useEffect(() => {
    jobs.forEach((job) => {
      markersRef.current[job.id]?.setIcon(createPriceIcon(job.pay, activePin === job.id));
    });
    if (activePin && mapRef.current) {
      const a = jobs.find((j) => j.id === activePin);
      if (a) mapRef.current.panTo([a.lat, a.lng], { animate: true, duration: 0.6 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePin]);

  useEffect(() => {
    if (!mapRef.current) return;
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      marker.setOpacity(visibleJobIds.has(Number(id)) ? 1 : 0.15);
    });
  }, [visibleJobIds]);

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 0, background: "#0f172a" }} />
  );
}

// ─── Filter panels (stay dark — float over map tiles) ─────────────────────────
const PANEL_STYLE = {
  background: "rgba(10,5,30,0.94)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 18,
  padding: "16px 18px",
  boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
};

function SliderRow({ value, min, max, step, onChange, formatLabel }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
          {min === 0 ? "ללא הגבלה" : formatLabel(min)}
        </span>
        <motion.span key={value} initial={{ scale: 1.2 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          style={{ fontSize: 15, fontWeight: 900, color: "#c4b5fd" }}>
          {formatLabel(value)}
        </motion.span>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
          {formatLabel(max)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#7c3aed", height: 4 }} />
    </div>
  );
}

function RadiusPanel({ value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: MUTED, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>📍 רדיוס חיפוש מהמיקום שלי</div>
      <SliderRow value={value} min={1} max={50} step={1} onChange={onChange} formatLabel={(v) => `${v} ק״מ`} />
      <div style={{ fontSize: 11, color: "rgba(167,139,250,0.55)", marginTop: 8, fontWeight: 500 }}>מציג ג׳סטות עד {value} ק״מ מהמיקום שלך</div>
    </div>
  );
}

function WagePanel({ value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: MUTED, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>💰 שכר מינימלי לשעה</div>
      <SliderRow value={value} min={30} max={120} step={5} onChange={onChange} formatLabel={(v) => v >= 120 ? "₪120+" : `₪${v}`} />
      <div style={{ fontSize: 11, color: "rgba(167,139,250,0.55)", marginTop: 8, fontWeight: 500 }}>
        {value >= 120 ? "מציג את כל הג׳סטות" : `מציג ג׳סטות עם שכר של ₪${value}+ לשעה`}
      </div>
    </div>
  );
}

function RatingPanel({ value, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: MUTED, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 12 }}>⭐ דירוג מעסיק מינימלי</div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button key={star} whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.15 }}
            onClick={() => onChange(value === star ? 0 : star)}
            style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 28, padding: 0, lineHeight: 1, filter: star <= value ? "none" : "grayscale(1) opacity(0.3)", transition: "filter 0.15s" }}>
            ⭐
          </motion.button>
        ))}
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: "rgba(167,139,250,0.7)", marginTop: 10, fontWeight: 600 }}>
        {value === 0 ? "כל הדירוגים" : `${value} כוכבים ומעלה`}
      </div>
    </div>
  );
}

function FilterPill({ label, isModified, isOpen, onClick }) {
  return (
    <motion.button whileTap={{ scale: 0.93 }} onClick={onClick}
      style={{
        flexShrink: 0, padding: "7px 13px", borderRadius: 20,
        background: isOpen ? "#7c3aed" : isModified ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.1)",
        color: isOpen || isModified ? "#fff" : "rgba(255,255,255,0.75)",
        fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
        border: isModified && !isOpen ? "1px solid rgba(124,58,237,0.55)" : "1px solid rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", gap: 4,
        boxShadow: isOpen ? "0 4px 14px rgba(124,58,237,0.5)" : "none",
        transition: "background 0.2s, box-shadow 0.2s",
      }}>
      {label}
      {isModified && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          style={{ width: 6, height: 6, borderRadius: "50%", background: "#a3e635", marginRight: 2 }} />
      )}
    </motion.button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onReset }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 20px", gap: 12 }}>
      <motion.div animate={{ rotate: [0, -10, 10, -6, 6, 0] }}
        transition={{ duration: 1.4, delay: 0.3, ease: "easeInOut" }} style={{ fontSize: 52 }}>🔍</motion.div>
      <div style={{ fontSize: 16, fontWeight: 800, color: SLATE, textAlign: "center", lineHeight: 1.4 }}>
        אין ג׳סטות שעונות על הסינון המדויק שלך...
      </div>
      <div style={{ fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 1.6, maxWidth: 240 }}>
        נסה להרחיב את הרדיוס, להוריד את שכר המינימום, או לאפס את הסינון ⚡
      </div>
      <motion.button whileTap={{ scale: 0.96 }} onClick={onReset}
        style={{
          marginTop: 8, padding: "10px 24px", borderRadius: 50, border: "none",
          background: "linear-gradient(135deg,#9333ea,#ec4899)",
          color: "#fff", fontSize: 13.5, fontWeight: 800,
          cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 4px 16px rgba(147,51,234,0.35)",
        }}>
        ⚡ אפס סינונים
      </motion.button>
    </motion.div>
  );
}

// ─── Job preview card — full card tappable, no apply button ───────────────────
function JobCard({ job, isActive, onJobSelect, onViewEmployer }) {
  return (
    <motion.div
      whileTap={{ scale: 0.985 }}
      onClick={() => onJobSelect(job)}
      style={{
        background: "#fff",
        borderRadius: 20,
        cursor: "pointer",
        border: isActive ? `1.5px solid ${VIOLET}` : "1px solid #ede9fe",
        boxShadow: isActive ? "0 8px 28px rgba(124,58,237,0.14)" : "0 2px 12px rgba(109,40,217,0.06)",
        padding: "15px 15px 14px",
        transition: "box-shadow 0.18s",
        transform: isActive ? "translateY(-1px)" : "none",
        position: "relative",
      }}
    >
      {/* Active glow strip */}
      {isActive && (
        <div style={{ position: "absolute", top: 0, right: 0, width: 3, height: "100%", background: "linear-gradient(180deg,#9333ea,#ec4899)", borderRadius: "0 20px 20px 0" }} />
      )}

      {/* Employer + pay */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
        <motion.div whileTap={{ scale: 0.93 }}
          onClick={(e) => { e.stopPropagation(); onViewEmployer?.(); }}
          style={{ fontSize: 11, color: VIOLET, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", cursor: "pointer", borderBottom: "1px dashed rgba(124,58,237,0.35)", paddingBottom: 1 }}>
          {job.employer}
        </motion.div>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#5b21b6", lineHeight: 1 }}>
          {job.pay}
          <span style={{ fontSize: 11, fontWeight: 500, color: "#a78bfa", marginRight: 2 }}> / שעה</span>
        </div>
      </div>

      {/* Title */}
      <div style={{ fontSize: 16, fontWeight: 800, color: SLATE, lineHeight: 1.3, marginBottom: 8 }}>
        {job.title}
      </div>

      {/* New badge */}
      {job.isNew && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 20 }}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "linear-gradient(90deg,#4ade80,#059669)", borderRadius: 20, padding: "2px 10px", marginBottom: 7, fontSize: 11, fontWeight: 800, color: "#052e16" }}>
          🆕 ג׳סטה חדשה על המפה!
        </motion.div>
      )}

      {/* Rating */}
      {job.employerRating && (
        <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 8 }}>
          {[1,2,3,4,5].map(s => (
            <Star key={s} size={10}
              fill={s <= Math.round(job.employerRating) ? GOLD : "#e2e8f0"}
              color={s <= Math.round(job.employerRating) ? GOLD : "#e2e8f0"} />
          ))}
          <span style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginRight: 3 }}>{job.employerRating}</span>
        </div>
      )}

      {/* Meta */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: MUTED, fontWeight: 500 }}>
          <Clock size={12} color="#c4b5fd" strokeWidth={2} /> {job.time}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: MUTED, fontWeight: 500 }}>
          <MapPin size={12} color="#c4b5fd" strokeWidth={2} /> {job.dist}
        </div>
      </div>

      {/* Perks */}
      {job.perks?.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
          {job.perks.slice(0, 2).map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11.5, color: "#64748b", fontWeight: 500 }}>
              <CheckCircle2 size={11} color="#a78bfa" strokeWidth={2.5} /> {p}
            </div>
          ))}
        </div>
      )}

      {/* Tap-to-view hint */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: 10, paddingTop: 9, borderTop: "1px solid #f1f0fb" }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: VIOLET }}>לפרטים מלאים</span>
        <ChevronRight size={13} color={VIOLET} strokeWidth={2.5} />
      </div>
    </motion.div>
  );
}

// ─── Draggable bottom sheet ───────────────────────────────────────────────────
function BottomSheet({ filteredJobs, allCount, activePin, onJobSelect, cardRefs, onOpenProfile, onResetFilters, onRegisterSnap }) {
  const y = useMotionValue(SNAP.PEEK);

  const snapTo = useCallback((target) => {
    animate(y, target, { type: "spring", stiffness: 320, damping: 34, mass: 0.85 });
  }, [y]);

  useEffect(() => {
    onRegisterSnap?.(() => snapTo(SNAP.PEEK));
  }, [snapTo, onRegisterSnap]);

  const handleDragEnd = (_, { velocity }) => {
    const cur = y.get();
    if (velocity.y < -300) { snapTo(SNAP.OPEN); return; }
    if (velocity.y >  300) { snapTo(cur > 590 ? SNAP.MIN : SNAP.PEEK); return; }
    const nearest = [SNAP.OPEN, SNAP.PEEK, SNAP.MIN].reduce((a, b) => Math.abs(b - cur) < Math.abs(a - cur) ? b : a);
    snapTo(nearest);
  };

  const isEmpty = filteredJobs.length === 0;

  return (
    <motion.div
      style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "100%",
        y, zIndex: 800,
        background: "#ffffff",
        borderRadius: "26px 26px 0 0",
        boxShadow: "0 -8px 32px rgba(124,58,237,0.10), 0 -1px 0 #ede9fe",
        display: "flex", flexDirection: "column", overflow: "hidden", touchAction: "none",
      }}
      drag="y"
      dragConstraints={{ top: SNAP.OPEN, bottom: SNAP.MIN }}
      dragElastic={{ top: 0.06, bottom: 0.06 }}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      {/* Drag handle */}
      <div style={{ padding: "10px 0 4px", display: "flex", justifyContent: "center", cursor: "grab", flexShrink: 0 }}
        onPointerDown={(e) => e.stopPropagation()}>
        <div style={{ width: 44, height: 5, borderRadius: 3, background: "#ddd6fe", opacity: 0.8 }} />
      </div>

      {/* Header */}
      <div style={{ padding: "6px 18px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: SLATE }}>גיגים קרובים אליך</div>
        <div style={{
          fontSize: 12, fontWeight: 700,
          color: isEmpty ? "#ef4444" : VIOLET,
          background: isEmpty ? "#fef2f2" : VIOLET_LT,
          padding: "3px 10px", borderRadius: 20,
          transition: "background 0.3s, color 0.3s",
        }}>
          {isEmpty ? "אין תוצאות" : `${filteredJobs.length} מתוך ${allCount}`}
        </div>
      </div>

      {/* Cards */}
      <div
        style={{ flex: 1, overflowY: "auto", padding: isEmpty ? "8px 20px 24px" : "0 13px 24px",
          display: "flex", flexDirection: "column", gap: isEmpty ? 0 : 10 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {isEmpty ? (
          <EmptyState onReset={onResetFilters} />
        ) : (
          <AnimatePresence>
            {filteredJobs.map((job) => (
              <motion.div key={job.id} layout
                initial={job.isNew ? { opacity: 0, y: -18, scale: 0.96 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                ref={(el) => { if (cardRefs) cardRefs.current[job.id] = el; }}
              >
                <JobCard
                  job={job}
                  isActive={activePin === job.id}
                  onJobSelect={onJobSelect}
                  onViewEmployer={() => onOpenProfile?.("employer", { name: job.employer })}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
const FILTER_DEFS = [
  { key: "radius",    label: (f) => `📍 ${f.radius} ק״מ`, isModified: (f) => f.radius < 50 },
  { key: "minWage",   label: (f) => `💰 ₪${f.minWage}+`,  isModified: (f) => f.minWage > 40 },
  { key: "minRating", label: (f) => `⭐ ${f.minRating > 0 ? f.minRating + " כוכבים" : "כולם"}`, isModified: (f) => f.minRating > 0 },
];

function FiltersBar({ filters, setFilters }) {
  const [openFilter, setOpenFilter] = useState(null);
  const toggleFilter = (key) => setOpenFilter((prev) => (prev === key ? null : key));
  const updateFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const hasAnyModified = FILTER_DEFS.some(({ isModified }) => isModified(filters));

  return (
    <div style={{ pointerEvents: "auto" }}>
      <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 8, paddingBottom: 2 }}>
        {FILTER_DEFS.map(({ key, label, isModified }) => (
          <FilterPill key={key} label={label(filters)} isModified={isModified(filters)}
            isOpen={openFilter === key} onClick={() => toggleFilter(key)} />
        ))}
        {hasAnyModified && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setFilters(FILTER_DEFAULTS); setOpenFilter(null); }}
            style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(248,113,113,0.2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconX size={13} color="#f87171" strokeWidth={2.5} />
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {openFilter && (
          <motion.div key={openFilter}
            initial={{ opacity: 0, y: -10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            style={{ ...PANEL_STYLE, marginTop: 8, position: "relative" }}>
            {openFilter === "radius"    && <RadiusPanel value={filters.radius}    onChange={(v) => updateFilter("radius", v)} />}
            {openFilter === "minWage"   && <WagePanel   value={filters.minWage}   onChange={(v) => updateFilter("minWage", v)} />}
            {openFilter === "minRating" && <RatingPanel value={filters.minRating} onChange={(v) => updateFilter("minRating", v)} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main feed ────────────────────────────────────────────────────────────────
export default function JestaJobsFeed({ jobs = [], onJobSelect, onApply, onOpenSidebar, onOpenProfile }) {
  const [activePin, setActivePin] = useState(jobs[0]?.id ?? 1);
  const [filters, setFilters]     = useState(FILTER_DEFAULTS);
  const cardRefs                  = useRef({});
  const snapSheetToPeekRef        = useRef(null);

  const filteredJobs = useMemo(() => {
    const kw = filters.keyword.toLowerCase().trim();
    return jobs.filter((job) => {
      if (kw && !job.title.toLowerCase().includes(kw) && !job.employer.toLowerCase().includes(kw)) return false;
      if (haversine(USER_LAT, USER_LNG, job.lat, job.lng) > filters.radius) return false;
      if (job.payRaw < filters.minWage) return false;
      if ((job.employerRating ?? 5) < filters.minRating) return false;
      return true;
    });
  }, [jobs, filters]);

  const visibleJobIds = useMemo(() => new Set(filteredJobs.map((j) => j.id)), [filteredJobs]);

  // Pin tap → navigate to details (same as card tap)
  const handlePinClick = useCallback((job) => {
    setActivePin(job.id);
    onJobSelect(job);
  }, [onJobSelect]);

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Heebo','Segoe UI',system-ui,sans-serif",
        position: "relative", width: "100%", height: "100%", overflow: "hidden",
      }}
    >
      <LiveMap jobs={jobs} activePin={activePin} onPinClick={handlePinClick} visibleJobIds={visibleJobIds} />

      {/* Floating header — glassmorphism over map */}
      <div
        style={{
          position: "absolute", top: 0, left: 0, right: 0,
          zIndex: 1000, padding: "36px 14px 14px",
          background: "linear-gradient(to bottom,rgba(30,8,100,0.9) 0%,rgba(30,8,100,0.6) 72%,transparent 100%)",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, pointerEvents: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: -0.5, textShadow: "0 2px 16px rgba(124,58,237,0.8)" }}>גסטה</span>
            <Zap size={16} fill="#facc15" color="#facc15" />
          </div>
          <div style={{ position: "relative" }}>
            <motion.div whileTap={{ scale: 0.88 }} onClick={onOpenSidebar}
              style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "1.5px solid rgba(255,255,255,0.3)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, cursor: "pointer" }}>
              🧑
            </motion.div>
            <div style={{ position: "absolute", bottom: 1, right: 1, width: 9, height: 9, borderRadius: "50%", background: "#4ade80", border: "2px solid rgba(30,8,100,0.8)", pointerEvents: "none" }} />
          </div>
        </div>

        <div style={{ pointerEvents: "auto" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "rgba(10,5,30,0.58)", backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)",
            border: "1px solid rgba(255,255,255,0.13)", borderRadius: 18, padding: "10px 15px",
            boxShadow: "0 4px 28px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}>
            <Search size={15} color="rgba(255,255,255,0.42)" strokeWidth={2} />
            <input
              type="text" value={filters.keyword}
              onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
              placeholder="חפש עבודה או מעסיק..." dir="rtl"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13.5, color: "#fff", fontWeight: 400, fontFamily: "inherit", letterSpacing: 0.1, caretColor: "#a78bfa" }}
            />
            {filters.keyword && (
              <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.88 }}
                onClick={() => setFilters((f) => ({ ...f, keyword: "" }))}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                <IconX size={14} color="rgba(255,255,255,0.5)" strokeWidth={2.5} />
              </motion.button>
            )}
            <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.15)", margin: "0 2px" }} />
            <SlidersHorizontal size={14} color="rgba(167,139,250,0.85)" strokeWidth={2.5} />
          </div>
          <FiltersBar filters={filters} setFilters={setFilters} />
        </div>
      </div>

      <BottomSheet
        filteredJobs={filteredJobs}
        allCount={jobs.length}
        activePin={activePin}
        onJobSelect={onJobSelect}
        cardRefs={cardRefs}
        onOpenProfile={onOpenProfile}
        onResetFilters={() => setFilters(FILTER_DEFAULTS)}
        onRegisterSnap={(fn) => { snapSheetToPeekRef.current = fn; }}
      />
    </div>
  );
}
