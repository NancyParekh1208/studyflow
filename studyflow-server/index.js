import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";
import fetch from "node-fetch";
import { normalizeSubjects } from "./planner/subjects.js";
import { aiOptimizeAllocation, defaultMinutesForDifficulty, difficultyToBand } from "./planner/ai.js";
import { scheduleFromFreeSlots, toMs } from "./planner/scheduler.js";
import { commitStudyPlan, deletePlanEvents } from "./planner/calendarWrite.js";

import fs from "fs";

const TOKENS_PATH = "./tokens.json";

function loadTokens() {
  try {
    if (fs.existsSync(TOKENS_PATH)) {
      return JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to load tokens:", e);
  }
  return null;
}

function saveTokens(t) {
  try {
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(t, null, 2));
  } catch (e) {
    console.error("Failed to save tokens:", e);
  }
}

const DEMO_CALENDAR_ID =
    "90b421d55702acd9c5e080eaca49fcb390a977515e6f51fad797fad8c8e45833@group.calendar.google.com";

dotenv.config();

console.log("CLIENT_ID:", process.env.CLIENT_ID);
console.log("REDIRECT_URI:", process.env.REDIRECT_URI);

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());


const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URI
);

console.log("OAuth2 constructed:", {
    hasClientId: !!process.env.CLIENT_ID,
    hasClientSecret: !!process.env.CLIENT_SECRET,
    redirect: process.env.REDIRECT_URI,
});

let tokens = loadTokens();
if (tokens) oauth2Client.setCredentials(tokens);

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

// ================================================================
// StudyFlow AI — LLM Study Plan Generator (OpenRouter)
// ================================================================

// ------------------------------
// Google Calendar: fetch events (NON-MODULAR)
// ------------------------------
function normalizeEventsForPlanner(items) {
  const out = [];
  for (const ev of items || []) {
    const title = ev.title || "(No title)";
    const start = ev.start;
    const end = ev.end;
    if (!start || !end) continue;

    const dRaw = ev.difficulty;
    const difficulty =
      dRaw === null || dRaw === undefined || dRaw === ""
        ? null
        : Math.min(5, Math.max(1, Number(dRaw)));

    const type = ev.type || (difficulty ? "class" : "other");

    const isAllDayStart = typeof start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start);
    const isAllDayEnd = typeof end === "string" && /^\d{4}-\d{2}-\d{2}$/.test(end);

    if (isAllDayStart && isAllDayEnd) {
      out.push({
        title,
        start: `${start}T08:00:00`,
        end: `${start}T22:00:00`,
        difficulty,
        type: "other",
      });
      continue;
    }

    out.push({ title, start, end, difficulty, type });
  }
  return out;
}

async function fetchGoogleEvents({ timeMin, timeMax, calendarId = DEMO_CALENDAR_ID }) {
  // Debug prints
  console.log("\n[fetchGoogleEvents] called");
  console.log("[fetchGoogleEvents] calendarId:", calendarId);
  console.log("[fetchGoogleEvents] timeMin:", timeMin);
  console.log("[fetchGoogleEvents] timeMax:", timeMax);
  console.log("[fetchGoogleEvents] tokens present?:", !!tokens);

  if (!tokens) {
    const err = new Error("Not connected");
    err.status = 401;
    throw err;
  }

  oauth2Client.setCredentials(tokens);

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const resp = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  const mapped = (resp.data.items || []).map((ev) => {
    const difficultyRaw = ev.extendedProperties?.private?.studyflow_difficulty ?? null;
    const hasDifficulty = difficultyRaw !== null && difficultyRaw !== undefined && difficultyRaw !== "";

    return {
      id: ev.id,
      title: ev.summary || "(No title)",
      start: ev.start?.dateTime || ev.start?.date,
      end: ev.end?.dateTime || ev.end?.date,
      difficulty: hasDifficulty ? Number(difficultyRaw) : null,
      type: hasDifficulty ? "class" : "other",
    };
  });

  console.log("[fetchGoogleEvents] returned items:", mapped.length);
  if (mapped[0]) console.log("[fetchGoogleEvents] first item sample:", mapped[0]);

  return mapped;
}

