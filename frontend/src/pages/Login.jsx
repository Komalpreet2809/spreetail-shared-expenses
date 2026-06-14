import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "demo", email: "", password: "demo12345" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") await login(form.username, form.password);
      else await register(form.username, form.email, form.password);
      navigate("/");
    } catch (e2) {
      setErr(e2.response?.data?.detail || JSON.stringify(e2.response?.data) || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <div className="card auth">
        <div className="brand" style={{ fontSize: 22, marginBottom: 4 }}>
          Broke<span>Together</span>
        </div>
        <div className="muted small" style={{ marginBottom: 14 }}>
          Shared expenses for flatmates · Spreetail assignment
        </div>
        <form onSubmit={submit}>
          <label>Username</label>
          <input value={form.username} onChange={set("username")} autoFocus />
          {mode === "register" && (
            <>
              <label>Email</label>
              <input value={form.email} onChange={set("email")} type="email" />
            </>
          )}
          <label>Password</label>
          <input value={form.password} onChange={set("password")} type="password" />
          {err && <div className="err">{err}</div>}
          <button style={{ width: "100%", marginTop: 16 }} disabled={busy}>
            {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
        <div className="muted small" style={{ marginTop: 14 }}>
          {mode === "login" ? "New here? " : "Have an account? "}
          <a onClick={() => setMode(mode === "login" ? "register" : "login")} href="#">
            {mode === "login" ? "Register" : "Log in"}
          </a>
          <div style={{ marginTop: 8 }}>Demo account: <b>demo / demo12345</b></div>
        </div>
      </div>
    </div>
  );
}
