import { startGoogleAuth } from "../lib/api";

export default function SyncStatusCard() {
    return (
        <button className="btnGhost" onClick={startGoogleAuth}>
            Connect Calendar
        </button>
    );
}