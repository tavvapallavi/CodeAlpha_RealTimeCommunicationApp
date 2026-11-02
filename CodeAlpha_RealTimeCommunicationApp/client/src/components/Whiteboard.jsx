import { useEffect, useRef, useState } from "react";
import { decryptJson, encryptJson } from "../lib/crypto.js";

const W = 1200;
const H = 700;
const COLORS = ["#17203a", "#b4234a", "#137a6b", "#1d5fa8", "#f0a500"];

export default function Whiteboard({ socket, cryptoKey, joined, visible }) {
  const canvasRef = useRef(null);
  const segments = useRef([]);
  const last = useRef(null);
  const gotState = useRef(false);
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(4);

  const drawSegment = (s) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = s.c;
    ctx.lineWidth = s.w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
  };

  const redraw = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    segments.current.forEach(drawSegment);
  };

  useEffect(() => {
    redraw();
  }, []);

  useEffect(() => {
    const onSegment = async ({ payload }) => {
      try {
        const s = await decryptJson(cryptoKey, payload);
        segments.current.push(s);
        drawSegment(s);
      } catch {
        // Ignore anything we cannot decrypt.
      }
    };
    const onClear = () => {
      segments.current = [];
      redraw();
    };
    // Someone new joined and asked for the board: send them what we have.
    const onRequest = async ({ from }) => {
      if (!segments.current.length) return;
      const payload = await encryptJson(cryptoKey, segments.current);
      socket.emit("wb:state", { to: from, payload });
    };
    const onState = async ({ payload }) => {
      if (gotState.current) return;
      gotState.current = true;
      try {
        const list = await decryptJson(cryptoKey, payload);
        segments.current = [...list, ...segments.current];
        redraw();
      } catch {
        gotState.current = false;
      }
    };
    socket.on("wb:segment", onSegment);
    socket.on("wb:clear", onClear);
    socket.on("wb:request", onRequest);
    socket.on("wb:state", onState);
    return () => {
      socket.off("wb:segment", onSegment);
      socket.off("wb:clear", onClear);
      socket.off("wb:request", onRequest);
      socket.off("wb:state", onState);
    };
  }, [socket, cryptoKey]);

  useEffect(() => {
    if (joined) socket.emit("wb:request", {});
  }, [joined, socket]);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - r.left) * W) / r.width),
      y: Math.round(((e.clientY - r.top) * H) / r.height),
    };
  };

  const down = (e) => {
    canvasRef.current.setPointerCapture(e.pointerId);
    last.current = pos(e);
  };

  const move = async (e) => {
    if (!last.current) return;
    const p = pos(e);
    const seg = {
      x1: last.current.x,
      y1: last.current.y,
      x2: p.x,
      y2: p.y,
      c: tool === "eraser" ? "#ffffff" : color,
      w: tool === "eraser" ? 24 : size,
    };
    last.current = p;
    segments.current.push(seg);
    drawSegment(seg);
    socket.emit("wb:segment", await encryptJson(cryptoKey, seg));
  };

  const up = () => {
    last.current = null;
  };

  const clearBoard = () => {
    segments.current = [];
    redraw();
    socket.emit("wb:clear", {});
  };

  return (
    <div className="board" style={{ display: visible ? "flex" : "none" }}>
      <div className="board-tools">
        <div className="swatches" role="group" aria-label="Pen colour">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${tool === "pen" && color === c ? "on" : ""}`}
              style={{ background: c }}
              aria-label={`Colour ${c}`}
              onClick={() => {
                setTool("pen");
                setColor(c);
              }}
            />
          ))}
        </div>
        <label className="size">
          Size
          <input type="range" min="2" max="16" value={size} onChange={(e) => setSize(+e.target.value)} />
        </label>
        <button className={`tool ${tool === "eraser" ? "on" : ""}`} onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}>
          Eraser
        </button>
        <button className="tool" onClick={clearBoard}>Clear board</button>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
    </div>
  );
}
