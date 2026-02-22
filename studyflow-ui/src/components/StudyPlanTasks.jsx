// src/components/StudyPlanTasks.jsx
import React, { useMemo } from "react";

function groupByDay(sessions = []) {
  const map = new Map();

  for (const s of sessions) {
    if (!s?.start) continue;
    const d = new Date(s.start);
    const dayKey = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();

    if (!map.has(dayKey)) map.set(dayKey, []);
    map.get(dayKey).push(s);
  }

  // sort sessions inside each day
  for (const [k, arr] of map.entries()) {
    arr.sort((a, b) => new Date(a.start) - new Date(b.start));
    map.set(k, arr);
  }

  // sort days
  return Array.from(map.entries()).sort((a, b) => new Date(a[0]) - new Date(b[0]));
}

function fmtDay(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function fmtTimeRange(startISO, endISO) {
  const s = new Date(startISO);
  const e = new Date(endISO);
  return `${s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function StudyPlanTasks({ sessions = [] }) {
  const grouped = useMemo(() => groupByDay(sessions), [sessions]);

  if (!sessions?.length) {
    return (
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Study Tasks</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Generate a weekly plan to see study tasks here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 700 }}>Study Tasks</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>{sessions.length} blocks</div>
      </div>

      <div style={{ marginTop: 10 }}>
        {grouped.map(([dayKey, daySessions]) => (
          <div key={dayKey} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{fmtDay(dayKey)}</div>

            {daySessions.map((s, idx) => (
              <div
                key={`${s.title}-${s.start}-${idx}`}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 12,
                  padding: "10px 12px",
                  marginBottom: 8,
                  background: "rgba(124,58,237,0.06)",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {fmtTimeRange(s.start, s.end)}
                </div>
                <div style={{ fontWeight: 700 }}>{s.title || "Study"}</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  {s.meta?.kind || s.type || "study"}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}