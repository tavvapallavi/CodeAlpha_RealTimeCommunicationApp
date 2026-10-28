import { useEffect, useRef, useState } from "react";
import { decryptBytes, decryptJson, encryptBytes, encryptJson } from "../lib/crypto.js";

const MAX_FILE = 8 * 1024 * 1024;

const prettySize = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function ChatPanel({ socket, cryptoKey, username, open }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    const add = (m) => setMessages((list) => [...list, { id: crypto.randomUUID(), ts: Date.now(), ...m }]);

    const onChat = async ({ username: from, payload }) => {
      try {
        const { text: t } = await decryptJson(cryptoKey, payload);
        add({ kind: "text", from, text: t });
      } catch {
        // Could not decrypt: ignore.
      }
    };
    const onFile = async ({ username: from, payload }) => {
      try {
        const meta = await decryptJson(cryptoKey, payload.meta);
        add({ kind: "file", from, meta, data: payload.data });
      } catch {
        // Could not decrypt: ignore.
      }
    };
    socket.on("chat", onChat);
    socket.on("file", onFile);
    return () => {
      socket.off("chat", onChat);
      socket.off("file", onFile);
    };
  }, [socket, cryptoKey]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    socket.emit("chat", await encryptJson(cryptoKey, { text: t }));
    setMessages((list) => [...list, { id: crypto.randomUUID(), ts: Date.now(), kind: "text", from: username, self: true, text: t }]);
  };

  const sendFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE) {
      setError("Files can be up to 8 MB.");
      return;
    }
    setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const data = await encryptBytes(cryptoKey, bytes);
      const meta = await encryptJson(cryptoKey, { name: file.name, type: file.type, size: file.size });
      socket.emit("file", { meta, data });
      setMessages((list) => [
        ...list,
        { id: crypto.randomUUID(), ts: Date.now(), kind: "file", from: username, self: true, meta: { name: file.name, size: file.size }, blob: file },
      ]);
    } catch {
      setError("Could not send that file. Try again.");
    }
  };

  const download = async (m) => {
    try {
      if (m.blob) return saveBlob(m.blob, m.meta.name);
      const bytes = await decryptBytes(cryptoKey, m.data);
      saveBlob(new Blob([bytes], { type: m.meta.type || "application/octet-stream" }), m.meta.name);
    } catch {
      setError("Could not decrypt that file.");
    }
  };

  return (
    <aside className="chat" style={{ display: open ? "flex" : "none" }}>
      <h2 className="chat-title">Chat and files</h2>
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && (
          <p className="chat-empty">Messages and files are encrypted in your browser. People who join later will not see earlier messages.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.self ? "self" : ""}`}>
            <span className="msg-from">{m.self ? "You" : m.from}</span>
            {m.kind === "text" ? (
              <p>{m.text}</p>
            ) : (
              <button className="file-card" onClick={() => download(m)}>
                <strong>{m.meta.name}</strong>
                <span>{prettySize(m.meta.size)} · Download</span>
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p className="chat-error">{error}</p>}
      <form className="chat-form" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" maxLength={1000} />
        <button className="send" disabled={!text.trim()}>Send</button>
      </form>
      <input ref={fileRef} type="file" hidden onChange={sendFile} />
      <button className="attach" onClick={() => fileRef.current.click()}>Share a file (up to 8 MB)</button>
    </aside>
  );
}
