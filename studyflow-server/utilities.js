function toMs(iso) { return new Date(iso).getTime(); }
function toISO(ms) { return new Date(ms).toISOString(); }

function splitIntoDays(startISO, days = 7) {
  const start = new Date(startISO);
  start.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
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
    if (endMs <= s || startMs >= e) {
      out.push([s, e]);
      continue;
    }
    if (startMs > s) out.push([s, startMs]);
    if (endMs < e) out.push([endMs, e]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

// ----- Define the AI “optimizer” call (OpenAI GPT-4o-mini)

function difficultyToBand(d) {
  const n = Number(d);
  if (n <= 2) return "Easy";
  if (n === 3) return "Medium";
  return "Hard";
}

function defaultMinutesForDifficulty(d) {
  const n = Number(d);
  if (n <= 2) return 120;      // 2h
  if (n === 3) return 240;     // 4h
  return 360;                 // 6h
}

function buildOptimizerPrompt({ subjects, windowStartISO, windowEndISO }) {
  return `
You are an academic time-allocation optimizer.

We are planning ONLY within this window:
start: ${windowStartISO}
end: ${windowEndISO}

Return ONLY valid JSON. No extra text.

Goal:
Compute recommended allocation weights and minutes for the next 7 days.

Inputs:
Subjects array with fields:
- title
- difficulty (1-5)
- examDate (optional ISO date)
- weakTopics (optional array of strings)
- availableHoursPerDay (optional number, else assume enough free time)

Rules:
- difficulty 1-2 baseline: 120 minutes/week
- difficulty 3 baseline: 240 minutes/week
- difficulty 4-5 baseline: 360 minutes/week
- If exam is within 7 days, allow up to +50% minutes for that subject.
- If exam is within 14 days, allow up to +25% minutes.
- Keep totalMinutes realistic for a 7-day window.

Output schema (exact):
{
  "subjects": [
    {
      "title": "string",
      "priority": 0-100,
      "target_minutes": number,
      "strategy": {
        "prefer_after_class": true/false,
        "distribution": "front_load | spaced | end_load",
        "review_ratio": 0.0-0.5
      },
      "one_line_tip": "max 12 words"
    }
  ]
}

Subjects:
${JSON.stringify(subjects, null, 2)}
`.trim();
}

async function aiOptimizeAllocation({ subjects, windowStartISO, windowEndISO }) {
  const API_KEY = process.env.OPENAI_API_KEY;
  if (!API_KEY) throw new Error("Missing OPENAI_API_KEY");

  // Provide a baseline so AI doesn't go crazy
  const enriched = subjects.map(s => ({
    title: s.title,
    difficulty: Number(s.difficulty ?? 3),
    examDate: s.examDate ?? null,
    weakTopics: s.weakTopics ?? [],
    baseline_minutes: defaultMinutesForDifficulty(s.difficulty ?? 3),
  }));

  const prompt = buildOptimizerPrompt({
    subjects: enriched,
    windowStartISO,
    windowEndISO,
  });

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return only JSON. Do not include reasoning." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned empty content");
  return JSON.parse(raw);
}

// Constraint-safe scheduler that uses AI priorities

function scheduleFromFreeSlots({ events, aiPlan, windowStartISO }) {
  const days = splitIntoDays(windowStartISO, 7);

  // Busy intervals per day
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

  // Free slots per day (08-22)
  const freeByDay = {};
  for (const day of days) {
    const [ds, de] = clampDayWindow(day, 8, 22);
    freeByDay[day] = subtractIntervals(ds, de, busyByDay[day]);
  }

  // Class end times for prefer_after_class
  const classEndBySubjectDay = {};
  for (const ev of events) {
    if (ev.type !== "class") continue;
    const s = toMs(ev.start);
    const e = toMs(ev.end);
    const dayKey = new Date(s).toISOString().slice(0, 10);
    const key = `${ev.title}|${dayKey}`;
    classEndBySubjectDay[key] = Math.max(classEndBySubjectDay[key] || 0, e);
  }

  // Daily caps
  const MAX_BLOCK_MIN = 120;
  const MAX_DAY_MIN = 240;
  const dailyMinutes = {};
  for (const day of days) dailyMinutes[day] = 0;

  // Prepare subjects (sorted by AI priority)
  const subjects = (aiPlan.subjects || []).map(s => ({
    title: s.title,
    priority: Number(s.priority ?? 50),
    remaining: Math.max(0, Number(s.target_minutes ?? 0)),
    strategy: s.strategy || { prefer_after_class: true, distribution: "spaced", review_ratio: 0.2 },
    tip: s.one_line_tip || "",
  })).sort((a, b) => b.priority - a.priority);

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

  // Two passes: first enforce "no same subject twice/day", then relax if needed
  for (let pass = 0; pass < 2; pass++) {
    for (const day of days) {
      if (dailyMinutes[day] >= MAX_DAY_MIN) continue;

      // Bias by distribution strategy
      const ordered = subjects.slice().sort((a, b) => {
        // base: higher priority and remaining minutes first
        const scoreA = a.priority * 10 + a.remaining;
        const scoreB = b.priority * 10 + b.remaining;

        // distribution tweak
        // front_load: earlier days get more weight
        // end_load: later days get more weight
        // spaced: neutral
        const dayIndex = days.indexOf(day);
        const tA = distributionFactor(a.strategy?.distribution, dayIndex);
        const tB = distributionFactor(b.strategy?.distribution, dayIndex);

        return (scoreB * tB) - (scoreA * tA);
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
          meta: { kind: "focus" }
        });

        freeByDay[day] = consumeFreeSlot(freeByDay[day], slotStart, endMs);
        subj.remaining -= allocMin;
        dailyMinutes[day] += allocMin;
        usedSubjectDay.add(keySD);
      }
    }
  }

  // Optional: add review blocks (simple V1)
  // For each subject, if review_ratio > 0, create one 30-min review if free time remains.
  for (const subj of subjects) {
    const ratio = Math.max(0, Math.min(0.5, Number(subj.strategy?.review_ratio ?? 0)));
    if (ratio <= 0) continue;

    // Put 1 review block 2–3 days after first focus session if possible
    const first = sessions.find(s => s.title === subj.title && s.meta?.kind === "focus");
    if (!first) continue;

    const firstDay = first.start.slice(0, 10);
    const idx = days.indexOf(firstDay);
    const targetIdx = Math.min(days.length - 1, idx + 2);
    const day = days[targetIdx];

    if (dailyMinutes[day] >= 240) continue;

    const slot = (freeByDay[day] || []).find(([fs, fe]) => (fe - fs) >= 30 * 60000);
    if (!slot) continue;

    const [fs] = slot;
    const endMs = fs + 30 * 60000;

    sessions.push({
      title: subj.title,
      start: toISO(fs),
      end: toISO(endMs),
      type: "study",
      meta: { kind: "review" }
    });

    freeByDay[day] = consumeFreeSlot(freeByDay[day], fs, endMs);
    dailyMinutes[day] += 30;
  }

  return { sessions, subjects };
}

function distributionFactor(dist, dayIndex) {
  // dayIndex: 0..6
  if (dist === "front_load") return 1.3 - dayIndex * 0.05; // more weight earlier
  if (dist === "end_load") return 0.9 + dayIndex * 0.06;   // more weight later
  return 1.0; // spaced
}

