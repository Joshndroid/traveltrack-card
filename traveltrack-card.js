/**
 * traveltrack-card.js
 * Lovelace custom card for TravelTrack.
 *
 * Recommended install (HACS):
 *   1. HACS → Frontend → ⋮ → Custom repositories → add this repo, category "Dashboard".
 *   2. Install "TravelTrack Card". HACS adds the dashboard resource automatically.
 *   3. Add to a dashboard:
 *        type: custom:traveltrack-card
 *        title: "My Commute"   # optional
 *
 * Manual install:
 *   1. Copy this file to config/www/community/traveltrack-card/traveltrack-card.js
 *   2. Settings → Dashboards → Resources → Add:
 *        URL:  /local/community/traveltrack-card/traveltrack-card.js
 *        Type: JavaScript Module
 *   3. Add the card as above.
 */

const CARD_VERSION = "1.0.11";

const SENSORS = {
  shiftToday:    "sensor.traveltrack_shift_today",
  shiftTomorrow: "sensor.traveltrack_shift_tomorrow",
  leaveForWorkStatus: "sensor.traveltrack_leave_for_work_status",
  leaveForWorkEarly:  "sensor.traveltrack_leave_for_work_early",
  leaveForWorkJit:    "sensor.traveltrack_leave_for_work_jit",
  finishingWorkStatus: "sensor.traveltrack_finishing_work_status",
  finishingWorkEarly:  "sensor.traveltrack_finishing_work_early",
  finishingWorkJit:    "sensor.traveltrack_finishing_work_jit",
  tomorrowLeaveForWorkStatus: "sensor.traveltrack_tomorrow_leave_for_work_status",
  tomorrowLeaveForWorkEarly:  "sensor.traveltrack_tomorrow_leave_for_work_early",
  tomorrowLeaveForWorkJit:    "sensor.traveltrack_tomorrow_leave_for_work_jit",
  tomorrowFinishingWorkStatus: "sensor.traveltrack_tomorrow_finishing_work_status",
  tomorrowFinishingWorkEarly:  "sensor.traveltrack_tomorrow_finishing_work_early",
  tomorrowFinishingWorkJit:    "sensor.traveltrack_tomorrow_finishing_work_jit",
  lastUpdated:   "sensor.traveltrack_last_updated",
};

