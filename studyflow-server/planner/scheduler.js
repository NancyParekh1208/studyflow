// planner/scheduler.js
export function toMs(iso) { return new Date(iso).getTime(); }
export function toISO(ms) { return new Date(ms).toISOString(); }

function splitIntoDays(startISO, days = 7) {
  const start = new Date(startISO);
  start.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function clampDayWindow(dayYYYYMMDD, startHour = 8, endHour = 22) {
  const d = new Date(`${dayYYYYMMDD}T00:00:00`);
  const start = new Date(d); start.setHours(startHour, 0, 0, 0);
  const end = new Date(d); end.setHours(endHour, 0, 0, 0);
  return [start.getTime(), end.getTime()];
}

function mergeIntervals(intervals) {
  const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of sorted) {
    if (!merged.length || s > merged[merged.length - 1][1]) merged.push([s, e]);
    else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
  }
  return merged;
}

function subtractIntervals(dayStart, dayEnd, busy) {
  const free = [];
  let cursor = dayStart;
  for (const [bs, be] of busy) {
    if (be <= cursor) continue;
    if (bs >= dayEnd) break;
    const s = Math.max(bs, dayStart);
    const e = Math.min(be, dayEnd);
    if (s > cursor) free.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < dayEnd) free.push([cursor, dayEnd]);
  return free;
}

function consumeFreeSlot(freeSlots, startMs, endMs) {
  const out = [];
  for (const [s, e] of freeSlots) {
    if (endMs <= s || startMs >= e) { out.push([s, e]); continue; }
    if (startMs > s) out.push([s, startMs]);
    if (endMs < e) out.push([endMs, e]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

function distributionFactor(dist, dayIndex) {
  if (dist === "front_load") return 1.3 - dayIndex * 0.05;
  if (dist === "end_load") return 0.9 + dayIndex * 0.06;
  return 1.0;
}

export function scheduleFromFreeSlots({ events, aiPlan, windowStartISO }) {
  const days = splitIntoDays(windowStartISO, 7);

  const busyByDay = {};
  for (const day of days) busyByDay[day] = [];

  for (const ev of events) {
    if (!ev.start || !ev.end) continue;
    const s = toMs(ev.start);
    const e = toMs(ev.end);
    const dayKey = new Date(s).toISOString().slice(0, 10);
    if (busyByDay[dayKey]) busyByDay[dayKey].push([s, e]);
  }
  for (const day of days) busyByDay[day] = mergeIntervals(busyByDay[day]);

  const freeByDay = {};
  for (const day of days) {
    const [ds, de] = clampDayWindow(day, 8, 22);
    freeByDay[day] = subtractIntervals(ds, de, busyByDay[day]);
  }

  const classEndBySubjectDay = {};
  for (const ev of events) {
    if (ev.type !== "class") continue;
    const s = toMs(ev.start);
    const e = toMs(ev.end);
    const dayKey = new Date(s).toISOString().slice(0, 10);
    const key = `${ev.title}|${dayKey}`;
    classEndBySubjectDay[key] = Math.max(classEndBySubjectDay[key] || 0, e);
  }

  const MAX_BLOCK_MIN = 120;
  const MAX_DAY_MIN = 240;
  const dailyMinutes = {};
  for (const day of days) dailyMinutes[day] = 0;

  const subjects = (aiPlan.subjects || [])
    .map((s) => ({
      title: s.title,
      priority: Number(s.priority ?? 50),
      remaining: Math.max(0, Number(s.target_minutes ?? 0)),
      strategy: s.strategy || { prefer_after_class: true, distribution: "spaced", review_ratio: 0.2 },
      tip: s.one_line_tip || "",
    }))
    .sort((a, b) => b.priority - a.priority);

  const sessions = [];
  const usedSubjectDay = new Set();

  function pickSlotForSubject(day, subj) {
    const freeSlots = freeByDay[day];
    if (!freeSlots?.length) return null;

    const keySD = `${subj.title}|${day}`;
    const preferAfter = subj.strategy?.prefer_after_class ? (classEndBySubjectDay[keySD] || null) : null;

    if (preferAfter) {
      for (const [fs, fe] of freeSlots) {
        if (fe <= preferAfter) continue;
        const start = Math.max(fs, preferAfter);
        if (fe - start >= 30 * 60000) return [start, fe];
      }
    }
    for (const [fs, fe] of freeSlots) {
      if (fe - fs >= 30 * 60000) return [fs, fe];
    }
    return null;
  }

  for (let pass = 0; pass < 2; pass++) {
    for (const day of days) {
      if (dailyMinutes[day] >= MAX_DAY_MIN) continue;

      const dayIndex = days.indexOf(day);
      const ordered = subjects.slice().sort((a, b) => {
        const baseA = a.priority * 10 + a.remaining;
        const baseB = b.priority * 10 + b.remaining;
        const tA = distributionFactor(a.strategy?.distribution, dayIndex);
        const tB = distributionFactor(b.strategy?.distribution, dayIndex);
        return (baseB * tB) - (baseA * tA);
      });

      for (const subj of ordered) {
        if (subj.remaining <= 0) continue;
        if (dailyMinutes[day] >= MAX_DAY_MIN) break;

        const keySD = `${subj.title}|${day}`;
        if (pass === 0 && usedSubjectDay.has(keySD)) continue;

        const slot = pickSlotForSubject(day, subj);
        if (!slot) continue;

        const [slotStart, slotEnd] = slot;
        const slotMin = Math.floor((slotEnd - slotStart) / 60000);
        const remainingDay = MAX_DAY_MIN - dailyMinutes[day];
        const allocMin = Math.min(MAX_BLOCK_MIN, remainingDay, subj.remaining, slotMin);
        if (allocMin < 30) continue;

        const endMs = slotStart + allocMin * 60000;

        sessions.push({
          title: subj.title,
          start: toISO(slotStart),
          end: toISO(endMs),
          type: "study",
          meta: { kind: "focus" },
        });

        freeByDay[day] = consumeFreeSlot(freeByDay[day], slotStart, endMs);
        subj.remaining -= allocMin;
        dailyMinutes[day] += allocMin;
        usedSubjectDay.add(keySD);
      }
    }
  }

  return { sessions, subjects };
}