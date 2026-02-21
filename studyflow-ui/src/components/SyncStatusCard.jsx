import { useEffect, useState } from "react";
import { getAuthStatus, getGoogleAuthUrl } from "../lib/api";

export default function SyncStatusCard() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const s = await getAuthStatus();
    setConnected(!!s.connected);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function connect() {
    const { url } = await getGoogleAuthUrl();
    window.location.href = url; // redirect to Google
  }

  return (
    <div>
      <div className="syncRow">
        <div className={`pill ${connected ? "ok" : "warn"}`}>
          {loading ? "Checking..." : connected ? "Connected" : "Not connected"}
        </div>
      </div>

      <div className="syncActions">
        {!connected ? (
          <button className="btnPrimary" onClick={connect}>
            Connect Google Calendar
          </button>
        ) : (
          <button className="btnGhost" onClick={refresh}>
            Refresh status
          </button>
        )}
      </div>

      <div className="tinyNote">
        We only read events for conflict detection (titles optional).
      </div>
    </div>
  );
}