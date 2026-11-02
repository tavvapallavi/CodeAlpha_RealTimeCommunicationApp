import { Router } from "express";
import crypto from "crypto";
import Room from "../models/Room.js";
import auth from "../middleware/auth.js";

const router = Router();

// Create a meeting room. The encryption key is made in the browser and never sent here.
router.post("/", auth, async (req, res, next) => {
  try {
    const code = crypto.randomBytes(5).toString("hex");
    const room = await Room.create({ code, host: req.userId });
    res.status(201).json({ code: room.code });
  } catch (err) {
    next(err);
  }
});

router.get("/:code", auth, async (req, res, next) => {
  try {
    const room = await Room.findOne({ code: req.params.code });
    if (!room) return res.status(404).json({ message: "Meeting not found." });
    res.json({ code: room.code });
  } catch (err) {
    next(err);
  }
});

export default router;
