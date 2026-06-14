import { useEffect, useState } from "react";
import api from "../api";

export default function Balances({ groupId }) {
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get(`/groups/${groupId}/balances`).then((r) => setData(r.data));
  }, [groupId]);

  async function toggle(memberId) {
    if (openId === memberId) { setOpenId(null); return; }
    setOpenId(memberId);
    setDetail(null);
    const { data } = await api.get(`/groups/${groupId}/members/${memberId}/breakdown`);
    setDetail(data);
  }

  if (!data) return <div className="muted">Loading balances…</div>;
  const cur = data.currency;

  return (
    <>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Net balances</h3>
        <p className="muted small">
          Positive = the group owes them. Negative = they owe the group. Click a
          person to see exactly which expenses make up their number.
        </p>
        <table>
          <thead>
            <tr><th>Member</th><th>Status</th><th className="num">Net ({cur})</th></tr>
          </thead>
          <tbody>
            {data.balances.map((b) => (
              <>
                <tr key={b.member_id} style={{ cursor: "pointer" }} onClick={() => toggle(b.member_id)}>
                  <td>{openId === b.member_id ? "▾ " : "▸ "}{b.name}</td>
                  <td className="muted">{b.status}</td>
                  <td className={`num ${b.net_minor > 0 ? "pos" : b.net_minor < 0 ? "neg" : ""}`}>
                    {b.net}
                  </td>
                </tr>
                {openId === b.member_id && (
                  <tr><td colSpan={3}>
                    {!detail ? <span className="muted">Loading…</span> : <Drill detail={detail} />}
                  </td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Settle up — who pays whom</h3>
        <p className="muted small">The fewest payments that clear all debts (Aisha's request).</p>
        {data.settle_up.length === 0 ? (
          <p className="pos">Everyone is settled up. 🎉</p>
        ) : (
          <table>
            <tbody>
              {data.settle_up.map((s, i) => (
                <tr key={i}>
                  <td><b>{s.from}</b> pays <b>{s.to}</b></td>
                  <td className="num neg">{s.amount} {cur}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Drill({ detail }) {
  const s = detail.summary;
  return (
    <div className="drawer">
      <div className="row" style={{ gap: 24 }}>
        <div><div className="muted small">Total paid</div><div className="pos">{s.total_paid}</div></div>
        <div><div className="muted small">Total owed</div><div className="neg">{s.total_owed}</div></div>
        <div><div className="muted small">Net</div>
          <div className={s.net_minor >= 0 ? "pos" : "neg"}>{s.net}</div></div>
      </div>
      <h4 style={{ marginBottom: 6 }}>Owes a share of</h4>
      <table>
        <thead><tr><th>Date</th><th>Expense</th><th>Paid by</th><th>Type</th>
          <th className="num">Share</th><th className="num">CSV row</th></tr></thead>
        <tbody>
          {detail.owed.map((o, i) => (
            <tr key={i}>
              <td className="small">{o.date}</td><td>{o.description}</td>
              <td className="small">{o.paid_by}</td><td className="small">{o.split_type}</td>
              <td className="num">{o.share}</td><td className="num muted small">{o.source_row}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {detail.settlements.length > 0 && (
        <>
          <h4 style={{ marginBottom: 6 }}>Settlements</h4>
          {detail.settlements.map((x, i) => (
            <div key={i} className="small">
              {x.direction} {x.amount} {x.direction === "paid" ? "to" : "from"} {x.counterparty} ({x.date})
            </div>
          ))}
        </>
      )}
    </div>
  );
}
