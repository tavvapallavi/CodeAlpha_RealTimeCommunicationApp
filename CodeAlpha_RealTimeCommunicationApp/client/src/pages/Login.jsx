import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(form);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-intro">
        <h1 className="wordmark big">Sangam</h1>
        <p>Meet face to face, share your screen, swap files and sketch ideas together. Private by design.</p>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>Log in</h2>
        <label>
          Email
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>
          Password
          <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
        <p className="muted">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
