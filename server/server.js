
import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { Server } from "socket.io";

import authRoutes from "./routes/auth.js";
import roomRoutes from "./routes/rooms.js";
import setupSockets from "./socket.js";

const app = express();

// Express middleware
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    message: "Something went wrong on the server.",
  });
});

// Create HTTP server
const server = http.createServer(app);

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: "https://sangam-client.onrender.com",
    methods: ["GET", "POST"],
    credentials: true,
  },
  maxHttpBufferSize: 12 * 1024 * 1024,
});

// Configure meeting sockets
setupSockets(io);

// Render port
const PORT = process.env.PORT || 5000;

// Connect MongoDB and start server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