function buildPrompt(events) {
    return `
Generate a weekly study schedule.

Input:
Calendar events with:
- title
- start (ISO)
- end (ISO)
- difficulty (1–5)
- type ("class" or "other")

Rules:

Difficulty to weekly study hours:
1–2 → 2 hours
3 → 4 hours
4–5 → 6 hours

Constraints:
- Schedule within the same Monday–Sunday week as input events.
- Availability window: 08:00–22:00.
- No overlap with any event.
- Max 2 hours per study block.
- Max 4 total study hours per day.
- Prefer scheduling after class sessions.
- Spread sessions across multiple days.

Output STRICT JSON only:

{
  "weekly_study_plan": [
    {
      "title": "Subject",
      "start": "ISO_DATETIME",
      "end": "ISO_DATETIME",
      "type": "study"
    }
  ],
  "summary": {
    "Subject": {
      "difficulty": "Easy | Medium | Hard",
      "total_study_hours": number,
      "sessions": number,
      "suggestion": "One short sentence under 15 words."
    }
  }
}

Events:
${JSON.stringify(events, null, 2)}
`.trim();
}

async function generateStudyPlanWithOpenAI(events) {
    const API_KEY = process.env.OPENAI_API_KEY;

    if (!API_KEY) {
        throw new Error("Missing OPENAI_API_KEY in environment variables.");
    }

    const prompt = buildPrompt(events);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.2,
            response_format: { type: "json_object" }, // forces JSON
            messages: [
                {
                    role: "system",
                    content: "You are a scheduling engine. Return ONLY valid JSON. No explanations."
                },
                {
                    role: "user",
                    content: prompt
                }
            ]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API error: ${err}`);
    }

    const data = await response.json();

    const raw = data.choices?.[0]?.message?.content;

    if (!raw) {
        throw new Error("OpenAI returned empty content.");
    }

    return JSON.parse(raw);
}


// ----------------------------------------------------------------
// OAuth Routes
// ----------------------------------------------------------------

app.get("/auth/google/start", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
    });
    return res.redirect(url);
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.redirect(`${process.env.FRONTEND_URL}?google=error`);

    const { tokens: t } = await oauth2Client.getToken(code);

    tokens = t;
    oauth2Client.setCredentials(tokens);
    saveTokens(tokens);   // ← THIS IS CRITICAL
    console.log("[oauth callback] tokens saved. has refresh_token?:", !!tokens.refresh_token);

    return res.redirect(`${process.env.FRONTEND_URL}?google=connected`);
  } catch (e) {
    console.error("OAuth callback error:", e);
    res.redirect(`${process.env.FRONTEND_URL}?google=error`);
  }
});

app.get("/api/auth/status", (req, res) => {
    res.json({ connected: !!tokens });
});

// ----------------------------------------------------------------
// Calendar events (enhanced to include type)
// ----------------------------------------------------------------

app.get("/api/calendar/events", async (req, res) => {
  try {
    if (!tokens) return res.status(401).json({ error: "Not connected" });

    const timeMin = req.query.timeMin || new Date().toISOString();
    const timeMax =
      req.query.timeMax || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const items = await fetchGoogleEvents({ timeMin, timeMax, calendarId: DEMO_CALENDAR_ID });
    res.json({ items });
  } catch (e) {
    console.error("[/api/calendar/events] error:", e);
    res.status(e.status || 500).json({ error: e.message || "Failed to fetch events" });
  }
});
// ----------------------------------------------------------------
// Create recurring class event (unchanged behavior)
// ----------------------------------------------------------------
app.post("/api/calendar/create-class", async (req, res) => {
    try {
        if (!tokens) return res.status(401).json({ error: "Not connected" });
        oauth2Client.setCredentials(tokens);
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });

        const {
            calendarId = DEMO_CALENDAR_ID,
            title,
            dayOfWeek, // "MO", "TU", ...
            startTime, // "10:00"
            endTime, // "11:30"
            startDate, // "2026-02-21" (first occurrence date)
            untilDate, // "2026-05-01" (end of semester)
            timezone = "America/New_York",
            location = "",
            description = "",
            difficulty = 3,
        } = req.body;

        if (!title || !dayOfWeek || !startTime || !endTime || !startDate || !untilDate) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // clamp 1-5
        const d = Math.min(5, Math.max(1, Number(difficulty)));

        // Build RFC3339 datetime strings
        const start = new Date(`${startDate}T${startTime}:00`);
        const end = new Date(`${startDate}T${endTime}:00`);

        const event = {
            summary: title,
            location,
            description,
            start: { dateTime: start.toISOString(), timeZone: timezone },
            end: { dateTime: end.toISOString(), timeZone: timezone },
            recurrence: [
                `RRULE:FREQ=WEEKLY;BYDAY=${dayOfWeek};UNTIL=${untilDate.replaceAll("-", "")}T235959Z`,
            ],
            extendedProperties: {
                private: {
                    studyflow_subject: title,
                    studyflow_difficulty: String(d),
                },
            },
        };

        const created = await calendar.events.insert({
            calendarId,
            requestBody: event,
        });

        res.json({
            ok: true,
            id: created.data.id,
            htmlLink: created.data.htmlLink,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to create class event" });
    }
});

app.post("/api/study-plan/suggestions", async (req, res) => {
    try {
        const { useCalendar, timeMin, timeMax, calendarId, events } = req.body || {};

        let plannerEvents;

        if (useCalendar) {
            const tMin = timeMin || new Date().toISOString();
            const tMax =
                timeMax || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

            

            plannerEvents = normalizeEventsForPlanner(fetched);
        } else if (Array.isArray(events)) {
            plannerEvents = normalizeEventsForPlanner(events);
        } else {
            return res.status(400).json({
                error:
                    "Provide either { useCalendar: true } or { events: [...] } in the request body.",
            });
        }

        const plan = await generateStudyPlanWithOpenAI(plannerEvents);

        // suggestions-only payload
        const suggestions = {};
        for (const [subject, info] of Object.entries(plan.summary || {})) {
            suggestions[subject] = info?.suggestion || "";
        }

        res.json({ suggestions });
    } catch (e) {
        console.error("Suggestions generation failed:", e);
        res.status(500).json({ error: e.message || "Failed to generate suggestions" });
    }
});

app.get("/api/test-openai", async (req, res) => {
    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "user", content: "Say hello in one sentence." }
                ]
            })
        });

        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Preview endpoint

app.post("/api/study-plan/preview", async (req, res) => {
  try {
    const { useCalendar = true, timeMin, timeMax, calendarId } = req.body || {};
    const subjects = normalizeSubjects(req.body?.subjects);

    if (!subjects.length) return res.status(400).json({ error: "subjects[] required" });

    const tMin = timeMin || new Date().toISOString();
    const tMax = timeMax || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const fetched = useCalendar
      ? await fetchGoogleEvents({
          google,
          oauth2Client,
          tokens,
          calendarId: calendarId || DEMO_CALENDAR_ID,
          timeMin: tMin,
          timeMax: tMax,
        })
      : [];

    const plannerEvents = normalizeEventsForPlanner(fetched);

    const aiPlan = await aiOptimizeAllocation({
      subjects,
      windowStartISO: tMin,
      windowEndISO: tMax,
      openaiKey: process.env.OPENAI_API_KEY,
    });

    // Safety clamp if AI forgets a subject
    const aiTitles = new Set((aiPlan.subjects || []).map((x) => x.title));
    for (const s of subjects) {
      if (!aiTitles.has(s.title)) {
        aiPlan.subjects = aiPlan.subjects || [];
        aiPlan.subjects.push({
          title: s.title,
          priority: 50,
          target_minutes: defaultMinutesForDifficulty(s.difficulty),
          strategy: { prefer_after_class: true, distribution: "spaced", review_ratio: 0.2 },
          one_line_tip: "Focus on practice and review briefly.",
        });
      }
    }

    const { sessions, subjects: finalSubjects } = scheduleFromFreeSlots({
      events: plannerEvents,
      aiPlan,
      windowStartISO: tMin,
    });

    const planId = `PLAN_${Math.random().toString(36).slice(2, 10)}`;

    const summary = {};
    for (const subj of finalSubjects) {
      const these = sessions.filter((x) => x.title === subj.title);
      const minutes = these.reduce((acc, x) => acc + (toMs(x.end) - toMs(x.start)) / 60000, 0);

      const orig = subjects.find((s) => s.title === subj.title);

      summary[subj.title] = {
        difficulty: difficultyToBand(orig?.difficulty ?? 3),
        total_study_hours: Math.round((minutes / 60) * 10) / 10,
        sessions: these.length,
        suggestion: subj.tip || "Balanced across the week based on priority.",
        priority: subj.priority,
      };
    }

    res.json({
      plan_id: planId,
      window: { start: tMin, end: tMax },
      weekly_study_plan: sessions,
      summary,
      ai_allocation: aiPlan,
    });
  } catch (e) {
    console.error("Preview failed:", e);
    res.status(e.status || 500).json({ error: e.message || "Failed to preview plan" });
  }
});

// commit endpoint

app.post("/api/study-plan/commit", async (req, res) => {
  try {
    const { plan_id, weekly_study_plan, calendarId = DEMO_CALENDAR_ID, timezone = "America/New_York" } = req.body || {};

    if (!plan_id || !Array.isArray(weekly_study_plan) || weekly_study_plan.length === 0) {
      return res.status(400).json({ error: "plan_id and weekly_study_plan[] required" });
    }

    const ids = await commitStudyPlan({
      google,
      oauth2Client,
      tokens,
      calendarId,
      timezone,
      planId: plan_id,
      sessions: weekly_study_plan,
    });

    res.json({ ok: true, inserted: ids.length, eventIds: ids });
  } catch (e) {
    console.error("Commit failed:", e);
    res.status(e.status || 500).json({ error: e.message || "Failed to commit plan" });
  }
});

// Recalulate endpoint

app.post("/api/study-plan/recalculate", async (req, res) => {
  try {
    const { previous_plan_id, mode = "preview", calendarId = DEMO_CALENDAR_ID } = req.body || {};
    const subjects = normalizeSubjects(req.body?.subjects);

    if (!subjects.length) return res.status(400).json({ error: "subjects[] required" });

    const tMin = new Date().toISOString();
    const tMax = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const fetched = await fetchGoogleEvents({
      google,
      oauth2Client,
      tokens,
      calendarId,
      timeMin: tMin,
      timeMax: tMax,
    });

    const plannerEvents = normalizeEventsForPlanner(fetched);

    const aiPlan = await aiOptimizeAllocation({
      subjects,
      windowStartISO: tMin,
      windowEndISO: tMax,
      openaiKey: process.env.OPENAI_API_KEY,
    });

    const { sessions } = scheduleFromFreeSlots({
      events: plannerEvents,
      aiPlan,
      windowStartISO: tMin,
    });

    const newPlanId = `PLAN_${Math.random().toString(36).slice(2, 10)}`;

    if (mode === "preview") {
      return res.json({ plan_id: newPlanId, weekly_study_plan: sessions, ai_allocation: aiPlan });
    }

    let deleted = 0;
    if (previous_plan_id) {
      deleted = await deletePlanEvents({
        google,
        oauth2Client,
        tokens,
        calendarId,
        planId: previous_plan_id,
      });
    }

    const ids = await commitStudyPlan({
      google,
      oauth2Client,
      tokens,
      calendarId,
      timezone: "America/New_York",
      planId: newPlanId,
      sessions,
    });

    res.json({ ok: true, deleted, inserted: ids.length, new_plan_id: newPlanId });
  } catch (e) {
    console.error("Recalculate failed:", e);
    res.status(e.status || 500).json({ error: e.message || "Failed to recalculate plan" });
  }
});

// ----------------------------------------------------------------
// Listen
// ----------------------------------------------------------------
app.listen(process.env.PORT || 5000, () => {
    console.log(`Server running on http://localhost:${process.env.PORT || 5000}`);
});