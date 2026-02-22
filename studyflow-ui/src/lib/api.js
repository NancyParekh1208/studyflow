const API_BASE = "http://localhost:5000";

export async function getAuthStatus() {
  const r = await fetch(`${API_BASE}/api/auth/status`);
  return r.json();
}

export function startGoogleAuth() {
  window.location.href = `${API_BASE}/auth/google/start`;
}

export async function fetchEvents({ timeMin, timeMax } = {}) {
  const params = new URLSearchParams();
  if (timeMin) params.set("timeMin", timeMin);
  if (timeMax) params.set("timeMax", timeMax);

  const r = await fetch(`${API_BASE}/api/calendar/events?${params.toString()}`);
  if (!r.ok) throw new Error("Not connected or failed to fetch");
  return r.json();
}

export async function createClassEvent(payload) {
  const r = await fetch("http://localhost:5000/api/calendar/create-class", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Failed to create class");
  return data;
}