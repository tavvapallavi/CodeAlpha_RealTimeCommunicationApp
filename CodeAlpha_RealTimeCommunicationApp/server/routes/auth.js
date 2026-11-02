import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = Router();

const sign = (u) =>
  jwt.sign({ id: u._id, username: u.username }, process.env.JWT_SECRET, { expiresIn: "7d" });

const publicUser = (u) => ({ _id: u._id, username: u.username, email: u.email });

router.post("/register", async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: "Enter a username, email and password." });
    if (username.trim().length < 3)
      return res.status(400).json({ message: "Username needs at least 3 characters." });
    if (password.length < 6)
      return res.status(400).json({ message: "Password needs at least 6 characters." });

    const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (exists) return res.status(409).json({ message: "That username or email is already taken." });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashed });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: (email || "").toLowerCase() });
    if (!user || !(await bcrypt.compare(password || "", user.password)))
      return res.status(401).json({ message: "Email or password is incorrect." });
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get("/me", auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Account not found." });
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
});

export default router;
