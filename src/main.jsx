import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  CreditCard,
  Edit,
  FileText,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users
} from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";
const emptyPlan = {
  name: "",
  amount: 0,
  fortune_incense_deduct_qty: 0,
  jade_incense_deduct_qty: 0,
  gold_ingot_incense_deduct_qty: 0,
  cycle_count: 1,
  session_count: 1,
  is_active: true
};

function apiClient(token, onUnauthorized) {
  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
    if (response.status === 401 && onUnauthorized) onUnauthorized();
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  }
  return {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
    put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
    delete: (path) => request(path, { method: "DELETE" })
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("admin_token") || "");
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [message, setMessage] = useState("");
  const api = useMemo(() => apiClient(token, () => logout()), [token]);

  function logout() {
    localStorage.removeItem("admin_token");
    setToken("");
    setAdmin(null);
  }

  function flash(text) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2200);
  }

  useEffect(() => {
    if (!token) return;
    api.get("/auth/me").then(setAdmin).catch(logout);
  }, [token]);

  if (!token) {
    return <Login onLogin={(value) => {
      localStorage.setItem("admin_token", value.token);
      setToken(value.token);
      setAdmin(value.admin);
    }} />;
  }

  const tabs = [
    ["dashboard", CalendarDays, "每日報表"],
    ["members", Users, "會員"],
    ["plans", Package, "方案"],
    ["registrations", FileText, "報名"],
    ["remittances", CreditCard, "匯款"]
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">後台管理 MVP</div>
        <nav>
          {tabs.map(([key, Icon, label]) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="logout" onClick={async () => {
          try { await api.post("/auth/logout", {}); } catch {}
          logout();
        }}>
          <LogOut size={18} />
          <span>登出</span>
        </button>
      </aside>
      <main>
        <header>
          <div>
            <h1>{tabs.find(([key]) => key === tab)?.[2]}</h1>
            <p>{admin?.username || "admin"}</p>
          </div>
          {message && <div className="toast">{message}</div>}
        </header>
        {tab === "dashboard" && <Dashboard api={api} />}
        {tab === "members" && <Members api={api} flash={flash} />}
        {tab === "plans" && <Plans api={api} flash={flash} />}
        {tab === "registrations" && <Registrations api={api} flash={flash} />}
        {tab === "remittances" && <Remittances api={api} flash={flash} />}
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: "admin", password: "" });
  const [error, setError] = useState("");
  const api = apiClient("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      onLogin(await api.post("/auth/login", form));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-page">
      <form className="login-panel" onSubmit={submit}>
        <h1>後台管理系統</h1>
        <label>帳號<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <label>密碼<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="error">{error}</p>}
        <button className="primary">登入</button>
      </form>
    </div>
  );
}

function Dashboard({ api }) {
  const [date, setDate] = useState(today());
  const [report, setReport] = useState({ items: [] });

  async function load() {
    setReport(await api.get(`/reports/daily-participations?date=${date}`));
  }

  useEffect(() => { load(); }, []);

  return (
    <section>
      <Toolbar>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <button onClick={load}><RefreshCw size={16} />刷新</button>
      </Toolbar>
      <Table headers={["會員", "方案", "方式", "應收", "已收", "差額", "狀態", "香品庫存"]}>
        {report.items.map((item) => (
          <tr key={item.registrationId}>
            <td>{item.memberName}</td>
            <td>{item.planName}</td>
            <td>{paymentMethodText(item.paymentMethod)}</td>
            <td>{item.expectedAmount}</td>
            <td>{item.paidAmount}</td>
            <td className={item.balance === 0 ? "ok" : "warn"}>{item.balance}</td>
            <td><span className={`status ${item.paymentLight}`}>{item.paymentStatusText}</span></td>
            <td>{stockText(item.incenseStock)}</td>
          </tr>
        ))}
      </Table>
    </section>
  );
}

