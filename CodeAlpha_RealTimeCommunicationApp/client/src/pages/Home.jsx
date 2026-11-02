import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { newKeyString } from "../lib/crypto.js";

// Accepts a full invite link and pulls out the meeting code and key.
function parseInvite(text) {
  try {
    const url = new URL(text.trim());
    const m = url.pathname.match(/\/room\/([a-f0-9]+)/i);
    if (m && url.hash.length > 1) return { code: m[1], key: url.hash.slice(1) };
  } catch {
    // Not a valid link.
  }
  return null;
}

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      const { code } = await api.createRoom();
      navigate(`/room/${code}#${newKeyString()}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const join = async (e) => {
    e.preventDefault();
    const invite = parseInvite(link);
    if (!invite) {
      setError("Paste the full invite link, including the part after the # sign.");
      return;
    }
    try {
      await api.checkRoom(invite.code);
      navigate(`/room/${invite.code}#${invite.key}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="home">
      <header className="home-head">
        <span className="wordmark">Sangam</span>
        <div className="home-user">
          <span className="muted">Signed in as <strong>{user.username}</strong></span>
          <button className="btn-quiet" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="home-main">
        <h1>Start talking in seconds</h1>
        <p className="lead">Video calls for up to 6 people, with screen sharing, file sharing and a shared whiteboard. Chat, files and drawings are encrypted end to end.</p>

        <div className="home-cards">
          <section className="home-card">
            <h2>New meeting</h2>
            <p className="muted">You get an invite link to send to others. Anyone with the link can join, as long as they have an account.</p>
            <button className="btn" onClick={start} disabled={busy}>{busy ? "Creating…" : "Start a meeting"}</button>
          </section>

          <form className="home-card" onSubmit={join}>
            <h2>Join a meeting</h2>
            <p className="muted">Paste the invite link you received.</p>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="http://localhost:5173/room/…" aria-label="Invite link" />
            <button className="btn-outline" disabled={!link.trim()}>Join</button>
          </form>
        </div>
        {error && <p className="error">{error}</p>}
      </main>
    </div>
  );
}
