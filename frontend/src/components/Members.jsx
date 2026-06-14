import { useState } from "react";
import api from "../api";

export default function Members({ group, onChange }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", joined_on: "", left_on: "", is_guest: false });

  async function save(member, patch) {
    await api.patch(`/members/${member.id}/`, patch);
    onChange?.();
  }
  async function add(e) {
    e.preventDefault();
    await api.post("/members/", {
      group: group.id, name: form.name,
      joined_on: form.joined_on || null, left_on: form.left_on || null,
      is_guest: form.is_guest,
    });
    setForm({ name: "", joined_on: "", left_on: "", is_guest: false });
    setAdding(false);
    onChange?.();
  }

  return (
    <div className="card">
      <div className="between">
        <h3 style={{ margin: 0 }}>Members</h3>
        <button onClick={() => setAdding(!adding)}>{adding ? "Close" : "+ Add member"}</button>
      </div>
      <p className="muted small">
        Membership is time-bound. A member only shares expenses dated within their
        window — so March electricity never touches Sam, and April groceries never
        touch Meera.
      </p>

      {adding && (
        <form className="drawer" onSubmit={add}>
          <div className="grid2">
            <div><label>Name</label><input value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label>Guest?</label>
              <select value={form.is_guest} onChange={(e) =>
                setForm({ ...form, is_guest: e.target.value === "true" })}>
                <option value="false">No</option><option value="true">Yes</option>
              </select></div>
            <div><label>Joined on (blank = since start)</label>
              <input type="date" value={form.joined_on}
                onChange={(e) => setForm({ ...form, joined_on: e.target.value })} /></div>
            <div><label>Left on (blank = still here)</label>
              <input type="date" value={form.left_on}
                onChange={(e) => setForm({ ...form, left_on: e.target.value })} /></div>
          </div>
          <button style={{ marginTop: 10 }}>Add</button>
        </form>
      )}

      <table style={{ marginTop: 12 }}>
        <thead><tr><th>Name</th><th>Joined</th><th>Left</th><th>Guest</th></tr></thead>
        <tbody>
          {group.members.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td><input type="date" defaultValue={m.joined_on || ""}
                onBlur={(e) => save(m, { joined_on: e.target.value || null })} /></td>
              <td><input type="date" defaultValue={m.left_on || ""}
                onBlur={(e) => save(m, { left_on: e.target.value || null })} /></td>
              <td>{m.is_guest ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