function Members({ api, flash }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", bank_last5: "", note: "" });

  async function load() {
    setItems(await api.get(`/members${includeInactive ? "?include_inactive=true" : ""}`));
  }
  useEffect(() => { load(); }, [includeInactive]);

  async function submit(event) {
    event.preventDefault();
    if (editing) {
      await api.put(`/members/${editing.id}`, {
        name: form.name,
        note: form.note,
        is_active: editing.isActive
      });
      flash("會員已更新");
    } else {
      const member = await api.post("/members", { name: form.name, note: form.note });
      if (form.bank_last5) {
        await api.post(`/members/${member.id}/bank-accounts`, { bank_last5: form.bank_last5 });
      }
      flash("會員已新增");
    }
    clearForm();
    load();
  }

  function edit(item) {
    setEditing(item);
    setForm({
      name: item.name,
      bank_last5: item.bankAccounts?.[0]?.bankLast5 || "",
      note: item.note || ""
    });
  }

  function clearForm() {
    setEditing(null);
    setForm({ name: "", bank_last5: "", note: "" });
  }

  async function deactivate(item) {
    if (!confirm(`確定停用會員「${item.name}」？`)) return;
    await api.delete(`/members/${item.id}`);
    flash("會員已停用");
    load();
  }

  async function adjust(memberId, type) {
    const delta = Number(prompt(`${type.label} 調整數量`, "0") || "0");
    if (!delta) return;
    await api.post(`/members/${memberId}/incense-stock/adjust`, { [type.key]: delta, note: "前端手動調整" });
    flash("香品庫存已調整");
    load();
  }

  const filtered = items.filter((item) => {
    const text = `${item.name} ${item.note || ""} ${item.bankAccounts?.map((account) => account.bankLast5).join(" ") || ""}`;
    return text.includes(query);
  });

  return (
    <section>
      <Toolbar>
        <div className="search-box"><Search size={16} /><input placeholder="查詢姓名、後五碼、備註" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <label className="check"><input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />顯示停用</label>
        <button onClick={load}><RefreshCw size={16} />刷新</button>
      </Toolbar>
      <FormGrid onSubmit={submit}>
        <input placeholder="會員姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="匯款帳號後五碼" maxLength="5" value={form.bank_last5} onChange={(e) => setForm({ ...form, bank_last5: e.target.value })} disabled={Boolean(editing)} />
        <input placeholder="備註" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="primary"><Plus size={16} />{editing ? "更新會員" : "新增會員"}</button>
        {editing && <button type="button" onClick={clearForm}>取消編輯</button>}
      </FormGrid>
      <Table headers={["姓名", "帳號後五碼", "香品庫存", "狀態", "操作"]}>
        {filtered.map((item) => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td>{item.bankAccounts?.map((account) => account.bankLast5).join(", ")}</td>
            <td>{stockText(item.incenseStock)}</td>
            <td>{item.isActive ? "啟用" : "停用"}</td>
            <td className="actions">
              <button onClick={() => edit(item)}><Edit size={15} />修改</button>
              {INCENSE_TYPES.map((type) => <button key={type.key} onClick={() => adjust(item.id, type)}>{type.label}</button>)}
              {item.isActive && <button className="danger" onClick={() => deactivate(item)}><Trash2 size={15} />停用</button>}
            </td>
          </tr>
        ))}
      </Table>
    </section>
  );
}

