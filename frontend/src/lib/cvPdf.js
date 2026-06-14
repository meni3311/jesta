/**
 * cvPdf.js — "ייצא כקורות חיים" (System 5)
 *
 * Generates a real downloadable PDF of the worker's Jesta work history:
 * name, Jesta Score, completed gestas, average rating, categories worked in.
 *
 * Implementation note: jsPDF + html2canvas are loaded on demand from cdnjs
 * (same CDN family the app already uses for Leaflet assets) because the npm
 * registry is blocked in this build environment. The CV is rendered as a
 * styled HTML node and rasterized — this keeps Hebrew/RTL typography pixel
 * perfect (text-mode jsPDF has no Hebrew font without embedding one).
 */

const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const H2C_URL   = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";

const CATEGORY_LABELS = {
  delivery: "שליחויות", babysit: "בייביסיטר", events: "אירועים",
  pets: "חיות מחמד", warehouse: "מחסן", food: "מזון", logistics: "לוגיסטיקה",
  fashion: "אופנה", cleaning: "ניקיון", sales: "מכירות", other: "אחר",
};

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" });
}

function starsRow(score) {
  if (!score) return "";
  let out = "";
  for (let i = 1; i <= 5; i += 1) {
    out += `<span style="color:${i <= Math.round(score) ? "#f59e0b" : "#cbd5e1"};font-size:13px;">&#9733;</span>`;
  }
  return out;
}

/**
 * Build the printable CV node (light theme — it's a document, not the app).
 * @param {{ fullName, jestaScore, rating, ratingCount, completedJobs }} user
 * @param {Array} shifts   completed shifts: { title, employer, date, payRaw, hours, category, ratingScore }
 */
function buildCvNode(user, shifts) {
  const cats = [...new Set(shifts.map((s) => s.category).filter(Boolean))]
    .map((c) => CATEGORY_LABELS[c] ?? c);

  const rows = shifts.map((s) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600;">${esc(s.title)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${esc(s.employer)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${esc(s.date)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${s.ratingScore ? starsRow(s.ratingScore) : '<span style="color:#94a3b8;font-size:11px;">—</span>'}</td>
    </tr>`).join("");

  const node = document.createElement("div");
  node.dir = "rtl";
  node.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;color:#0f172a;" +
    "font-family:'Heebo','Segoe UI',system-ui,sans-serif;padding:48px;box-sizing:border-box;";
  node.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #7c3aed;padding-bottom:20px;">
      <div>
        <div style="font-size:30px;font-weight:800;letter-spacing:-0.02em;">${esc(user.fullName ?? "ג'סטר")}</div>
        <div style="font-size:13px;color:#64748b;margin-top:6px;">קורות חיים — נוצר אוטומטית מתוך היסטוריית העבודה ב-Jesta &#9889;</div>
      </div>
      <div style="text-align:center;">
        <div style="width:74px;height:74px;border-radius:50%;border:5px solid #7c3aed;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#7c3aed;">
          ${Math.round(user.jestaScore ?? 0)}
        </div>
        <div style="font-size:10px;color:#64748b;margin-top:4px;font-weight:700;letter-spacing:0.08em;">JESTA SCORE</div>
      </div>
    </div>

    <div style="display:flex;gap:14px;margin:22px 0;">
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:800;">${shifts.length}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">ג'סטות שהושלמו</div>
      </div>
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:22px;font-weight:800;">${user.ratingCount ? Number(user.rating ?? 0).toFixed(1) : "—"}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">דירוג ממוצע${user.ratingCount ? ` (${user.ratingCount} דירוגים)` : ""}</div>
      </div>
      <div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;text-align:center;">
        <div style="font-size:13px;font-weight:700;line-height:1.5;">${cats.length ? cats.map(esc).join(" · ") : "—"}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">תחומי עבודה</div>
      </div>
    </div>

    <div style="font-size:15px;font-weight:800;margin-bottom:10px;">ניסיון תעסוקתי</div>
    ${shifts.length ? `
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#475569;">תפקיד</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#475569;">מעסיק</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#475569;">תאריך</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;color:#475569;">דירוג שקיבלתי</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
    : `<div style="font-size:12px;color:#64748b;">עדיין אין ג'סטות שהושלמו.</div>`}

    <div style="margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between;">
      <span>הופק ב-${new Date().toLocaleDateString("he-IL")}</span>
      <span>Jesta — ג'סטות לנוער &#9889;</span>
    </div>`;
  return node;
}

/**
 * Generate + download the CV PDF.
 * @returns {Promise<void>} rejects with a Hebrew-friendly Error on failure
 */
export async function exportCvPdf(user, completedShifts) {
  try {
    await Promise.all([loadScript(JSPDF_URL), loadScript(H2C_URL)]);
  } catch {
    throw new Error("טעינת מחולל ה-PDF נכשלה — בדקו את חיבור האינטרנט ונסו שוב");
  }

  const shifts = completedShifts.map((s) => ({ ...s, date: s.dateLabel ?? fmtDate(s.completedAt ?? s.startTime) }));
  const node = buildCvNode(user, shifts);
  document.body.appendChild(node);
  try {
    const canvas = await window.html2canvas(node, { scale: 2, backgroundColor: "#ffffff" });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

    const pageW = 210, pageH = 297;
    const imgH  = (canvas.height * pageW) / canvas.width;

    // Slice the canvas across pages when the history is long
    let rendered = 0;
    let page = 0;
    const pageCanvasH = Math.floor((pageH / imgH) * canvas.height);
    while (rendered < canvas.height) {
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = Math.min(pageCanvasH, canvas.height - rendered);
      slice.getContext("2d").drawImage(
        canvas, 0, rendered, canvas.width, slice.height, 0, 0, canvas.width, slice.height,
      );
      const sliceH = (slice.height * pageW) / slice.width;
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, pageW, sliceH);
      rendered += slice.height;
      page += 1;
    }

    const safeName = (user.fullName ?? "jesta").replace(/[\\/:*?"<>|]/g, "").trim() || "jesta";
    pdf.save(`Jesta-CV-${safeName}.pdf`);
  } finally {
    node.remove();
  }
}