const SENSOR_NAMES = {
  shift_today: "Shift Today",
  shift_tomorrow: "Shift Tomorrow",
  leave_for_work_status: "Leave for Work Status",
  leave_for_work_early: "Leave for Work Early Departure",
  leave_for_work_early_departure: "Leave for Work Early Departure",
  leave_for_work_jit: "Leave for Work JIT Departure",
  leave_for_work_jit_departure: "Leave for Work JIT Departure",
  finishing_work_status: "Finishing Work Status",
  finishing_work_early: "Finishing Work Early Departure",
  finishing_work_early_departure: "Finishing Work Early Departure",
  finishing_work_jit: "Finishing Work JIT Departure",
  finishing_work_jit_departure: "Finishing Work JIT Departure",
  tomorrow_leave_for_work_status: "Tomorrow Leave for Work Status",
  tomorrow_leave_for_work_early: "Tomorrow Leave for Work Early Departure",
  tomorrow_leave_for_work_early_departure: "Tomorrow Leave for Work Early Departure",
  tomorrow_leave_for_work_jit: "Tomorrow Leave for Work JIT Departure",
  tomorrow_leave_for_work_jit_departure: "Tomorrow Leave for Work JIT Departure",
  tomorrow_finishing_work_status: "Tomorrow Finishing Work Status",
  tomorrow_finishing_work_early: "Tomorrow Finishing Work Early Departure",
  tomorrow_finishing_work_early_departure: "Tomorrow Finishing Work Early Departure",
  tomorrow_finishing_work_jit: "Tomorrow Finishing Work JIT Departure",
  tomorrow_finishing_work_jit_departure: "Tomorrow Finishing Work JIT Departure",
  last_updated: "Last Updated",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function stateOf(hass, entityId) {
  const states = hass?.states ?? {};
  if (states[entityId]) return states[entityId];

  const objectId = entityId.split(".")[1];
  if (!objectId) return null;

  const suffix = objectId.replace(/^traveltrack_/, "");
  const suffixes = new Set([
    suffix,
    suffix.replace(/_early$/, "_early_departure"),
    suffix.replace(/_jit$/, "_jit_departure"),
  ]);
  const wantedNames = new Set(
    [...suffixes]
      .map((candidateSuffix) => SENSOR_NAMES[candidateSuffix])
      .filter(Boolean)
      .flatMap((name) => [
        name,
        `TravelTrack ${name}`,
        `TravelTrack Assistant ${name}`,
      ])
      .map((name) => name.toLowerCase())
  );
  const candidates = Object.keys(states)
    .filter((id) => id.startsWith("sensor."))
    .filter((id) => {
      const oid = id.split(".")[1] ?? "";
      const friendlyName = (states[id]?.attributes?.friendly_name ?? "").toLowerCase();
      if (wantedNames.has(friendlyName)) return true;

      for (const candidateSuffix of suffixes) {
        if (
          oid === objectId
          || oid === `traveltrack_${candidateSuffix}`
          || oid === `traveltrack_assistant_${candidateSuffix}`
          || oid.endsWith(`_${candidateSuffix}`)
        ) {
          return true;
        }
      }
      return false;
    })
    .sort((a, b) => {
      const score = (id) => {
        const oid = id.split(".")[1] ?? "";
        const friendlyName = (states[id]?.attributes?.friendly_name ?? "").toLowerCase();
        if (oid === objectId) return 0;
        if (friendlyName && wantedNames.has(friendlyName)) return 1;
        for (const candidateSuffix of suffixes) {
          if (oid === `traveltrack_assistant_${candidateSuffix}`) return 1;
          if (oid === `traveltrack_${candidateSuffix}`) return 2;
        }
        if (oid.startsWith("traveltrack_")) return 2;
        return 3;
      };
      return score(a) - score(b) || a.localeCompare(b);
    });

  return states[candidates[0]] ?? null;
}

function val(hass, entityId) {
  return stateOf(hass, entityId)?.state ?? null;
}

function attr(hass, entityId, key) {
  return stateOf(hass, entityId)?.attributes?.[key] ?? null;
}

function firstStateOf(hass, entityIds) {
  for (const entityId of entityIds) {
    const state = stateOf(hass, entityId);
    if (state) return state;
  }
  return null;
}

function fmt(timeStr) {
  if (!timeStr || timeStr === "unknown" || timeStr === "unavailable") return "—";
  if (/^\d{2}:\d{2}/.test(timeStr)) return timeStr.slice(0, 5);
  const parsed = new Date(timeStr);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  }
  return timeStr;
}

