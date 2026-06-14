import { useEffect, useState } from "react";
import api from "../api";

export default function Expenses({ group, onChange }) {
  const [expenses, setExpenses] = useState([]);
  const [adding, setAdding] = useState(false);

  async function load() {
    const { data } = await api.get(`/expenses/?group=${group.id}`);
    setExpenses(data);
  }
  useEffect(() => { load(); }, [group.id]);

  async function remove(id) {
    if (!confirm("Delete this expense?")) return;
    await api.delete(`/expenses/${id}/`);
    load(); onChange?.();
  }

  return (
    <div className="card">
      <div className="between">
        <h3 style={{ margin: 0 }}>Expenses ({expenses.length})</h3>
        <button onClick={() => setAdding(!adding)}>{adding ? "Close" : "+ Add expense"}</button>
      </div>

      {adding && (
        <AddExpense group={group} onAdded={() => { setAdding(false); load(); onChange?.(); }} />
      )}

      <table style={{ marginTop: 12 }}>
        <thead>
          <tr><th>Date</th><th>Description</th><th>Paid by</th><th>Type</th>
            <th className="num">Amount</th><th></th></tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td className="small">{e.date}</td>
              <td>{e.description}
                {e.currency !== group.base_currency &&
                  <span className="muted small"> ({e.amount} {e.currency})</span>}
              </td>
              <td>{e.paid_by_name}</td>
              <td className="small">{e.split_type}</td>
              <td className="num">{e.amount_base} {group.base_currency}</td>
              <td><button className="ghost small" onClick={() => remove(e.id)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddExpense({ group, onAdded }) {
  const members = group.members;
  const [f, setF] = useState({
    description: "", date: new Date().toISOString().slice(0, 10),
    paid_by: members[0]?.id, amount: "", currency: "INR", split_type: "equal", notes: "",
  });
  const [checked, setChecked] = useState(() => members.map((m) => m.id));
  const [values, setValues] = useState({});
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const needsValue = f.split_type !== "equal";

  function toggle(id) {
    setChecked(checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id]);
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    const splits = checked.map((id) => ({
      member: id, value: needsValue ? Number(values[id] || 0) : null,
    }));
    try {
      await api.post("/expenses/", {
        group: group.id, description: f.description, date: f.date,
        paid_by: Number(f.paid_by), amount: f.amount, currency: f.currency,
        split_type: f.split_type, notes: f.notes, splits,
      });
      onAdded();
    } catch (e2) {
      setErr(JSON.stringify(e2.response?.data) || "Failed");
    }
  }

  return (
    <form onSubmit={submit} className="drawer">
      <div className="grid2">
        <div><label>Description</label><input value={f.description} onChange={set("description")} required /></div>
        <div><label>Date</label><input type="date" value={f.date} onChange={set("date")} /></div>
        <div><label>Paid by</label>
          <select value={f.paid_by} onChange={set("paid_by")}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div><label>Amount</label><input type="number" step="0.01" value={f.amount} onChange={set("amount")} required /></div>
        <div><label>Currency</label>
          <select value={f.currency} onChange={set("currency")}>
            <option>INR</option><option>USD</option>
          </select>
        </div>
        <div><label>Split type</label>
          <select value={f.split_type} onChange={set("split_type")}>
            <option value="equal">Equal</option>
            <option value="unequal">Unequal (exact amounts)</option>
            <option value="percentage">Percentage</option>
            <option value="share">Shares (ratio)</option>
          </select>
        </div>
      </div>

      <label>Participants {needsValue && <span className="muted">— enter {f.split_type} value each</span>}</label>
      <div className="row">
        {members.map((m) => (
          <div key={m.id} className="row" style={{ gap: 6 }}>
            <input type="checkbox" style={{ width: "auto" }}
              checked={checked.includes(m.id)} onChange={() => toggle(m.id)} />
            <span>{m.name}</span>
            {needsValue && checked.includes(m.id) && (
              <input style={{ width: 80 }} type="number" step="0.01"
                value={values[m.id] || ""} onChange={(e) =>
                  setValues({ ...values, [m.id]: e.target.value })} />
            )}
          </div>
        ))}
      </div>
      {err && <div className="err">{err}</div>}
      <button style={{ marginTop: 12 }}>Save expense</button>
    </form>
  );
}
