const API_BASE = "http://localhost:5000";

export async function getAuthStatus() {
  const r = await fetch(`${API_BASE}/api/auth/status`);
  return r.json();
}

export async function getGoogleAuthUrl() {
  const r = await fetch(`${API_BASE}/auth/google/url`);
  return r.json();
}

export async function fetchEvents({ timeMin, timeMax } = {}) {
  const params = new URLSearchParams();
  if (timeMin) params.set("timeMin", timeMin);
  if (timeMax) params.set("timeMax", timeMax);

  const r = await fetch(`${API_BASE}/api/calendar/events?${params.toString()}`);
  if (!r.ok) throw new Error("Not connected or failed to fetch");
  return r.json();
}