function Plans({ api, flash }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPlan);

  async function load() {
    setItems(await api.get(`/plans${includeInactive ? "?include_inactive=true" : ""}`));
  }
  useEffect(() => { load(); }, [includeInactive]);

  async function submit(event) {
    event.preventDefault();
    if (editing) {
      await api.put(`/plans/${editing.id}`, form);
      flash("方案已更新");
    } else {
      await api.post("/plans", form);
      flash("方案已新增");
    }
    clearForm();
    load();
  }

  function edit(item) {
    setEditing(item);
    setForm({
      name: item.name,
      amount: item.amount,
      fortune_incense_deduct_qty: item.fortuneIncenseDeductQty,
      jade_incense_deduct_qty: item.jadeIncenseDeductQty,
      gold_ingot_incense_deduct_qty: item.goldIngotIncenseDeductQty,
      cycle_count: item.cycleCount,
      session_count: item.sessionCount,
      is_active: item.isActive
    });
  }

  function clearForm() {
    setEditing(null);
    setForm(emptyPlan);
  }

  async function deactivate(item) {
    if (!confirm(`確定停用方案「${item.name}」？`)) return;
    await api.delete(`/plans/${item.id}`);
    flash("方案已停用");
    load();
  }

  const filtered = items.filter((item) => item.name.includes(query));

  return (
    <section>
      <Toolbar>
        <div className="search-box"><Search size={16} /><input placeholder="查詢方案名稱" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <label className="check"><input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />顯示停用</label>
        <button onClick={load}><RefreshCw size={16} />刷新</button>
      </Toolbar>
      <FormGrid onSubmit={submit}>
        <LabeledField label="方案名稱">
          <input placeholder="輸入方案名稱" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </LabeledField>
        <NumberInput label="金額" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} />
        <NumberInput label="財香扣抵" value={form.fortune_incense_deduct_qty} onChange={(v) => setForm({ ...form, fortune_incense_deduct_qty: v })} />
        <NumberInput label="碧玉香扣抵" value={form.jade_incense_deduct_qty} onChange={(v) => setForm({ ...form, jade_incense_deduct_qty: v })} />
        <NumberInput label="元寶香扣抵" value={form.gold_ingot_incense_deduct_qty} onChange={(v) => setForm({ ...form, gold_ingot_incense_deduct_qty: v })} />
        <NumberInput label="期數" value={form.cycle_count} onChange={(v) => setForm({ ...form, cycle_count: v })} />
        <NumberInput label="場次" value={form.session_count} onChange={(v) => setForm({ ...form, session_count: v })} />
        <button className="primary"><Plus size={16} />{editing ? "更新方案" : "新增方案"}</button>
        {editing && <button type="button" onClick={clearForm}>取消編輯</button>}
      </FormGrid>
      <Table headers={["方案", "金額", "扣抵(財香/碧玉香/元寶香)", "期數", "場次", "狀態", "操作"]}>
        {filtered.map((item) => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td>{item.amount}</td>
            <td>{item.fortuneIncenseDeductQty}/{item.jadeIncenseDeductQty}/{item.goldIngotIncenseDeductQty}</td>
            <td>{item.cycleCount}</td>
            <td>{item.sessionCount}</td>
            <td>{item.isActive ? "啟用" : "停用"}</td>
            <td className="actions">
              <button onClick={() => edit(item)}><Edit size={15} />修改</button>
              {item.isActive && <button className="danger" onClick={() => deactivate(item)}><Trash2 size={15} />停用</button>}
            </td>
          </tr>
        ))}
      </Table>
    </section>
  );
}

function Registrations({ api, flash }) {
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ query: "", date: "", status: "" });
  const [form, setForm] = useState({ member_id: "", plan_id: "", participation_date: today(), payment_method: "remittance", status: "registered" });

  async function load() {
    const path = filters.date ? `/registrations?date=${filters.date}` : "/registrations";
    const [nextMembers, nextPlans, nextItems] = await Promise.all([
      api.get("/members"),
      api.get("/plans"),
      api.get(path)
    ]);
    setMembers(nextMembers);
    setPlans(nextPlans);
    setItems(nextItems);
  }
  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    if (editing) {
      await api.put(`/registrations/${editing.id}`, {
        plan_id: form.plan_id,
        participation_date: form.participation_date,
        payment_method: form.payment_method,
        status: form.status
      });
      flash("報名已更新");
    } else {
      await api.post("/registrations", form);
      flash("報名已新增");
    }
    clearForm();
    load();
  }

  function edit(item) {
    setEditing(item);
    setForm({
      member_id: item.memberId,
      plan_id: item.planId,
      participation_date: String(item.participationDate).slice(0, 10),
      payment_method: item.paymentMethod,
      status: item.status
    });
  }

  function clearForm() {
    setEditing(null);
    setForm({ member_id: "", plan_id: "", participation_date: today(), payment_method: "remittance", status: "registered" });
  }

  async function cancel(item) {
    if (!confirm(`確定取消 ${item.member?.name} 的報名？`)) return;
    await api.delete(`/registrations/${item.id}`);
    flash("報名已取消");
    load();
  }

  const filtered = items.filter((item) => {
    const keyword = `${item.member?.name || ""} ${item.plan?.name || ""}`;
    return (!filters.query || keyword.includes(filters.query)) && (!filters.status || item.status === filters.status);
  });

  return (
    <section>
      <Toolbar>
        <div className="search-box"><Search size={16} /><input placeholder="查詢會員或方案" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} /></div>
        <input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">全部狀態</option>
          <option value="registered">已報名</option>
          <option value="cancelled">已取消</option>
          <option value="completed">已完成</option>
        </select>
        <button onClick={load}><RefreshCw size={16} />查詢</button>
      </Toolbar>
      <FormGrid onSubmit={submit}>
        <Select value={form.member_id} onChange={(member_id) => setForm({ ...form, member_id })} options={members.map((m) => [m.id, m.name])} placeholder="選擇會員" disabled={Boolean(editing)} />
        <Select value={form.plan_id} onChange={(plan_id) => setForm({ ...form, plan_id })} options={plans.map((p) => [p.id, `${p.name} / ${p.amount}`])} placeholder="選擇方案" />
        <input type="date" value={form.participation_date} onChange={(e) => setForm({ ...form, participation_date: e.target.value })} />
        <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
          <option value="remittance">匯款</option>
          <option value="incense_deduct">香品扣抵</option>
        </select>
        {editing && (
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="registered">已報名</option>
            <option value="cancelled">已取消</option>
            <option value="completed">已完成</option>
          </select>
        )}
        <button className="primary"><Plus size={16} />{editing ? "更新報名" : "新增報名"}</button>
        {editing && <button type="button" onClick={clearForm}>取消編輯</button>}
      </FormGrid>
      <Table headers={["日期", "會員", "方案", "方式", "應收", "狀態", "操作"]}>
        {filtered.map((item) => (
          <tr key={item.id}>
            <td>{String(item.participationDate).slice(0, 10)}</td>
            <td>{item.member?.name}</td>
            <td>{item.plan?.name}</td>
            <td>{paymentMethodText(item.paymentMethod)}</td>
            <td>{item.expectedAmount}</td>
            <td>{statusText(item.status)}</td>
            <td className="actions">
              <button onClick={() => edit(item)}><Edit size={15} />修改</button>
              {item.status !== "cancelled" && <button className="danger" onClick={() => cancel(item)}><Trash2 size={15} />取消</button>}
            </td>
          </tr>
        ))}
      </Table>
    </section>
  );
}

