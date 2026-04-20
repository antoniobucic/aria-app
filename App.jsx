import { useState, useRef, useEffect, useCallback } from "react";

// 🔑 WICHTIG: Ersetze diesen Wert mit deinem echten Anthropic API Key
// Hole dir einen Key auf: https://console.anthropic.com
const API_KEY = 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;

const SYSTEM_PROMPT = `Du bist ARIA – ein intelligenter Terminassistent. Du hilfst dem Nutzer dabei, Termine zu verwalten, zu kategorisieren und nach Wichtigkeit einzustufen.

Aktuelle Termine werden dir als JSON übergeben.

Antworte IMMER mit einem validen JSON-Objekt (kein Markdown, keine Backticks) in folgendem Format:
{
  "message": "Deine freundliche Antwort an den Nutzer (auf Deutsch)",
  "action": {
    "type": "add" | "delete" | "update" | "none",
    "appointment": {
      "id": "eindeutige ID (nur bei update/delete benötigt)",
      "title": "Titel des Termins",
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "category": "Arbeit" | "Persönlich" | "Gesundheit" | "Finanzen" | "Reise" | "Sonstiges",
      "priority": "Hoch" | "Mittel" | "Niedrig",
      "notes": "optionale Notizen",
      "reminderMinutes": 30
    }
  }
}

Wenn keine Aktion nötig ist, setze action.type auf "none" und appointment auf null.
Heutiges Datum: ${new Date().toLocaleDateString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
Aktuelles Datum ISO: ${new Date().toISOString().split("T")[0]}`;

const PRIORITY_CONFIG = {
  Hoch: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "🔴 Hoch" },
  Mittel: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "🟡 Mittel" },
  Niedrig: { color: "#22c55e", bg: "rgba(34,197,94,0.12)", label: "🟢 Niedrig" },
};
const CATEGORY_ICONS = { Arbeit: "💼", Persönlich: "🏠", Gesundheit: "❤️", Finanzen: "💰", Reise: "✈️", Sonstiges: "📌" };
const CATEGORIES = ["Arbeit", "Persönlich", "Gesundheit", "Finanzen", "Reise", "Sonstiges"];
const PRIORITIES = ["Hoch", "Mittel", "Niedrig"];
const REMINDER_OPTIONS = [5, 10, 15, 30, 60, 120, 1440];

const labelStyle = { display: "block", fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: "0.5px", marginBottom: 6, textTransform: "uppercase" };
const inputStyle = { width: "100%", background: "#0d0d18", border: "1px solid #2a2a3e", borderRadius: 10, padding: "9px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit" };

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function getDaysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.round((target - today) / 86400000);
  if (diff < 0) return { label: `vor ${Math.abs(diff)}d`, urgent: false, past: true };
  if (diff === 0) return { label: "Heute", urgent: true, past: false };
  if (diff === 1) return { label: "Morgen", urgent: true, past: false };
  return { label: `in ${diff}d`, urgent: diff <= 3, past: false };
}

function reminderLabel(min) {
  if (min < 60) return `${min} Min vorher`;
  if (min === 60) return "1 Std vorher";
  if (min < 1440) return `${min / 60} Std vorher`;
  return "1 Tag vorher";
}

// Termine im localStorage speichern (auf dem echten Gerät persistent!)
function loadAppointments() {
  try {
    const saved = localStorage.getItem("aria-appointments");
    return saved ? JSON.parse(saved) : [
      { id: "1", title: "Teammeeting Q2", date: new Date(Date.now() + 86400000).toISOString().split("T")[0], time: "10:00", category: "Arbeit", priority: "Hoch", notes: "Quartalsbericht vorstellen", reminderMinutes: 30 },
      { id: "2", title: "Zahnarzt Kontrolle", date: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0], time: "14:30", category: "Gesundheit", priority: "Mittel", notes: "", reminderMinutes: 60 },
    ];
  } catch { return []; }
}

