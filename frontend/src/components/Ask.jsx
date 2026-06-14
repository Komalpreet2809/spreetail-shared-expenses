import { useState } from "react";
import api from "../api";

const SAMPLES = [
  "How much does Rohan owe in total?",
  "Who should pay Aisha and how much?",
  "Who owes the most money?",
];

export default function Ask({ groupId }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  async function ask(question) {
    const text = question ?? q;
    if (!text.trim()) return;
    setBusy(true); setRes(null);
    try {
      const { data } = await api.post(`/groups/${groupId}/ask`, { question: text });
      setRes(data);
    } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Ask about your balances</h3>
      <p className="muted small">
        Ask in plain English. The AI only reads the question and phrases the
        answer — every number comes from the app's exact balance calculation, not
        from the model.
      </p>
      <div className="row">
        <input
          placeholder="e.g. How much does Priya owe?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
        />
        <button disabled={busy} onClick={() => ask()}>{busy ? "…" : "Ask"}</button>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        {SAMPLES.map((s) => (
          <button key={s} className="ghost small" onClick={() => { setQ(s); ask(s); }}>{s}</button>
        ))}
      </div>

      {res && (
        <div className="answer">
          <div>{res.answer}</div>
          <div className="muted small" style={{ marginTop: 8 }}>
            {res.ai_used ? `Answered by ${res.model} · numbers from the deterministic engine`
                         : "AI unavailable — showing raw facts"}
          </div>
          {!res.ai_used && (
            <pre className="small" style={{ overflowX: "auto" }}>
              {JSON.stringify(res.facts, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