function dateLabel(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function timeLabel(value) {
  if (!value || value === "unknown" || value === "unavailable") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

// ─── Card class ─────────────────────────────────────────────────────────────

class TravelTrackCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = {};
    this._lastHtml = "";
  }

  setConfig(config) {
    this._config = config ?? {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 5;
  }

  static getConfigElement() {
    // Basic editor stub — HA will use this for the visual editor
    return document.createElement("div");
  }

  static getStubConfig() {
    return { title: "My Commute" };
  }

  // ── Render ────────────────────────────────────────────────────────────────

  _render() {
    if (!this._hass) return;
    const h = this._hass;
    const cfg = this._config;

    const title      = cfg.title ?? "My Commute";
    const shiftToday = val(h, SENSORS.shiftToday);
    const hasShiftToday = !!shiftToday && shiftToday !== "none" && shiftToday !== "unavailable";

    // Leave for Work
    const mStatus    = val(h, SENSORS.leaveForWorkStatus);   // "clear" | "disrupted" | "unknown"
    const mEarly     = val(h, SENSORS.leaveForWorkEarly);
    const mJit       = val(h, SENSORS.leaveForWorkJit);
    const mPlan      = attr(h, SENSORS.leaveForWorkEarly, "plan") ?? "a";
    const mWalk      = attr(h, SENSORS.leaveForWorkEarly, "walk_minutes") ?? 0;

    // Finishing Work
    const eStatus       = val(h, SENSORS.finishingWorkStatus);
    const eEarly        = val(h, SENSORS.finishingWorkEarly);
    const eJit          = val(h, SENSORS.finishingWorkJit);
    const ePlan         = attr(h, SENSORS.finishingWorkEarly, "plan") ?? "a";
    const eWalk         = attr(h, SENSORS.finishingWorkEarly, "walk_minutes") ?? 0;
    const eTrackwork    = attr(h, SENSORS.finishingWorkStatus, "trackwork_starts");
    const eLastSafe     = attr(h, SENSORS.finishingWorkJit, "last_safe_train");

    // Tomorrow
    const tmStatus = val(h, SENSORS.tomorrowLeaveForWorkStatus);
    const tmEarly  = val(h, SENSORS.tomorrowLeaveForWorkEarly);
    const tmJit    = val(h, SENSORS.tomorrowLeaveForWorkJit);
    const tmPlan   = attr(h, SENSORS.tomorrowLeaveForWorkEarly, "plan") ?? "a";
    const tmWalk   = attr(h, SENSORS.tomorrowLeaveForWorkEarly, "walk_minutes") ?? 0;
    const teStatus = val(h, SENSORS.tomorrowFinishingWorkStatus);
    const teEarly  = val(h, SENSORS.tomorrowFinishingWorkEarly);
    const teJit    = val(h, SENSORS.tomorrowFinishingWorkJit);
    const tePlan   = attr(h, SENSORS.tomorrowFinishingWorkEarly, "plan") ?? "a";
    const teWalk   = attr(h, SENSORS.tomorrowFinishingWorkEarly, "walk_minutes") ?? 0;

    // Shift labels
    const shiftTomorrow = val(h, SENSORS.shiftTomorrow);
    const hasShiftTomorrow = !!shiftTomorrow && shiftTomorrow !== "none" && shiftTomorrow !== "unavailable";
    const lastUpdatedState = firstStateOf(h, [
      SENSORS.lastUpdated,
      "sensor.traveltrack_assistant_last_updated",
    ]);
    const lastUpdated = lastUpdatedState?.state;
    const fallbackUpdatedState = firstStateOf(h, [
      SENSORS.leaveForWorkEarly,
      SENSORS.finishingWorkEarly,
      SENSORS.shiftToday,
      SENSORS.shiftTomorrow,
      SENSORS.tomorrowLeaveForWorkEarly,
    ]);
    const updatedLabel =
      timeLabel(lastUpdated)
      ?? timeLabel(lastUpdatedState?.last_updated)
      ?? timeLabel(lastUpdatedState?.last_changed)
      ?? timeLabel(fallbackUpdatedState?.last_updated)
      ?? timeLabel(fallbackUpdatedState?.last_changed);
    function hasValue(v) {
      return !!v && v !== "unknown" && v !== "unavailable";
    }

    const hasCommutePlan = [mEarly, mJit, eEarly, eJit].some(hasValue);
    const hasTodayPlan = hasShiftToday && hasCommutePlan;
    const hasTomorrowPlan = [tmEarly, tmJit, teEarly, teJit].some(hasValue);
    const noShift = !hasShiftToday && !hasShiftTomorrow && !hasTomorrowPlan;
    const waitingForTodayPlan = hasShiftToday && !hasTodayPlan;

    // ── Leave-by calculation (Plan B) ────────────────────────────────────
    function leaveBy(timeStr, walkMins) {
      if (!timeStr || !walkMins) return null;
      const [h, m] = timeStr.split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      const total  = h * 60 + m - walkMins;
      const lh     = Math.floor(((total % 1440) + 1440) % 1440 / 60);
      const lm     = ((total % 60) + 60) % 60;
      return `${String(lh).padStart(2,"0")}:${String(lm).padStart(2,"0")}`;
    }

    const mLeaveEarly = leaveBy(mEarly, mWalk);
    const mLeaveJit   = leaveBy(mJit,   mWalk);
    const eLeaveEarly = leaveBy(eEarly, eWalk);
    const eLeaveJit   = leaveBy(eJit,   eWalk);
    const tmLeaveEarly = leaveBy(fmt(tmEarly), tmWalk);
    const tmLeaveJit   = leaveBy(fmt(tmJit),   tmWalk);
    const teLeaveEarly = leaveBy(fmt(teEarly), teWalk);
    const teLeaveJit   = leaveBy(fmt(teJit),   teWalk);

    // ── Status icons / pills ─────────────────────────────────────────────
    function pill(status, plan) {
      if (status === "disrupted") return `<span class="pill red">🔴 Plan ${plan.toUpperCase()} — Disrupted</span>`;
      if (status === "clear")     return `<span class="pill green">🟢 All clear</span>`;
      return `<span class="pill grey">⚪ Unknown</span>`;
    }

    // ── Journey leg HTML ─────────────────────────────────────────────────
    function planARows(early, jit) {
      return `
        <div class="dep-row">
          <span class="dep-label">Early</span>
          <span class="dep-time">${fmt(early)}</span>
        </div>
        <div class="dep-row">
          <span class="dep-label">JIT</span>
          <span class="dep-time">${fmt(jit)}</span>
        </div>`;
    }

    function planBRows(early, jit, leaveEarly, leaveJit, walk) {
      return `
        <div class="dep-row">
          <span class="dep-label">Early bus</span>
          <span class="dep-time">${fmt(early)}</span>
          ${leaveEarly ? `<span class="walk-warn">⚠️ leave by ${leaveEarly} (${walk}min walk)</span>` : ""}
        </div>
        <div class="dep-row">
          <span class="dep-label">JIT bus</span>
          <span class="dep-time">${fmt(jit)}</span>
          ${leaveJit ? `<span class="walk-warn">⚠️ leave by ${leaveJit} (${walk}min walk)</span>` : ""}
        </div>`;
    }

    // Leave for Work section
    const leaveForWorkRows = mPlan === "b"
      ? planBRows(mEarly, mJit, mLeaveEarly, mLeaveJit, mWalk)
      : planARows(mEarly, mJit);

    // Finishing Work section — handle trackwork-before-shift-end scenario
    let finishingWorkRows = "";
    if (eTrackwork && eLastSafe) {
      finishingWorkRows = `
        <div class="trackwork-warn">
          ⚠️ Trackwork from ${eTrackwork} — last safe train ${eLastSafe}
        </div>
        ${planBRows(eEarly, eJit, eLeaveEarly, eLeaveJit, eWalk)}`;
    } else if (ePlan === "b") {
      finishingWorkRows = planBRows(eEarly, eJit, eLeaveEarly, eLeaveJit, eWalk);
    } else {
      finishingWorkRows = planARows(eEarly, eJit);
    }

    // Plan B panel visibility
    const showLeaveForWorkB = mPlan === "b";
    const showFinishingWorkB = ePlan === "b" || (eTrackwork && eLastSafe);
    const tomorrowLeaveRows = tmPlan === "b"
      ? planBRows(tmEarly, tmJit, tmLeaveEarly, tmLeaveJit, tmWalk)
      : planARows(tmEarly, tmJit);
    const tomorrowFinishRows = tePlan === "b"
      ? planBRows(teEarly, teJit, teLeaveEarly, teLeaveJit, teWalk)
      : planARows(teEarly, teJit);
    const tomorrowBody = hasTomorrowPlan
      ? `
        <div class="subsection-title">Leave for Work</div>
        <div class="status-row">${pill(tmStatus, tmPlan)}</div>
        ${tmPlan === "b" ? `<div class="planb-panel">${tomorrowLeaveRows}</div>` : tomorrowLeaveRows}

        <div class="subsection-title top-gap-small">Finishing Work</div>
        <div class="status-row">${pill(teStatus, tePlan)}</div>
        ${tePlan === "b" ? `<div class="planb-panel">${tomorrowFinishRows}</div>` : tomorrowFinishRows}
      `
      : hasShiftTomorrow
      ? `<div class="no-shift compact">Shift found, waiting for tomorrow commute plan</div>`
      : "";
    const tomorrowContent = hasShiftTomorrow || hasTomorrowPlan
      ? `
        <div class="day-panel tomorrow-panel">
          <div class="day-header">
            <div>
              <div class="day-title">Tomorrow</div>
              <div class="day-date">${dateLabel(1)}</div>
            </div>
            <div class="shift-val">${hasShiftTomorrow ? shiftTomorrow : "No shift"}</div>
          </div>
          ${tomorrowBody}
        </div>
      `
      : "";

    // ── No-shift state ───────────────────────────────────────────────────
    const mainContent = !hasShiftToday
      ? `<div class="no-shift">No shift today</div>`
      : hasTodayPlan
      ? `
        <div class="section-header">━━ LEAVE FOR WORK ━━━━━━━━━━━━━━━━━━━━━━━</div>
        <div class="status-row">${pill(mStatus, mPlan)}</div>
        ${showLeaveForWorkB ? `<div class="planb-panel">${leaveForWorkRows}</div>` : leaveForWorkRows}

        <div class="section-header top-gap">━━ FINISHING WORK ━━━━━━━━━━━━━━━━━━━━━━━</div>
        <div class="status-row">${pill(eStatus, ePlan)}</div>
        ${showFinishingWorkB ? `<div class="planb-panel">${finishingWorkRows}</div>` : finishingWorkRows}
      `
      : waitingForTodayPlan
      ? `<div class="no-shift">Shift found, waiting for commute plan</div>`
      : "";

    // ── Full card HTML ───────────────────────────────────────────────────
    const html = `
      <style>
        :host {
          display: block;
          font-family: var(--primary-font-family, sans-serif);
        }

        ha-card {
          background: var(--card-background-color);
          border-radius: var(--ha-card-border-radius, 12px);
          box-shadow: var(--ha-card-box-shadow, none);
          padding: 16px;
          color: var(--primary-text-color);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 14px;
        }

        .card-title {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--primary-text-color);
        }

        .card-date {
          font-size: 0.8rem;
          color: var(--secondary-text-color);
        }

        .day-panel {
          border: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius: 8px;
          padding: 12px;
          margin-top: 10px;
        }

        .today-panel {
          background: rgba(255,255,255,0.015);
        }

        .tomorrow-panel {
          background: rgba(3, 169, 244, 0.055);
          border-color: rgba(3, 169, 244, 0.28);
        }

        .day-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: baseline;
          font-size: 0.88rem;
          color: var(--secondary-text-color);
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));
        }

        .day-title {
          font-weight: 700;
          color: var(--primary-text-color);
        }

        .day-date {
          font-size: 0.78rem;
          color: var(--secondary-text-color);
          margin-top: 2px;
        }

        .shift-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.88rem;
          color: var(--secondary-text-color);
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--divider-color, rgba(255,255,255,0.12));
        }

        .shift-val {
          font-weight: 600;
          color: var(--primary-text-color);
        }

        .section-header {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: var(--secondary-text-color);
          margin: 8px 0 6px;
          opacity: 0.7;
        }

        .top-gap { margin-top: 14px; }
        .top-gap-small { margin-top: 10px; }

        .subsection-title {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--primary-text-color);
          margin: 6px 0 4px;
        }

        .status-row {
          margin-bottom: 6px;
        }

        .pill {
          display: inline-block;
          font-size: 0.82rem;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 20px;
        }

        .pill.green {
          background: rgba(76, 175, 80, 0.18);
          color: #4caf50;
        }

        .pill.red {
          background: rgba(244, 67, 54, 0.18);
          color: #f44336;
        }

        .pill.grey {
          background: rgba(158, 158, 158, 0.18);
          color: var(--secondary-text-color);
        }

        .dep-row {
          display: flex;
          align-items: baseline;
          gap: 10px;
          padding: 3px 0 3px 8px;
          font-size: 0.9rem;
        }

        .dep-label {
          min-width: 60px;
          color: var(--secondary-text-color);
          font-size: 0.82rem;
        }

        .dep-time {
          font-weight: 700;
          font-size: 1rem;
          color: var(--primary-text-color);
          min-width: 44px;
        }

        .walk-warn {
          font-size: 0.75rem;
          color: var(--warning-color, #f0a500);
        }

        .planb-panel {
          background: rgba(244, 67, 54, 0.07);
          border-left: 3px solid var(--error-color, #f44336);
          border-radius: 0 6px 6px 0;
          padding: 6px 8px;
          margin: 4px 0;
        }

        .trackwork-warn {
          font-size: 0.8rem;
          color: var(--warning-color, #f0a500);
          padding: 4px 0 6px 4px;
        }

        .no-shift {
          text-align: center;
          color: var(--secondary-text-color);
          font-size: 0.9rem;
          padding: 20px 0;
          opacity: 0.6;
        }

        .no-shift.compact {
          padding: 8px 0 2px;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          font-size: 0.72rem;
          color: var(--secondary-text-color);
          margin-top: 14px;
          padding-top: 8px;
          border-top: 1px solid var(--divider-color, rgba(255,255,255,0.12));
          opacity: 0.6;
        }
      </style>

      <ha-card>
        <div class="card-header">
          <span class="card-title">🚉 ${title}</span>
          <span class="card-date">${dateLabel(0)}</span>
        </div>

        <div class="day-panel today-panel">
          <div class="day-header">
            <div>
              <div class="day-title">Today</div>
              <div class="day-date">${dateLabel(0)}</div>
            </div>
            <div class="shift-val">${hasShiftToday ? shiftToday : "No shift"}</div>
          </div>
          ${mainContent}
        </div>
        ${tomorrowContent}

        <div class="footer">
          <span>${updatedLabel ? `Updated ${updatedLabel}` : "Not yet updated"}</span>
        </div>
      </ha-card>
    `;
    if (html !== this._lastHtml) {
      this.shadowRoot.innerHTML = html;
      this._lastHtml = html;
    }
  }
}

// Guard against double-registration (e.g. resource added twice) — a second
// customElements.define() call throws and would break the whole module load.
if (!customElements.get("traveltrack-card")) {
  customElements.define("traveltrack-card", TravelTrackCard);
}

window.customCards = window.customCards ?? [];
if (!window.customCards.some((c) => c.type === "traveltrack-card")) {
  window.customCards.push({
    type:        "traveltrack-card",
    name:        "TravelTrack Card",
    description: "Displays your TravelTrack commute brief — Plan A/B, departure times, disruption alerts.",
    preview:     false,
  });
}

console.info(
  `%c TRAVELTRACK-CARD %c v${CARD_VERSION} `,
  "color:white;background:#03a9f4;font-weight:700;border-radius:3px 0 0 3px;",
  "color:#03a9f4;background:#1c1c1c;font-weight:700;border-radius:0 3px 3px 0;",
);