function Modal({ onClose, onSave, editData }) {
  const [form, setForm] = useState(editData || { title: "", date: "", time: "", category: "Arbeit", priority: "Mittel", notes: "", reminderMinutes: 30 });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#13131f", border: "1px solid #2a2a3e", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 25px 60px rgba(0,0,0,0.5)", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 600 }}>
            {editData ? "✏️ Termin bearbeiten" : "➕ Neuer Termin"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Titel *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="z.B. Zahnarzttermin" style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelStyle}>Datum *</label>
              <input type="date" value={form.date} onChange={e => set("date", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Uhrzeit</label>
              <input type="time" value={form.time} onChange={e => set("time", e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Erinnerung</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {REMINDER_OPTIONS.map(m => (
                <button key={m} onClick={() => set("reminderMinutes", m)} style={{
                  padding: "5px 10px", borderRadius: 20, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit",
                  background: form.reminderMinutes === m ? "rgba(99,102,241,0.25)" : "#1a1a2e",
                  border: `1px solid ${form.reminderMinutes === m ? "#6366f1" : "#2a2a3e"}`,
                  color: form.reminderMinutes === m ? "#818cf8" : "#64748b",
                }}>🔔 {reminderLabel(m)}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Kategorie</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => set("category", c)} style={{
                  padding: "5px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                  background: form.category === c ? "rgba(99,102,241,0.25)" : "#1a1a2e",
                  border: `1px solid ${form.category === c ? "#6366f1" : "#2a2a3e"}`,
                  color: form.category === c ? "#818cf8" : "#64748b",
                }}>{CATEGORY_ICONS[c]} {c}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Priorität</label>
            <div style={{ display: "flex", gap: 6 }}>
              {PRIORITIES.map(p => {
                const cfg = PRIORITY_CONFIG[p];
                return (
                  <button key={p} onClick={() => set("priority", p)} style={{
                    flex: 1, padding: "7px 0", borderRadius: 10, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    background: form.priority === p ? cfg.bg : "#1a1a2e",
                    border: `1px solid ${form.priority === p ? cfg.color : "#2a2a3e"}`,
                    color: form.priority === p ? cfg.color : "#64748b",
                    fontWeight: form.priority === p ? 600 : 400,
                  }}>{cfg.label}</button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Notizen</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Optionale Anmerkungen..." rows={2} style={{ ...inputStyle, resize: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 10, background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 10, color: "#94a3b8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Abbrechen</button>
            <button onClick={() => form.title && form.date && onSave(form)} style={{
              flex: 2, padding: 10, background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              border: "none", borderRadius: 10, color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: form.title && form.date ? "pointer" : "not-allowed",
              opacity: form.title && form.date ? 1 : 0.5, fontFamily: "inherit",
            }}>{editData ? "Speichern" : "Termin hinzufügen"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [appointments, setAppointments] = useState(loadAppointments);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hallo! Ich bin ARIA, dein persönlicher Terminassistent. 📅\n\nTippe auf 🔔 Aktivieren oben rechts, damit ich dich rechtzeitig erinnern kann!" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [showModal, setShowModal] = useState(false);
  const [editAppt, setEditAppt] = useState(null);
  const [notifStatus, setNotifStatus] = useState("default");
  const [notifiedIds, setNotifiedIds] = useState(new Set());
  const messagesEndRef = useRef(null);

  // Persist appointments
  useEffect(() => {
    localStorage.setItem("aria-appointments", JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if ("Notification" in window) setNotifStatus(Notification.permission);
  }, []);

  const checkReminders = useCallback(() => {
    if (notifStatus !== "granted") return;
    const now = new Date();
    appointments.forEach(appt => {
      if (!appt.time || !appt.date) return;
      const apptTime = new Date(`${appt.date}T${appt.time}:00`);
      const reminderMs = (appt.reminderMinutes || 30) * 60 * 1000;
      const triggerAt = new Date(apptTime.getTime() - reminderMs);
      const diffMs = triggerAt - now;
      const notifKey = `${appt.id}-${appt.reminderMinutes}`;
      if (diffMs >= 0 && diffMs <= 30000 && !notifiedIds.has(notifKey)) {
        setNotifiedIds(prev => new Set([...prev, notifKey]));
        new Notification(`${CATEGORY_ICONS[appt.category] || "📌"} ${appt.title}`, {
          body: `${reminderLabel(appt.reminderMinutes)} · ${appt.time} Uhr · ${PRIORITY_CONFIG[appt.priority]?.label || ""}${appt.notes ? "\n" + appt.notes : ""}`,
        });
      }
    });
  }, [appointments, notifStatus, notifiedIds]);

  useEffect(() => {
    const interval = setInterval(checkReminders, 30000);
    return () => clearInterval(interval);
  }, [checkReminders]);

  async function requestNotifications() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
    if (perm === "granted") {
      new Notification("🗓 ARIA aktiviert!", { body: "Du erhältst ab jetzt Erinnerungen für deine Termine." });
      setMessages(prev => [...prev, { role: "assistant", text: "✅ Benachrichtigungen aktiviert! Ich erinnere dich rechtzeitig vor deinen Terminen." }]);
    }
  }

  function handleSave(form) {
    if (editAppt) {
      setAppointments(prev => prev.map(a => a.id === editAppt.id ? { ...form, id: editAppt.id } : a));
    } else {
      setAppointments(prev => [...prev, { ...form, id: Date.now().toString() }]);
    }
    setShowModal(false);
    setEditAppt(null);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: `Aktuelle Termine:\n${JSON.stringify(appointments, null, 2)}\n\nNutzernachricht: ${userMsg}` }]
        })
      });
      const data = await response.json();
      const rawText = data.content?.[0]?.text || "{}";
      let parsed;
      try { parsed = JSON.parse(rawText.replace(/```json|```/g, "").trim()); }
      catch { parsed = { message: rawText, action: { type: "none" } }; }

      if (parsed.action?.type === "add" && parsed.action.appointment) {
        setAppointments(prev => [...prev, { ...parsed.action.appointment, reminderMinutes: parsed.action.appointment.reminderMinutes || 30, id: Date.now().toString() }]);
      } else if (parsed.action?.type === "delete" && parsed.action.appointment?.id) {
        setAppointments(prev => prev.filter(a => a.id !== parsed.action.appointment.id));
      } else if (parsed.action?.type === "update" && parsed.action.appointment?.id) {
        setAppointments(prev => prev.map(a => a.id === parsed.action.appointment.id ? { ...a, ...parsed.action.appointment } : a));
      }
      setMessages(prev => [...prev, { role: "assistant", text: parsed.message }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "Entschuldigung, da ist etwas schiefgelaufen. Prüfe deinen API Key in der App." }]);
    }
    setLoading(false);
  }

  const sortedAppointments = [...appointments]
    .filter(a => !getDaysUntil(a.date).past)
    .sort((a, b) => {
      const pd = { Hoch: 0, Mittel: 1, Niedrig: 2 };
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return pd[a.priority] - pd[b.priority];
    });

  const pastAppointments = appointments.filter(a => getDaysUntil(a.date).past);
  const todayCount = appointments.filter(a => getDaysUntil(a.date).label === "Heute").length;
  const highCount = appointments.filter(a => a.priority === "Hoch" && !getDaysUntil(a.date).past).length;

  const notifCfg = {
    default: { bg: "rgba(99,102,241,0.15)", border: "rgba(99,102,241,0.4)", color: "#818cf8", label: "🔔 Aktivieren" },
    granted: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)", color: "#4ade80", label: "🔔 Aktiv" },
    denied:  { bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.3)", color: "#f87171", label: "🔕 Blockiert" },
  }[notifStatus] || {};

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif", background: "#0a0a0f", height: "100dvh", color: "#e2e8f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=Playfair+Display:wght@600&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 2px; }
        textarea, input, button { font-family: inherit; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.4); cursor: pointer; }
        .appt-card { transition: transform 0.2s ease; }
        .appt-card:active { transform: scale(0.98); }
        .action-btn { opacity: 0; transition: opacity 0.2s; cursor: pointer; background: none; border: none; }
        .appt-card:hover .action-btn { opacity: 1; }
        .msg-bubble { animation: fadeUp 0.3s ease; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* Header */}
      <div style={{ padding: "env(safe-area-inset-top, 12px) 20px 0", background: "#0a0a0f", borderBottom: "1px solid #1a1a2e", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🗓</div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>ARIA</div>
              <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 500, letterSpacing: "0.5px" }}>TERMINASSISTENT</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {todayCount > 0 && <div style={{ padding: "3px 8px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, fontSize: 10, color: "#818cf8" }}>{todayCount} heute</div>}
            {highCount > 0 && <div style={{ padding: "3px 8px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 20, fontSize: 10, color: "#f87171" }}>{highCount} dringend</div>}
            <button onClick={notifStatus === "granted" ? undefined : requestNotifications} style={{ padding: "3px 9px", background: notifCfg.bg, border: `1px solid ${notifCfg.border}`, borderRadius: 20, fontSize: 10, color: notifCfg.color, cursor: notifStatus === "denied" ? "not-allowed" : "pointer", fontWeight: 600 }}>
              {notifCfg.label}
            </button>
          </div>
        </div>
        <div style={{ display: "flex" }}>
          {["chat", "termine"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "10px 0", background: "none", border: "none",
              borderBottom: `2px solid ${activeTab === tab ? "#6366f1" : "transparent"}`,
              color: activeTab === tab ? "#818cf8" : "#64748b",
              fontSize: 13, fontWeight: activeTab === tab ? 600 : 400, cursor: "pointer",
            }}>
              {tab === "chat" ? "💬 Chat" : `📋 Termine (${sortedAppointments.length})`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "chat" && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
              {messages.map((msg, i) => (
                <div key={i} className="msg-bubble" style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
                  {msg.role === "assistant" && (
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, marginRight: 8, flexShrink: 0, marginTop: 2 }}>🤖</div>
                  )}
                  <div style={{
                    maxWidth: "82%", padding: "10px 13px",
                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    background: msg.role === "user" ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "#13131f",
                    border: msg.role === "assistant" ? "1px solid #1e1e30" : "none",
                    fontSize: 14, lineHeight: 1.6, color: msg.role === "user" ? "#fff" : "#cbd5e1", whiteSpace: "pre-wrap",
                  }}>{msg.text}</div>
                </div>
              ))}
              {loading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🤖</div>
                  <div style={{ padding: "12px 16px", background: "#13131f", border: "1px solid #1e1e30", borderRadius: "14px 14px 14px 4px" }}>
                    <div style={{ display: "flex", gap: 5 }}>
                      {[0,1,2].map(i => <div key={i} className="pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", animationDelay: `${i * 0.2}s` }} />)}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ padding: "0 16px 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["Überblick zeigen", "Was ist heute?", "Diese Woche?"].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{ padding: "5px 10px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 20, fontSize: 12, color: "#818cf8", cursor: "pointer" }}>{s}</button>
              ))}
            </div>
            <div style={{ padding: "10px 16px", paddingBottom: "max(16px, env(safe-area-inset-bottom))", borderTop: "1px solid #1a1a2e" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "#13131f", border: "1px solid #1e1e30", borderRadius: 14, padding: "10px 12px" }}>
                <textarea value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Termin hinzufügen oder Frage stellen..." rows={1}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e2e8f0", fontSize: 14, lineHeight: 1.5, maxHeight: 100, overflowY: "auto", resize: "none" }} />
                <button onClick={sendMessage} disabled={!input.trim() || loading} style={{
                  width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  border: "none", color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: input.trim() && !loading ? "pointer" : "not-allowed", opacity: input.trim() && !loading ? 1 : 0.4, flexShrink: 0,
                }}>→</button>
              </div>
            </div>
          </>
        )}

        {activeTab === "termine" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 16, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
            <button onClick={() => { setEditAppt(null); setShowModal(true); }} style={{
              width: "100%", padding: 13, marginBottom: 16,
              background: "rgba(99,102,241,0.08)", border: "2px dashed rgba(99,102,241,0.3)",
              borderRadius: 12, color: "#818cf8", fontSize: 14, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>➕ Termin manuell hinzufügen</button>

            {sortedAppointments.length === 0 && (
              <div style={{ textAlign: "center", padding: "30px 20px", color: "#475569" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                <div>Keine anstehenden Termine</div>
              </div>
            )}

            {sortedAppointments.map(appt => {
              const daysInfo = getDaysUntil(appt.date);
              const prio = PRIORITY_CONFIG[appt.priority] || PRIORITY_CONFIG.Mittel;
              return (
                <div key={appt.id} className="appt-card" style={{
                  background: "#13131f", border: "1px solid #1e1e30",
                  borderLeft: `3px solid ${prio.color}`,
                  borderRadius: 12, padding: "14px 16px", marginBottom: 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 15 }}>{CATEGORY_ICONS[appt.category] || "📌"}</span>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "#f1f5f9" }}>{appt.title}</span>
                        {daysInfo.urgent && <span style={{ fontSize: 10, padding: "2px 7px", background: "rgba(239,68,68,0.15)", color: "#f87171", borderRadius: 10, fontWeight: 600 }}>!</span>}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>🗓 {formatDate(appt.date)}</span>
                        {appt.time && <span style={{ fontSize: 12, color: "#94a3b8" }}>🕐 {appt.time}</span>}
                        <span style={{ fontSize: 11, padding: "2px 8px", background: prio.bg, color: prio.color, borderRadius: 10, fontWeight: 500 }}>{prio.label}</span>
                        {appt.reminderMinutes && <span style={{ fontSize: 11, color: notifStatus === "granted" ? "#4ade80" : "#475569" }}>🔔 {reminderLabel(appt.reminderMinutes)}</span>}
                      </div>
                      {appt.notes && <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, fontStyle: "italic" }}>{appt.notes}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginLeft: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: daysInfo.urgent ? "#f87171" : "#64748b", whiteSpace: "nowrap" }}>{daysInfo.label}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="action-btn" onClick={() => { setEditAppt(appt); setShowModal(true); }} style={{ color: "#818cf8", fontSize: 16, padding: "2px 4px" }}>✏️</button>
                        <button className="action-btn" onClick={() => setAppointments(prev => prev.filter(a => a.id !== appt.id))} style={{ color: "#ef4444", fontSize: 16, padding: "2px 4px" }}>✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {pastAppointments.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, color: "#475569", fontWeight: 600, letterSpacing: "0.8px", marginBottom: 10 }}>VERGANGENE TERMINE</div>
                {pastAppointments.map(appt => (
                  <div key={appt.id} style={{ background: "#0d0d18", border: "1px solid #1a1a2e", borderRadius: 10, padding: "10px 14px", marginBottom: 8, opacity: 0.5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "#64748b" }}>{CATEGORY_ICONS[appt.category]} {appt.title}</span>
                      <span style={{ fontSize: 11, color: "#475569" }}>{formatDate(appt.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          editData={editAppt}
          onClose={() => { setShowModal(false); setEditAppt(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
