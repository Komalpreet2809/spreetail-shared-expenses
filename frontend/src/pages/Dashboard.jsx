import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../auth";
import Balances from "../components/Balances";
import Expenses from "../components/Expenses";
import Members from "../components/Members";
import ImportWizard from "../components/ImportWizard";
import Ask from "../components/Ask";

const TABS = ["Balances", "Expenses", "Members", "Import CSV", "Ask AI"];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState(null);
  const [tab, setTab] = useState("Balances");
  const [refreshKey, setRefreshKey] = useState(0);

  async function loadGroups() {
    const { data } = await api.get("/groups/");
    setGroups(data);
    if (data.length && !groupId) setGroupId(data[0].id);
  }
  useEffect(() => { loadGroups(); }, []);

  const group = groups.find((g) => g.id === groupId);
  const bump = () => setRefreshKey((k) => k + 1);

  async function createGroup() {
    const name = prompt("New group name?");
    if (!name) return;
    const { data } = await api.post("/groups/", { name, base_currency: "INR" });
    await loadGroups();
    setGroupId(data.id);
  }

  return (
    <>
      <div className="appbar">
        <div className="brand">Split<span>mate</span></div>
        <div className="row">
          {groups.length > 0 && (
            <select
              style={{ width: 180 }}
              value={groupId || ""}
              onChange={(e) => setGroupId(Number(e.target.value))}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}
          <button className="ghost" onClick={createGroup}>+ Group</button>
          <span className="muted small">{user?.username}</span>
          <button className="ghost" onClick={logout}>Log out</button>
        </div>
      </div>

      <div className="container">
        {!group ? (
          <div className="card">
            <p>No groups yet.</p>
            <button onClick={createGroup}>Create your first group</button>
          </div>
        ) : (
          <>
            <div className="between">
              <h2 style={{ margin: 0 }}>{group.name}</h2>
              <span className="muted small">
                {group.member_count} members · base {group.base_currency}
              </span>
            </div>

            <div className="tabs">
              {TABS.map((t) => (
                <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>

            {tab === "Balances" && <Balances groupId={group.id} key={`b${refreshKey}`} />}
            {tab === "Expenses" && (
              <Expenses group={group} onChange={bump} key={`e${refreshKey}`} />
            )}
            {tab === "Members" && (
              <Members group={group} onChange={() => { loadGroups(); bump(); }} key={`m${refreshKey}`} />
            )}
            {tab === "Import CSV" && (
              <ImportWizard group={group} onCommitted={() => { bump(); setTab("Balances"); }} />
            )}
            {tab === "Ask AI" && <Ask groupId={group.id} key={`a${refreshKey}`} />}
          </>
        )}
      </div>
    </>
  );
}
