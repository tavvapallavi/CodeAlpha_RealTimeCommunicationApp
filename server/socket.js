import jwt from "jsonwebtoken";
import Room from "./models/Room.js";

const MAX_PEOPLE = 6; // video uses a mesh, so every extra person adds load for everyone

export default function setupSockets(io) {
  // Only logged-in users can open a socket.
  io.use((socket, next) => {
    try {
      const p = jwt.verify(socket.handshake.auth?.token || "", process.env.JWT_SECRET);
      socket.data.user = { id: p.id, username: p.username };
      next();
    } catch {
      next(new Error("Not logged in"));
    }
  });

  io.on("connection", (socket) => {
    const inSameRoom = (otherId) => {
      const code = socket.data.code;
      return !!code && !!io.sockets.adapter.rooms.get(code)?.has(otherId);
    };

    const leaveRoom = () => {
      const code = socket.data.code;
      if (!code) return;
      socket.data.code = null;
      socket.leave(code);
      io.to(code).emit("peer-left", socket.id);
    };

    socket.on("join", async ({ code } = {}, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        const room = await Room.findOne({ code: String(code || "") });
        if (!room) return reply({ error: "This meeting does not exist." });

        leaveRoom();
        const members = await io.in(room.code).fetchSockets();
        if (members.length >= MAX_PEOPLE)
          return reply({ error: `This meeting is full (${MAX_PEOPLE} people max).` });

        const peers = members.map((s) => ({ id: s.id, username: s.data.user.username }));
        socket.join(room.code);
        socket.data.code = room.code;
        reply({ me: socket.id, peers });
        socket.to(room.code).emit("peer-joined", { id: socket.id, username: socket.data.user.username });
      } catch (err) {
        console.error(err);
        reply({ error: "Could not join the meeting." });
      }
    });

    // WebRTC signalling: forward offers, answers and ICE candidates to one person.
    socket.on("signal", ({ to, data } = {}) => {
      if (inSameRoom(to)) io.to(to).emit("signal", { from: socket.id, data });
    });

    // The server only forwards these. Chat, files and whiteboard data arrive already
    // encrypted in the browser, so the server cannot read them.
    ["chat", "file", "media", "wb:segment", "wb:clear", "wb:request"].forEach((event) => {
      socket.on(event, (payload) => {
        const code = socket.data.code;
        if (!code) return;
        socket.to(code).emit(event, {
          from: socket.id,
          username: socket.data.user.username,
          payload,
        });
      });
    });

    // Send the current whiteboard to one person who just joined.
    socket.on("wb:state", ({ to, payload } = {}) => {
      if (inSameRoom(to)) io.to(to).emit("wb:state", { from: socket.id, payload });
    });

    socket.on("leave", leaveRoom);
    socket.on("disconnect", leaveRoom);
  });
}
