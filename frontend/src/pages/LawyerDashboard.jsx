import { useState, useEffect, useRef } from "react"

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return null
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/).filter(Boolean)
  return blocks.map((block, bi) => {
    const t = block.trim()
    if (/^\d+\.\s/.test(t)) {
      return <ol key={bi}>{t.split(/\n/).filter(Boolean).map((item, ii) =>
        <li key={ii}>{item.replace(/^\d+\.\s*/, "")}</li>)}</ol>
    }
    if (/^[-*]\s/.test(t)) {
      return <ul key={bi}>{t.split(/\n/).filter(Boolean).map((item, ii) =>
        <li key={ii}>{item.replace(/^[-*]\s*/, "")}</li>)}</ul>
    }
    return <p key={bi}>{t}</p>
  })
}

const STATUS_COLORS = {
  Pending: "#f59e0b", "In Progress": "#3b82f6",
  Resolved: "#10b981", Rejected: "#ef4444",
}

const CASE_TYPE_ICONS = {
  property: "🏠", family: "💍", custody: "👶",
  consumer: "🛒", inheritance: "📜", general: "⚖️",
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LawyerDashboard() {
  const [view, setView]           = useState("requests")   // requests | active | assistant | chat
  const [requests, setRequests]   = useState([])
  const [activeCases, setActiveCases] = useState([])
  const [loading, setLoading]     = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [selectedCase, setSelectedCase] = useState(null)  // for chat view
  const [messages, setMessages]   = useState({})          // { caseId: [{role,text}] }
  const [chatInput, setChatInput] = useState("")
  const [chatSending, setChatSending] = useState(false)
  const [slmChat, setSlmChat]     = useState([{ role: "bot", text: "Hello! I'm your AI legal assistant. Ask me about any legal matter, research case law, or get guidance on Indian civil law." }])
  const [slmInput, setSlmInput]   = useState("")
  const [slmLoading, setSlmLoading] = useState(false)
  const bottomRef = useRef(null)
  const slmBottomRef = useRef(null)

  const token = localStorage.getItem("token")
  const name  = localStorage.getItem("name") || "Advocate"
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }

  useEffect(() => { fetchCases() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, selectedCase])
  useEffect(() => { slmBottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [slmChat])

  async function fetchCases() {
    setLoading(true)
    try {
      const res  = await fetch("http://127.0.0.1:8000/lawyer/cases", { headers })
      const data = await res.json()
      const all  = Array.isArray(data) ? data : []
      setRequests(all.filter(r => r.status === "Pending"))
      setActiveCases(all.filter(r => r.status === "In Progress"))
    } catch { setRequests([]); setActiveCases([]) }
    finally { setLoading(false) }
  }

  async function updateStatus(rec, newStatus) {
    const id = rec.id
    setActionLoading(p => ({ ...p, [id]: newStatus }))
    try {
      await fetch(`http://127.0.0.1:8000/cases/${rec.case_id || id}/status`, {
        method: "PATCH", headers, body: JSON.stringify({ status: newStatus }),
      })
      await fetchCases()
    } catch { alert("Action failed.") }
    finally { setActionLoading(p => ({ ...p, [id]: null })) }
  }

  async function sendClientMessage(caseId) {
    if (!chatInput.trim() || chatSending) return
    const text = chatInput.trim()
    setChatInput("")
    setChatSending(true)
    setMessages(prev => ({
      ...prev,
      [caseId]: [...(prev[caseId] || []), { role: "lawyer", text }]
    }))
    // Optimistic — in a real app this would POST to a messages endpoint
    // For now we echo a placeholder reply
    setTimeout(() => {
      setMessages(prev => ({
        ...prev,
        [caseId]: [...(prev[caseId] || []), {
          role: "client",
          text: "(Client messaging requires a real-time backend. This is a UI preview.)"
        }]
      }))
      setChatSending(false)
    }, 600)
  }

  async function sendSlmMessage() {
    if (!slmInput.trim() || slmLoading) return
    const text = slmInput.trim()
    setSlmInput("")
    setSlmChat(prev => [...prev, { role: "user", text }])
    setSlmLoading(true)
    try {
      const res  = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST", headers, body: JSON.stringify({ question: text }),
      })
      const data = await res.json()
      setSlmChat(prev => [...prev, { role: "bot", text: data.answer || "No response." }])
    } catch {
      setSlmChat(prev => [...prev, { role: "bot", text: "Could not reach the legal assistant. Is the server running?" }])
    } finally { setSlmLoading(false) }
  }

  // ─── Sidebar ──────────────────────────────────────────────────────────────

  const navItems = [
    { key: "requests", icon: "📨", label: "Requests",      badge: requests.length },
    { key: "active",   icon: "⚡", label: "Active Cases",  badge: activeCases.length },
    { key: "assistant",icon: "⚖️", label: "Legal Assistant" },
  ]

  return (
    <div style={s.shell}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.brand}>Lex<span style={s.gold}>Connect</span></div>

        <div style={s.userBox}>
          <div style={s.avatar}>{name.charAt(0).toUpperCase()}</div>
          <div>
            <div style={s.userName}>{name}</div>
            <div style={s.userRole}>Advocate</div>
          </div>
        </div>

        <nav style={s.nav}>
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => { setView(item.key); setSelectedCase(null) }}
              style={{ ...s.navBtn, ...(view === item.key || (view === "chat" && item.key === "active") ? s.navBtnActive : {}) }}
            >
              <span>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge > 0 && (
                <span style={{ ...s.badge, ...(item.key === "requests" ? s.badgeGold : {}) }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Active cases list in sidebar */}
        {activeCases.length > 0 && (
          <div style={s.sidebarCases}>
            <div style={s.sidebarCasesTitle}>Active Cases</div>
            {activeCases.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedCase(c); setView("chat") }}
                style={{ ...s.sidebarCaseBtn, ...(selectedCase?.id === c.id ? s.sidebarCaseBtnActive : {}) }}
              >
                <span>{CASE_TYPE_ICONS[c.case_type] || "⚖️"}</span>
                <span style={s.sidebarCaseName}>{c.title || `Case #${c.case_id || c.id}`}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => { localStorage.clear(); window.location.href = "/" }}
          style={s.logoutBtn}
        >
          🚪 Logout
        </button>
      </aside>

      {/* ── Main Content ── */}
      <main style={s.main}>

        {/* REQUESTS VIEW */}
        {view === "requests" && (
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <h2 style={s.panelTitle}>Incoming Requests</h2>
              <button style={s.refreshBtn} onClick={fetchCases}>↻ Refresh</button>
            </div>
            {loading ? (
              <div style={s.empty}>Loading...</div>
            ) : requests.length === 0 ? (
              <div style={s.empty}>
                <div style={s.emptyIcon}>📨</div>
                <p>No pending requests. Clients will appear here when they send requests.</p>
              </div>
            ) : (
              <div style={s.stack}>
                {requests.map(r => (
                  <div key={r.id} style={s.caseCard}>
                    <div style={s.caseCardLeft}>
                      <div style={s.caseCardTop}>
                        <span style={s.caseTypeTag}>{r.case_type || "General"}</span>
                        <span style={{ ...s.statusDot, background: STATUS_COLORS[r.status] || "#6b7280" }}>
                          {r.status}
                        </span>
                      </div>
                      <div style={s.caseTitle}>{r.title || `Case #${r.case_id || r.id}`}</div>
                      <div style={s.caseDesc}>{r.description}</div>
                      {r.client_name && <div style={s.clientName}>👤 {r.client_name}</div>}
                    </div>
                    <div style={s.caseActions}>
                      <button
                        style={s.acceptBtn}
                        disabled={!!actionLoading[r.id]}
                        onClick={() => updateStatus(r, "In Progress")}
                      >
                        {actionLoading[r.id] === "In Progress" ? "..." : "✓ Accept"}
                      </button>
                      <button
                        style={s.rejectBtn}
                        disabled={!!actionLoading[r.id]}
                        onClick={() => updateStatus(r, "Rejected")}
                      >
                        {actionLoading[r.id] === "Rejected" ? "..." : "✕ Decline"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE CASES VIEW */}
        {view === "active" && (
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <h2 style={s.panelTitle}>Active Cases</h2>
              <button style={s.refreshBtn} onClick={fetchCases}>↻ Refresh</button>
            </div>
            {loading ? (
              <div style={s.empty}>Loading...</div>
            ) : activeCases.length === 0 ? (
              <div style={s.empty}>
                <div style={s.emptyIcon}>⚡</div>
                <p>No active cases. Accept requests to see them here.</p>
              </div>
            ) : (
              <div style={s.stack}>
                {activeCases.map(r => (
                  <div key={r.id} style={s.caseCard}>
                    <div style={s.caseCardLeft}>
                      <div style={s.caseCardTop}>
                        <span style={s.caseTypeTag}>{r.case_type || "General"}</span>
                        <span style={{ ...s.statusDot, background: STATUS_COLORS[r.status] }}>
                          {r.status}
                        </span>
                      </div>
                      <div style={s.caseTitle}>{r.title || `Case #${r.case_id || r.id}`}</div>
                      <div style={s.caseDesc}>{r.description}</div>
                      {r.client_name && <div style={s.clientName}>👤 {r.client_name}</div>}
                    </div>
                    <div style={s.caseActions}>
                      <button
                        style={s.chatBtn}
                        onClick={() => { setSelectedCase(r); setView("chat") }}
                      >
                        💬 Chat
                      </button>
                      <button
                        style={s.resolveBtn}
                        disabled={!!actionLoading[r.id]}
                        onClick={() => updateStatus(r, "Resolved")}
                      >
                        {actionLoading[r.id] === "Resolved" ? "..." : "✓ Resolve"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CHAT VIEW */}
        {view === "chat" && selectedCase && (
          <div style={s.chatPanel}>
            <div style={s.panelHeader}>
              <button style={s.backBtn} onClick={() => { setView("active"); setSelectedCase(null) }}>← Back</button>
              <div>
                <h2 style={s.panelTitle}>{selectedCase.title || `Case #${selectedCase.case_id || selectedCase.id}`}</h2>
                {selectedCase.client_name && <div style={s.clientName}>👤 {selectedCase.client_name}</div>}
              </div>
            </div>

            <div style={s.caseInfoBar}>
              <span style={s.caseTypeTag}>{selectedCase.case_type || "General"}</span>
              <span style={s.caseDescSmall}>{selectedCase.description?.slice(0, 120)}...</span>
            </div>

            <div style={s.chatMessages}>
              {(messages[selectedCase.id] || []).length === 0 && (
                <div style={s.chatEmpty}>💬 No messages yet. Start the conversation with your client.</div>
              )}
              {(messages[selectedCase.id] || []).map((m, i) => (
                <div key={i} style={{ ...s.bubble, ...(m.role === "lawyer" ? s.bubbleLawyer : s.bubbleClient) }}>
                  <div style={s.bubbleLabel}>{m.role === "lawyer" ? "You" : "Client"}</div>
                  {m.text}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div style={s.chatInputRow}>
              <input
                style={s.chatInput}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendClientMessage(selectedCase.id)}
                placeholder="Message your client..."
              />
              <button
                style={s.sendBtn}
                onClick={() => sendClientMessage(selectedCase.id)}
                disabled={chatSending || !chatInput.trim()}
              >
                {chatSending ? "..." : "Send"}
              </button>
            </div>
          </div>
        )}

        {/* LEGAL ASSISTANT VIEW */}
        {view === "assistant" && (
          <div style={s.chatPanel}>
            <div style={s.panelHeader}>
              <h2 style={s.panelTitle}>⚖️ AI Legal Assistant</h2>
              <span style={s.assistantNote}>AI-powered · Indian Civil Law</span>
            </div>

            <div style={s.chatMessages}>
              {slmChat.map((m, i) => (
                <div key={i} style={{ ...s.bubble, ...(m.role === "user" ? s.bubbleLawyer : s.bubbleBot) }}>
                  <div style={s.bubbleLabel}>{m.role === "user" ? "You" : "⚖️ LexAssist"}</div>
                  {m.role === "bot" ? renderMarkdown(m.text) : m.text}
                </div>
              ))}
              {slmLoading && (
                <div style={{ ...s.bubble, ...s.bubbleBot }}>
                  <div style={s.bubbleLabel}>⚖️ LexAssist</div>
                  <span style={s.typing}>Analysing<span>...</span></span>
                </div>
              )}
              <div ref={slmBottomRef} />
            </div>

            <div style={s.chatInputRow}>
              <input
                style={s.chatInput}
                value={slmInput}
                onChange={e => setSlmInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendSlmMessage()}
                placeholder="Ask about Indian law, case research, legal procedures..."
              />
              <button
                style={s.sendBtn}
                onClick={sendSlmMessage}
                disabled={slmLoading || !slmInput.trim()}
              >
                {slmLoading ? "..." : "Ask"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
  shell:      { display: "flex", height: "100vh", background: "#0a0f1e", color: "#e2e8f0", fontFamily: "Inter, sans-serif", overflow: "hidden" },
  sidebar:    { width: 240, minWidth: 240, background: "#0d1424", borderRight: "1px solid #1e2d45", display: "flex", flexDirection: "column", padding: "24px 0", overflowY: "auto" },
  brand:      { fontSize: 22, fontWeight: 800, letterSpacing: 1, padding: "0 20px 20px", color: "#e2e8f0" },
  gold:       { color: "#d4af37" },
  userBox:    { display: "flex", alignItems: "center", gap: 10, padding: "0 16px 24px", borderBottom: "1px solid #1e2d45" },
  avatar:     { width: 36, height: 36, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: "#93c5fd", flexShrink: 0 },
  userName:   { fontSize: 13, fontWeight: 600, color: "#e2e8f0" },
  userRole:   { fontSize: 11, color: "#d4af37", marginTop: 1 },
  nav:        { padding: "16px 12px 0", display: "flex", flexDirection: "column", gap: 4 },
  navBtn:     { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 500, textAlign: "left", width: "100%", transition: "all 0.15s" },
  navBtnActive: { background: "#1e2d45", color: "#e2e8f0" },
  badge:      { background: "#1e2d45", color: "#94a3b8", borderRadius: 10, fontSize: 11, padding: "2px 7px", fontWeight: 600 },
  badgeGold:  { background: "#78350f", color: "#fbbf24" },
  sidebarCases: { padding: "16px 12px 0", borderTop: "1px solid #1e2d45", marginTop: 16 },
  sidebarCasesTitle: { fontSize: 11, color: "#64748b", fontWeight: 600, padding: "0 4px 8px", textTransform: "uppercase", letterSpacing: 0.5 },
  sidebarCaseBtn: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12, width: "100%", textAlign: "left" },
  sidebarCaseBtnActive: { background: "#1e2d45", color: "#e2e8f0" },
  sidebarCaseName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 },
  logoutBtn:  { margin: "auto 12px 0", padding: "10px 12px", background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: 13, borderRadius: 8, textAlign: "left", display: "flex", alignItems: "center", gap: 8 },
  main:       { flex: 1, overflow: "auto", display: "flex", flexDirection: "column" },
  panel:      { padding: "32px 36px", maxWidth: 860, width: "100%" },
  chatPanel:  { display: "flex", flexDirection: "column", height: "100%", padding: "24px 32px" },
  panelHeader:{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
  panelTitle: { fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 },
  refreshBtn: { marginLeft: "auto", padding: "6px 14px", background: "#1e2d45", border: "none", borderRadius: 6, color: "#94a3b8", cursor: "pointer", fontSize: 12 },
  backBtn:    { padding: "6px 12px", background: "#1e2d45", border: "none", borderRadius: 6, color: "#94a3b8", cursor: "pointer", fontSize: 12 },
  assistantNote: { marginLeft: "auto", fontSize: 12, color: "#64748b" },
  stack:      { display: "flex", flexDirection: "column", gap: 12 },
  caseCard:   { background: "#0d1424", border: "1px solid #1e2d45", borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 16 },
  caseCardLeft: { flex: 1 },
  caseCardTop:{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  caseTypeTag:{ fontSize: 11, background: "#1e2d45", color: "#93c5fd", padding: "2px 8px", borderRadius: 10, fontWeight: 600, textTransform: "capitalize" },
  statusDot:  { fontSize: 11, padding: "2px 8px", borderRadius: 10, color: "#fff", fontWeight: 600 },
  caseTitle:  { fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 },
  caseDesc:   { fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 6 },
  clientName: { fontSize: 12, color: "#94a3b8" },
  caseActions:{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 },
  acceptBtn:  { padding: "8px 16px", background: "#064e3b", border: "1px solid #10b981", borderRadius: 6, color: "#6ee7b7", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  rejectBtn:  { padding: "8px 16px", background: "#450a0a", border: "1px solid #ef4444", borderRadius: 6, color: "#fca5a5", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  chatBtn:    { padding: "8px 16px", background: "#1e2d45", border: "1px solid #3b82f6", borderRadius: 6, color: "#93c5fd", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  resolveBtn: { padding: "8px 16px", background: "#1e2d45", border: "1px solid #10b981", borderRadius: 6, color: "#6ee7b7", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  empty:      { textAlign: "center", color: "#64748b", padding: "60px 20px" },
  emptyIcon:  { fontSize: 40, marginBottom: 12 },
  chatMessages: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "8px 0 16px" },
  chatEmpty:  { textAlign: "center", color: "#64748b", padding: "40px 0", fontSize: 13 },
  bubble:     { maxWidth: "72%", padding: "10px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.6 },
  bubbleLawyer: { alignSelf: "flex-end", background: "#1e3a5f", color: "#e2e8f0" },
  bubbleClient: { alignSelf: "flex-start", background: "#1e2d45", color: "#e2e8f0" },
  bubbleBot:  { alignSelf: "flex-start", background: "#0d1f35", border: "1px solid #1e2d45", color: "#e2e8f0", maxWidth: "85%" },
  bubbleLabel:{ fontSize: 10, color: "#64748b", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" },
  caseInfoBar:{ background: "#0d1424", border: "1px solid #1e2d45", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 16, fontSize: 12 },
  caseDescSmall: { color: "#64748b", flex: 1 },
  chatInputRow: { display: "flex", gap: 10, paddingTop: 12, borderTop: "1px solid #1e2d45" },
  chatInput:  { flex: 1, padding: "10px 14px", background: "#0d1424", border: "1px solid #1e2d45", borderRadius: 8, color: "#e2e8f0", fontSize: 13, outline: "none" },
  sendBtn:    { padding: "10px 20px", background: "#1e3a5f", border: "none", borderRadius: 8, color: "#93c5fd", cursor: "pointer", fontWeight: 600, fontSize: 13 },
  typing:     { color: "#64748b" },
}
