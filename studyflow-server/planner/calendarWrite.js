// planner/calendarWrite.js
export async function commitStudyPlan({ google, oauth2Client, tokens, calendarId, timezone, planId, sessions }) {
  if (!tokens) {
    const err = new Error("Not connected");
    err.status = 401;
    throw err;
  }

  oauth2Client.setCredentials(tokens);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const createdIds = [];
  for (const s of sessions) {
    const event = {
      summary: `Study: ${s.title}${s.meta?.kind === "review" ? " (Review)" : ""}`,
      start: { dateTime: s.start, timeZone: timezone },
      end: { dateTime: s.end, timeZone: timezone },
      extendedProperties: {
        private: {
          studyflow_type: "study",
          studyflow_subject: s.title,
          studyflow_plan_id: planId,
          studyflow_status: "planned",
          studyflow_kind: s.meta?.kind || "focus",
        },
      },
    };

    const created = await calendar.events.insert({ calendarId, requestBody: event });
    createdIds.push(created.data.id);
  }

  return createdIds;
}

export async function deletePlanEvents({ google, oauth2Client, tokens, calendarId, planId }) {
  if (!tokens) {
    const err = new Error("Not connected");
    err.status = 401;
    throw err;
  }

  oauth2Client.setCredentials(tokens);
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const timeMin = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  const resp = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 2500,
  });

  const items = resp.data.items || [];
  const toDelete = items.filter((ev) =>
    ev.extendedProperties?.private?.studyflow_plan_id === planId &&
    ev.extendedProperties?.private?.studyflow_type === "study"
  );

  for (const ev of toDelete) {
    await calendar.events.delete({ calendarId, eventId: ev.id });
  }

  return toDelete.length;
}