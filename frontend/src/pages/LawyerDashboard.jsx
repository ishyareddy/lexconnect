import { useState, useEffect, useRef } from "react"

// ─── Markdown renderer (matches Chatbot.jsx on client side) ─────────────────

function inlineFormat(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function renderMarkdown(text) {
  if (!text) return null

  const normalised = text
    .replace(/\r\n/g, "\n")
    .replace(/\n(\d+\.|-|\*)\s/g, "\n\n$1 ")

  const blocks = normalised.split(/\n{2,}/).filter(Boolean)

  const merged = []
  let i = 0
  while (i < blocks.length) {
    const trimmed = blocks[i].trim()
    if (/^\d+\.\s/.test(trimmed)) {
      const items = []
      while (i < blocks.length && /^\d+\.\s/.test(blocks[i].trim())) {
        blocks[i].trim().split(/\n/).filter(Boolean).forEach((line) => {
          // ✅ require non-empty content after number — fixes empty bullet issue
          const m = line.match(/^(\d+)\.\s*(.+)/)
          if (m) items.push({ num: parseInt(m[1], 10), text: m[2] })
        })
        i++
      }
      if (items.length > 0) {
        const startNum = items[0]?.num ?? 1
        merged.push(
          <ol key={`ol-${i}`} start={startNum}>
            {items.map((item, idx) => (
              <li key={idx} value={item.num}>{inlineFormat(item.text)}</li>
            ))}
          </ol>
        )
      }
    } else if (/^[-*]\s/.test(trimmed)) {
      // ✅ Filter empty items — fixes empty bullet point
      const items = trimmed
        .split(/\n/)
        .filter(Boolean)
        .map(l => l.replace(/^[-*]\s*/, "").trim())
        .filter(Boolean)
      if (items.length > 0) {
        merged.push(
          <ul key={`ul-${i}`}>
            {items.map((item, ii) => (
              <li key={ii}>{inlineFormat(item)}</li>
            ))}
          </ul>
        )
      }
      i++
    } else {
      if (trimmed) merged.push(<p key={`p-${i}`}>{inlineFormat(trimmed)}</p>)
      i++
    }
  }
  return merged
}

// ─── Constants ───────────────────────────────────────────────────────────────

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
  const [view, setView]               = useState("requests")
  const [requests, setRequests]       = useState([])
  const [activeCases, setActiveCases] = useState([])
  const [loading, setLoading]         = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [selectedCase, setSelectedCase]   = useState(null)
  const [messages, setMessages]       = useState({})
  const [chatInput, setChatInput]     = useState("")
  const [chatSending, setChatSending] = useState(false)

  // AI assistant state — mirrors Chatbot.jsx
  const [slmChat, setSlmChat] = useState([{
    role: "bot",
    text: "Hello! I'm your AI legal assistant. Ask me about any legal matter, research case law, or get guidance on Indian civil law."
  }])
  const [slmInput, setSlmInput]     = useState("")
  const [slmLoading, setSlmLoading] = useState(false)

  const bottomRef    = useRef(null)
  const slmBottomRef = useRef(null)

  const token   = localStorage.getItem("token")
  const name    = localStorage.getItem("name") || "Advocate"
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
    setMessages(prev => ({ ...prev, [caseId]: [...(prev[caseId] || []), { role: "lawyer", text }] }))
    setTimeout(() => {
      setMessages(prev => ({ ...prev, [caseId]: [...(prev[caseId] || []), {
        role: "client",
        text: "(Client messaging requires a real-time backend. This is a UI preview.)"
      }]}))
      setChatSending(false)
    }, 600)
  }

  // ✅ Calls /chat with { message } — same endpoint as client Chatbot.jsx
  async function sendSlmMessage() {
    if (!slmInput.trim() || slmLoading) return
    const text = slmInput.trim()
    setSlmInput("")
    setSlmChat(prev => [...prev, { role: "user", text }])
    setSlmLoading(true)
    try {
      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      setSlmChat(prev => [...prev, { role: "bot", text: data.answer?.trim() || "I'm unable to process that right now." }])
    } catch (err) {
      const msg = err.message?.includes("Failed to fetch")
        ? "Cannot reach the server. Make sure the backend is running on port 8000."
        : `Error: ${err.message}`
      setSlmChat(prev => [...prev, { role: "bot", text: msg }])
    } finally {
      setSlmLoading(false)
    }
  }

  const handleSlmKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendSlmMessage() }
  }

  // ─── Nav ─────────────────────────────────────────────────────────────────

  const navItems = [
    { key: "requests",  icon: "📨", label: "Requests",          badge: requests.length },
    { key: "active",    icon: "⚡", label: "Active Cases",      badge: activeCases.length },
    { key: "assistant", icon: "⚖️", label: "AI Legal Assistant" },
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

        <button onClick={() => { localStorage.clear(); window.location.href = "/" }} style={s.logoutBtn}>
          🚪 Logout
        </button>
      </aside>

      {/* ── Main ── */}
      <main style={s.main}>

        {/* REQUESTS */}
        {view === "requests" && (
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <h2 style={s.panelTitle}>Incoming Requests</h2>
              <button style={s.refreshBtn} onClick={fetchCases}>↻ Refresh</button>
            </div>
            {loading ? <div style={s.empty}>Loading...</div>
            : requests.length === 0 ? (
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
                        <span style={{ ...s.statusDot, background: STATUS_COLORS[r.status] || "#6b7280" }}>{r.status}</span>
                      </div>
                      <div style={s.caseTitle}>{r.title || `Case #${r.case_id || r.id}`}</div>
                      <div style={s.caseDesc}>{r.description}</div>
                      {r.client_name && <div style={s.clientName}>👤 {r.client_name}</div>}
                    </div>
                    <div style={s.caseActions}>
                      <button style={s.acceptBtn} disabled={!!actionLoading[r.id]} onClick={() => updateStatus(r, "In Progress")}>
                        {actionLoading[r.id] === "In Progress" ? "..." : "✓ Accept"}
                      </button>
                      <button style={s.rejectBtn} disabled={!!actionLoading[r.id]} onClick={() => updateStatus(r, "Rejected")}>
                        {actionLoading[r.id] === "Rejected" ? "..." : "✕ Decline"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE CASES */}
        {view === "active" && (
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <h2 style={s.panelTitle}>Active Cases</h2>
              <button style={s.refreshBtn} onClick={fetchCases}>↻ Refresh</button>
            </div>
            {loading ? <div style={s.empty}>Loading...</div>
            : activeCases.length === 0 ? (
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
                        <span style={{ ...s.statusDot, background: STATUS_COLORS[r.status] }}>{r.status}</span>
                      </div>
                      <div style={s.caseTitle}>{r.title || `Case #${r.case_id || r.id}`}</div>
                      <div style={s.caseDesc}>{r.description}</div>
                      {r.client_name && <div style={s.clientName}>👤 {r.client_name}</div>}
                    </div>
                    <div style={s.caseActions}>
                      <button style={s.chatBtn} onClick={() => { setSelectedCase(r); setView("chat") }}>💬 Chat</button>
                      <button style={s.resolveBtn} disabled={!!actionLoading[r.id]} onClick={() => updateStatus(r, "Resolved")}>
                        {actionLoading[r.id] === "Resolved" ? "..." : "✓ Resolve"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CLIENT CHAT */}
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
              <button style={s.sendBtn} onClick={() => sendClientMessage(selectedCase.id)} disabled={chatSending || !chatInput.trim()}>
                {chatSending ? "..." : "Send"}
              </button>
            </div>
          </div>
        )}

        {/* ── AI LEGAL ASSISTANT — matches client Chatbot.jsx style ── */}
        {view === "assistant" && (
          <div style={s.assistantShell}>

            {/* Header bar */}
            <div style={s.assistantHeader}>
              <div style={s.assistantHeaderLeft}>
                <div style={s.chatbotDot} />
                <span style={s.assistantTitle}>AI Legal Assistant</span>
              </div>
              <span style={s.assistantNote}>AI-powered · Indian Civil Law</span>
            </div>

            {/* Messages */}
            <div style={s.assistantMessages}>
              {slmChat.map((m, i) => (
                <div key={i} style={{ ...s.chatMsg, ...(m.role === "user" ? s.chatMsgUser : s.chatMsgBot) }}>
                  {m.role === "bot" && <div style={s.botAvatar}>⚖️</div>}
                  <div style={{ ...s.msgBubble, ...(m.role === "user" ? s.msgBubbleUser : s.msgBubbleBot) }}>
                    {m.role === "bot" ? renderMarkdown(m.text) : m.text}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {slmLoading && (
                <div style={{ ...s.chatMsg, ...s.chatMsgBot }}>
                  <div style={s.botAvatar}>⚖️</div>
                  <div style={{ ...s.msgBubble, ...s.msgBubbleBot }}>
                    <span style={s.typingDots}>
                      <span>·</span><span>·</span><span>·</span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={slmBottomRef} />
            </div>

            {/* Input — textarea like client Chatbot.jsx */}
            <div style={s.assistantInputRow}>
              <textarea
                style={s.assistantTextarea}
                placeholder="Ask about Indian law, case research, legal procedures..."
                value={slmInput}
                onChange={e => setSlmInput(e.target.value)}
                onKeyDown={handleSlmKey}
                rows={2}
              />
              <button
                style={{
                  ...s.assistantSendBtn,
                  ...(!slmInput.trim() || slmLoading ? s.assistantSendBtnDisabled : {})
                }}
                onClick={sendSlmMessage}
                disabled={!slmInput.trim() || slmLoading}
              >
                ➤
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
  // Layout
  shell:      { display: "flex", height: "100vh", background: "#0a0f1e", color: "#e2e8f0", fontFamily: "Inter, sans-serif", overflow: "hidden" },

  // Sidebar
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

  // Main
  main:       { flex: 1, overflow: "auto", display: "flex", flexDirection: "column" },
  panel:      { padding: "32px 36px", maxWidth: 860, width: "100%" },
  chatPanel:  { display: "flex", flexDirection: "column", height: "100%", padding: "24px 32px" },
  panelHeader:{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
  panelTitle: { fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 },
  refreshBtn: { marginLeft: "auto", padding: "6px 14px", background: "#1e2d45", border: "none", borderRadius: 6, color: "#94a3b8", cursor: "pointer", fontSize: 12 },
  backBtn:    { padding: "6px 12px", background: "#1e2d45", border: "none", borderRadius: 6, color: "#94a3b8", cursor: "pointer", fontSize: 12 },
  stack:      { display: "flex", flexDirection: "column", gap: 12 },

  // Case cards
  caseCard:     { background: "#0d1424", border: "1px solid #1e2d45", borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 16 },
  caseCardLeft: { flex: 1 },
  caseCardTop:  { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  caseTypeTag:  { fontSize: 11, background: "#1e2d45", color: "#93c5fd", padding: "2px 8px", borderRadius: 10, fontWeight: 600, textTransform: "capitalize" },
  statusDot:    { fontSize: 11, padding: "2px 8px", borderRadius: 10, color: "#fff", fontWeight: 600 },
  caseTitle:    { fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 },
  caseDesc:     { fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 6 },
  clientName:   { fontSize: 12, color: "#94a3b8" },
  caseActions:  { display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 },
  acceptBtn:    { padding: "8px 16px", background: "#064e3b", border: "1px solid #10b981", borderRadius: 6, color: "#6ee7b7", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  rejectBtn:    { padding: "8px 16px", background: "#450a0a", border: "1px solid #ef4444", borderRadius: 6, color: "#fca5a5", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  chatBtn:      { padding: "8px 16px", background: "#1e2d45", border: "1px solid #3b82f6", borderRadius: 6, color: "#93c5fd", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  resolveBtn:   { padding: "8px 16px", background: "#1e2d45", border: "1px solid #10b981", borderRadius: 6, color: "#6ee7b7", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  empty:        { textAlign: "center", color: "#64748b", padding: "60px 20px" },
  emptyIcon:    { fontSize: 40, marginBottom: 12 },

  // Client-chat view
  chatMessages: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "8px 0 16px" },
  chatEmpty:    { textAlign: "center", color: "#64748b", padding: "40px 0", fontSize: 13 },
  bubble:       { maxWidth: "72%", padding: "10px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.6 },
  bubbleLawyer: { alignSelf: "flex-end", background: "#1e3a5f", color: "#e2e8f0" },
  bubbleClient: { alignSelf: "flex-start", background: "#1e2d45", color: "#e2e8f0" },
  bubbleLabel:  { fontSize: 10, color: "#64748b", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" },
  caseInfoBar:  { background: "#0d1424", border: "1px solid #1e2d45", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 16, fontSize: 12 },
  caseDescSmall:{ color: "#64748b", flex: 1 },
  chatInputRow: { display: "flex", gap: 10, paddingTop: 12, borderTop: "1px solid #1e2d45" },
  chatInput:    { flex: 1, padding: "10px 14px", background: "#0d1424", border: "1px solid #1e2d45", borderRadius: 8, color: "#e2e8f0", fontSize: 13, outline: "none" },
  sendBtn:      { padding: "10px 20px", background: "#1e3a5f", border: "none", borderRadius: 8, color: "#93c5fd", cursor: "pointer", fontWeight: 600, fontSize: 13 },

  // ── AI Assistant — styled to match client Chatbot.jsx ──
  assistantShell:      { display: "flex", flexDirection: "column", height: "100vh", background: "#0d1424" },
  assistantHeader:     { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #1e2d45", flexShrink: 0 },
  assistantHeaderLeft: { display: "flex", alignItems: "center", gap: 10 },
  assistantTitle:      { fontSize: 15, fontWeight: 700, color: "#e2e8f0" },
  assistantNote:       { fontSize: 12, color: "#64748b" },
  chatbotDot:          { width: 8, height: 8, borderRadius: "50%", background: "#10b981" },

  assistantMessages:   { flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 },

  // Message rows
  chatMsg:      { display: "flex", alignItems: "flex-start", gap: 10 },
  chatMsgBot:   { flexDirection: "row" },
  chatMsgUser:  { flexDirection: "row-reverse" },

  botAvatar:    { width: 28, height: 28, borderRadius: "50%", background: "#1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, marginTop: 2 },

  msgBubble:     { maxWidth: "80%", padding: "10px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.65 },
  msgBubbleBot:  { background: "#111827", border: "1px solid #1e2d45", color: "#e2e8f0", borderTopLeftRadius: 4 },
  msgBubbleUser: { background: "#1e3a5f", color: "#e2e8f0", borderTopRightRadius: 4 },

  typingDots:   { fontSize: 22, letterSpacing: 3, color: "#64748b", lineHeight: 1 },

  // Input row
  assistantInputRow:       { display: "flex", alignItems: "flex-end", gap: 10, padding: "12px 16px", borderTop: "1px solid #1e2d45", background: "#0d1424", flexShrink: 0 },
  assistantTextarea:       { flex: 1, padding: "10px 14px", background: "#111827", border: "1px solid #1e2d45", borderRadius: 10, color: "#e2e8f0", fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.5 },
  assistantSendBtn:        { padding: "10px 16px", background: "#1e3a5f", border: "none", borderRadius: 10, color: "#93c5fd", cursor: "pointer", fontWeight: 700, fontSize: 16, flexShrink: 0 },
  assistantSendBtnDisabled:{ opacity: 0.4, cursor: "not-allowed" },
<<<<<<< HEAD
}
=======
}
>>>>>>> b8c85d6 (fix: lawyer dashboard)
