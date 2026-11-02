import jwt from "jsonwebtoken";

export default function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Log in to continue." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.id;
    req.username = payload.username;
    next();
  } catch {
    res.status(401).json({ message: "Your session expired. Log in again." });
  }
}
