import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";

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

// Hackathon storage (in-memory). Good enough for demo.
// Later: store in DB or encrypted cookie/session.
let tokens = null;

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  // Later when we create events: "https://www.googleapis.com/auth/calendar.events"
];

app.get("/auth/google/url", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // ensures refresh_token in many cases
  });
  res.json({ url });
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const { tokens: t } = await oauth2Client.getToken(code);
    tokens = t;
    oauth2Client.setCredentials(tokens);

    // redirect back to frontend
    res.redirect(`${process.env.FRONTEND_URL}/?google=connected`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Auth failed");
  }
});

app.get("/api/auth/status", (req, res) => {
  res.json({ connected: !!tokens });
});

app.get("/api/calendar/events", async (req, res) => {
  try {
    if (!tokens) return res.status(401).json({ error: "Not connected" });

    oauth2Client.setCredentials(tokens);

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Query window (default: next 7 days)
    const timeMin = req.query.timeMin || new Date().toISOString();
    const timeMax =
      req.query.timeMax ||
      new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const resp = await calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 50,
    });

    const items = (resp.data.items || []).map((ev) => ({
      id: ev.id,
      title: ev.summary || "(No title)",
      start: ev.start?.dateTime || ev.start?.date,
      end: ev.end?.dateTime || ev.end?.date,
    }));

    res.json({ items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 5000}`);
});