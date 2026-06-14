import { useState } from "react";
import api from "../api";

export default function ImportWizard({ group, onCommitted }) {
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function upload() {
    if (!file) return;
    setBusy(true); setErr("");
    const fd = new FormData();
    fd.append("group", group.id);
    fd.append("file", file);
    try {
      const { data } = await api.post("/imports/upload", fd);
      setReport(data);
    } catch (e) {
      setErr(e.response?.data?.detail || "Upload failed");
    } finally { setBusy(false); }
  }

  async function decide(rowId, status) {
    await api.post(`/imports/${report.batch_id}/rows/${rowId}/decision`, { status });
    setReport({
      ...report,
      rows: report.rows.map((r) => (r.id === rowId ? { ...r, status } : r)),
    });
  }

  async function commit(autoApprove) {
    setBusy(true); setErr("");
    try {
      await api.post(`/imports/${report.batch_id}/commit`, { auto_approve: autoApprove });
      onCommitted?.();
    } catch (e) {
      setErr(e.response?.data?.detail || "Commit failed");
    } finally { setBusy(false); }
  }

  if (!report) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Import expenses CSV</h3>
        <p className="muted small">
          Upload <code>expenses_export.csv</code>. The app detects every data
          problem, shows you exactly what it will do, and changes nothing until
          you approve.
        </p>
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} />
        {err && <div className="err">{err}</div>}
        <button style={{ marginTop: 12 }} disabled={!file || busy} onClick={upload}>
          {busy ? "Analyzing…" : "Upload & analyze"}
        </button>
      </div>
    );
  }

  const sev = report.by_severity;
  const pending = report.rows.filter((r) => r.status === "needs_review").length;

  return (
    <div className="card">
      <div className="between">
        <h3 style={{ margin: 0 }}>Import report</h3>
        <button className="ghost" onClick={() => setReport(null)}>↩ Start over</button>
      </div>
      <p className="muted small">
        {report.raw_row_count} rows · <b>{report.anomaly_count} anomalies</b>{" "}
        (<span className="pill error">{sev.error} error</span>{" "}
        <span className="pill warning">{sev.warning} warning</span>{" "}
        <span className="pill info">{sev.info} info</span>) · {pending} awaiting your decision
      </p>

      <table>
        <thead>
          <tr><th>Row</th><th>Action</th><th>Status</th><th>Anomalies & handling</th><th></th></tr>
        </thead>
        <tbody>
          {report.rows.filter((r) => r.anomalies.length > 0).map((r) => (
            <tr key={r.id}>
              <td className="num">{r.row_number}</td>
              <td className="small">{r.action_label}</td>
              <td><span className={`pill ${r.status}`}>{r.status.replace("_", " ")}</span></td>
              <td>
                {r.anomalies.map((a, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <span className={`pill ${a.severity}`}>{a.code}</span>{" "}
                    <span className="small">{a.message}</span>{" "}
                    <span className="small muted">→ {a.action_taken}</span>
                  </div>
                ))}
              </td>
              <td>
                {r.status === "needs_review" && (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="ok small" onClick={() => decide(r.id, "approved")}>✓</button>
                    <button className="danger small" onClick={() => decide(r.id, "rejected")}>✕</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {err && <div className="err">{err}</div>}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="ok" disabled={busy || pending > 0} onClick={() => commit(false)}>
          Import approved rows
        </button>
        <button className="ghost" disabled={busy} onClick={() => commit(true)}>
          Approve all recommendations & import
        </button>
        {pending > 0 && <span className="muted small">Decide the {pending} pending row(s) first, or use "Approve all".</span>}
      </div>
    </div>
  );
}