function Remittances({ api, flash }) {
  const [items, setItems] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ query: "", date: "", match: "" });
  const [form, setForm] = useState({ remittance_last5: "", remittance_date: today(), participation_date: today(), amount: 0, note: "" });

  async function load() {
    const [nextItems, nextRegistrations] = await Promise.all([
      api.get("/remittances"),
      api.get("/registrations")
    ]);
    setItems(nextItems);
    setRegistrations(nextRegistrations.filter((item) => item.paymentMethod === "remittance" && item.status === "registered"));
  }
  useEffect(() => { load(); }, []);

  async function submit(event) {
    event.preventDefault();
    if (editing) {
      await api.put(`/remittances/${editing.id}`, form);
      flash("匯款已更新");
    } else {
      await api.post("/remittances", form);
      flash("匯款已新增");
    }
    clearForm();
    load();
  }

  function edit(item) {
    setEditing(item);
    setForm({
      remittance_last5: item.remittanceLast5,
      remittance_date: String(item.remittanceDate).slice(0, 10),
      participation_date: String(item.participationDate).slice(0, 10),
      amount: item.amount,
      note: item.note || ""
    });
  }

  function clearForm() {
    setEditing(null);
    setForm({ remittance_last5: "", remittance_date: today(), participation_date: today(), amount: 0, note: "" });
  }

  async function remove(item) {
    if (!confirm(`確定刪除匯款 ${item.remittanceLast5} / ${item.amount}？`)) return;
    await api.delete(`/remittances/${item.id}`);
    flash("匯款已刪除");
    load();
  }

  async function allocate(remittance) {
    const options = registrations
      .filter((item) => item.memberId === remittance.matchedMemberId)
      .map((item) => `${item.id}: ${item.member?.name} ${item.plan?.name} ${String(item.participationDate).slice(0, 10)}`)
      .join("\n");
    const registrationId = prompt(`輸入要分配的報名 ID\n${options || "沒有可分配的同會員報名"}`);
    if (!registrationId) return;
    const applied = remittance.payments?.reduce((sum, payment) => sum + payment.appliedAmount, 0) || 0;
    const amount = Number(prompt("分配金額", remittance.amount - applied) || "0");
    if (!amount) return;
    await api.post("/registration-payments", {
      remittance_record_id: remittance.id,
      allocations: [{ registration_id: registrationId, applied_amount: amount }]
    });
    flash("匯款已分配");
    load();
  }

  const filtered = items.filter((item) => {
    const date = String(item.participationDate).slice(0, 10);
    const text = `${item.remittanceLast5} ${item.matchedMember?.name || ""} ${item.note || ""}`;
    return (!filters.query || text.includes(filters.query)) &&
      (!filters.date || date === filters.date) &&
      (!filters.match || item.matchStatus === filters.match);
  });

  return (
    <section>
      <Toolbar>
        <div className="search-box"><Search size={16} /><input placeholder="查詢後五碼、會員、備註" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} /></div>
        <input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        <select value={filters.match} onChange={(e) => setFilters({ ...filters, match: e.target.value })}>
          <option value="">全部比對</option>
          <option value="matched">已比對</option>
          <option value="unmatched">未比對</option>
          <option value="multiple_matches">多筆符合</option>
        </select>
        <button onClick={load}><RefreshCw size={16} />刷新</button>
      </Toolbar>
      <FormGrid onSubmit={submit}>
        <input placeholder="匯款後五碼" maxLength="5" value={form.remittance_last5} onChange={(e) => setForm({ ...form, remittance_last5: e.target.value })} required />
        <input type="date" value={form.remittance_date} onChange={(e) => setForm({ ...form, remittance_date: e.target.value })} />
        <input type="date" value={form.participation_date} onChange={(e) => setForm({ ...form, participation_date: e.target.value })} />
        <NumberInput label="匯款金額" value={form.amount} onChange={(amount) => setForm({ ...form, amount })} />
        <input placeholder="備註" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="primary"><Plus size={16} />{editing ? "更新匯款" : "新增匯款"}</button>
        {editing && <button type="button" onClick={clearForm}>取消編輯</button>}
      </FormGrid>
      <Table headers={["後五碼", "參加日", "金額", "比對", "會員", "已分配", "操作"]}>
        {filtered.map((item) => {
          const applied = item.payments?.reduce((sum, payment) => sum + payment.appliedAmount, 0) || 0;
          return (
            <tr key={item.id}>
              <td>{item.remittanceLast5}</td>
              <td>{String(item.participationDate).slice(0, 10)}</td>
              <td>{item.amount}</td>
              <td>{matchText(item.matchStatus)}</td>
              <td>{item.matchedMember?.name || "-"}</td>
              <td>{applied}</td>
              <td className="actions">
                <button onClick={() => allocate(item)}>分配</button>
                <button onClick={() => edit(item)}><Edit size={15} />修改</button>
                <button className="danger" onClick={() => remove(item)}><Trash2 size={15} />刪除</button>
              </td>
            </tr>
          );
        })}
      </Table>
    </section>
  );
}

