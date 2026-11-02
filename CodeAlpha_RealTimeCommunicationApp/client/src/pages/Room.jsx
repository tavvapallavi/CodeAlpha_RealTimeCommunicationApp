import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { getToken } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import { importKey } from "../lib/crypto.js";
import useWebRTC from "../hooks/useWebRTC.js";
import VideoTile from "../components/VideoTile.jsx";
import Whiteboard from "../components/Whiteboard.jsx";
import ChatPanel from "../components/ChatPanel.jsx";

function Problem({ message }) {
  const navigate = useNavigate();
  return (
    <div className="room-problem">
      <p>{message}</p>
      <button className="btn" onClick={() => navigate("/")}>Back to home</button>
    </div>
  );
}

export default function Room() {
  const { code } = useParams();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [cryptoKey, setCryptoKey] = useState(null);
  const [keyError, setKeyError] = useState("");
  const [socket, setSocket] = useState(null);
  const [connError, setConnError] = useState("");
  const [view, setView] = useState("video");
  const [chatOpen, setChatOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  // 1. Read the encryption key from the invite link.
  useEffect(() => {
    const k = hash.slice(1);
    if (!k) {
      setKeyError("This link is missing its encryption key. Ask for the full invite link.");
      return;
    }
    importKey(k)
      .then(setCryptoKey)
      .catch(() => setKeyError("The encryption key in this link is not valid. Ask for a new invite link."));
  }, [hash]);

  // 2. Open the socket once we have the key.
  useEffect(() => {
    if (!cryptoKey) return undefined;
    const s = io({ auth: { token: getToken() } });
    s.on("connect_error", (e) => setConnError(e.message || "Could not connect to the server."));
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [cryptoKey]);

  const rtc = useWebRTC(socket, code);

  if (keyError) return <Problem message={keyError} />;
  if (connError) return <Problem message={`Connection problem: ${connError}`} />;
  if (rtc.error) return <Problem message={rtc.error} />;
  if (!cryptoKey || !socket) return <p className="muted center-note">Setting up a secure room…</p>;

  const peerList = Object.entries(rtc.peers);
  const count = peerList.length + 1;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this invite link:", window.location.href);
    }
  };

  const leave = () => navigate("/");

  return (
    <div className="room">
      <header className="room-head">
        <span className="wordmark">Sangam</span>
        <span className="room-code">Meeting {code}</span>
        <span className="secure">End-to-end encrypted</span>
        <span className="room-count">{count} {count === 1 ? "person" : "people"}</span>
      </header>

      {rtc.notice && <p className="room-notice">{rtc.notice}</p>}

      <div className="room-body">
        <section className="stage">
          <div className={`tiles ${view === "board" ? "strip" : "grid"}`}>
            <VideoTile
              stream={rtc.localStream}
              name={`${user.username} (you)`}
              muted
              mirror
              micOn={rtc.micOn}
              camOn={rtc.camOn}
              sharing={rtc.sharing}
            />
            {peerList.map(([id, p]) => (
              <VideoTile key={id} stream={p.stream} name={p.username || "Joining…"} micOn={p.mic} camOn={p.cam} />
            ))}
          </div>

          <Whiteboard socket={socket} cryptoKey={cryptoKey} joined={rtc.joined} visible={view === "board"} />
        </section>

        <ChatPanel socket={socket} cryptoKey={cryptoKey} username={user.username} open={chatOpen} />
      </div>

      <footer className="controls">
        <button className={`ctl ${rtc.micOn ? "" : "off"}`} onClick={rtc.toggleMic}>{rtc.micOn ? "Mute" : "Unmute"}</button>
        <button className={`ctl ${rtc.camOn ? "" : "off"}`} onClick={rtc.toggleCam}>{rtc.camOn ? "Camera off" : "Camera on"}</button>
        <button className={`ctl ${rtc.sharing ? "on" : ""}`} onClick={rtc.toggleShare}>{rtc.sharing ? "Stop sharing" : "Share screen"}</button>
        <button className={`ctl ${view === "board" ? "on" : ""}`} onClick={() => setView(view === "board" ? "video" : "board")}>
          {view === "board" ? "Back to video" : "Whiteboard"}
        </button>
        <button className={`ctl ${chatOpen ? "on" : ""}`} onClick={() => setChatOpen(!chatOpen)}>Chat</button>
        <button className="ctl" onClick={copyLink}>{copied ? "Link copied" : "Copy invite link"}</button>
        <button className="ctl leave" onClick={leave}>Leave</button>
      </footer>
    </div>
  );
}
