// planner/google.js
export function normalizeEventsForPlanner(items) {
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

export async function fetchGoogleEvents({ google, oauth2Client, tokens, calendarId, timeMin, timeMax }) {
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

  return (resp.data.items || []).map((ev) => {
    const difficultyRaw = ev.extendedProperties?.private?.studyflow_difficulty ?? null;
    const hasDifficulty = difficultyRaw !== null && difficultyRaw !== undefined && difficultyRaw !== "";

    return {
      id: ev.id,
      title: ev.summary || "(No title)",
      start: ev.start?.dateTime || ev.start?.date,
      end: ev.end?.dateTime || ev.end?.date,
      difficulty: hasDifficulty ? Number(difficultyRaw) : null,
      type: hasDifficulty ? "class" : "other",
      _raw: ev, // optional for debugging
    };
  });
}