function Toolbar({ children }) {
  return <div className="toolbar">{children}</div>;
}

function FormGrid({ children, onSubmit }) {
  return <form className="form-grid" onSubmit={onSubmit}>{children}</form>;
}

function Table({ headers, children }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function NumberInput({ label, value, onChange }) {
  return (
    <LabeledField label={label}>
      <input type="number" placeholder={label} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </LabeledField>
  );
}

function LabeledField({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options, placeholder, disabled }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} required disabled={disabled}>
      <option value="">{placeholder}</option>
      {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select>
  );
}

function stockText(stock) {
  if (!stock) return "財香 0 / 碧玉香 0 / 元寶香 0";
  return `財香 ${stock.fortuneIncenseQty} / 碧玉香 ${stock.jadeIncenseQty} / 元寶香 ${stock.goldIngotIncenseQty}`;
}

function paymentMethodText(value) {
  return value === "remittance" ? "匯款" : "香品扣抵";
}

function statusText(value) {
  return { registered: "已報名", cancelled: "已取消", completed: "已完成" }[value] || value;
}

function matchText(value) {
  return { matched: "已比對", unmatched: "未比對", multiple_matches: "多筆符合" }[value] || value;
}

const INCENSE_TYPES = [
  { label: "財香", key: "fortune_incense_delta" },
  { label: "碧玉香", key: "jade_incense_delta" },
  { label: "元寶香", key: "gold_ingot_incense_delta" }
];

createRoot(document.getElementById("root")).render(<App />);
