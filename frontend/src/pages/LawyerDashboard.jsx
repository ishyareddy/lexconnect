import { useState, useEffect, useRef } from "react"
import CommunicationPanel from "../components/CommunicationPanel"

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
        blocks[i]
          .trim()
          .split(/\n/)
          .filter(Boolean)
          .forEach((line) => {
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
              <li key={idx} value={item.num}>
                {inlineFormat(item.text)}
              </li>
            ))}
          </ol>
        )
      }
    } else if (/^[-*]\s/.test(trimmed)) {
      const items = trimmed
        .split(/\n/)
        .filter(Boolean)
        .map((l) => l.replace(/^[-*]\s*/, "").trim())
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

const STATUS_COLORS = {
  Pending: "#f59e0b",
  "In Progress": "#3b82f6",
  Resolved: "#10b981",
  Rejected: "#ef4444",
}

const CASE_TYPE_ICONS = {
  property: "🏠",
  family: "💍",
  custody: "👶",
  consumer: "🛒",
  inheritance: "📜",
  general: "⚖️",
}

const s = {
  shell: {
    display: "flex",
    height: "100vh",
    background: "#0a0f1e",
    color: "#e2e8f0",
    fontFamily: "Inter, sans-serif",
    overflow: "hidden",
  },

  sidebar: {
    width: 240,
    minWidth: 240,
    background: "#0d1424",
    borderRight: "1px solid #1e2d45",
    display: "flex",
    flexDirection: "column",
    padding: "24px 0",
    overflowY: "auto",
  },
  brand: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 1,
    padding: "0 20px 20px",
    color: "#e2e8f0",
  },
  gold: { color: "#d4af37" },
  userBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 16px 24px",
    borderBottom: "1px solid #1e2d45",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#1e3a5f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 15,
    color: "#93c5fd",
    flexShrink: 0,
  },
  userName: { fontSize: 13, fontWeight: 600, color: "#e2e8f0" },
  userRole: { fontSize: 11, color: "#d4af37", marginTop: 1 },
  nav: { padding: "16px 12px 0", display: "flex", flexDirection: "column", gap: 4 },
  navBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    textAlign: "left",
    width: "100%",
    transition: "all 0.15s",
  },
  navBtnActive: { background: "#1e2d45", color: "#e2e8f0" },
  badge: {
    background: "#1e2d45",
    color: "#94a3b8",
    borderRadius: 10,
    fontSize: 11,
    padding: "2px 7px",
    fontWeight: 600,
  },
  badgeGold: { background: "#78350f", color: "#fbbf24" },
  sidebarCases: { padding: "16px 12px 0", borderTop: "1px solid #1e2d45", marginTop: 16 },
  sidebarCasesTitle: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 600,
    padding: "0 4px 8px",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sidebarCaseBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 6,
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
    textAlign: "left",
    width: "100%",
    transition: "all 0.15s",
  },
  sidebarCaseBtnActive: { background: "#1e2d45", color: "#e2e8f0" },
  sidebarCaseName: { flex: 1, fontSize: 12 },
  logoutBtn: {
    margin: "auto 12px 20px",
    padding: "10px",
    borderRadius: 8,
    background: "transparent",
    border: "1px solid #1e2d45",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
    width: "calc(100% - 24px)",
    transition: "all 0.15s",
  },
  logoutBtnHover: { background: "#1e2d45", color: "#e2e8f0" },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  panel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#0d1424",
    borderRadius: "12px",
    margin: "20px",
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px",
    borderBottom: "1px solid #1e2d45",
    flexShrink: 0,
  },
  panelTitle: { fontSize: 18, fontWeight: 700, color: "#e2e8f0" },
  refreshBtn: {
    padding: "8px 12px",
    borderRadius: 6,
    background: "#1e3a5f",
    border: "none",
    color: "#93c5fd",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },

  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "40px 20px",
  },
  emptyIcon: { fontSize: 48, marginBottom: 16, opacity: 0.5 },
  emptyText: { fontSize: 14, color: "#64748b", marginBottom: 8 },
  emptySubtext: { fontSize: 12, color: "#475569" },

  stack: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  caseCard: {
    background: "#111827",
    border: "1px solid #1e2d45",
    borderRadius: 12,
    padding: 0,
    overflow: "hidden",
    transition: "border-color 0.2s",
  },
  caseCardHover: { borderColor: "#374151" },
  caseCardLeft: { padding: "16px" },
  caseCardTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  caseTypeTag: {
    background: "#1e3a5f",
    color: "#93c5fd",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
  caseTitle: { fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 },
  caseDesc: { fontSize: 13, color: "#94a3b8", lineHeight: 1.5 },
  clientName: { fontSize: 12, color: "#64748b", marginTop: 8 },
  caseActions: {
    display: "flex",
    gap: 8,
    padding: "12px 16px",
    background: "#0a0f1e",
    borderTop: "1px solid #1e2d45",
  },
  acceptBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 6,
    background: "#10b981",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  rejectBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 6,
    background: "transparent",
    border: "1px solid #ef4444",
    color: "#ef4444",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  chatBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 6,
    background: "#3b82f6",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  resolveBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 6,
    background: "#8b5cf6",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },

  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  assistantShell: { display: "flex", flexDirection: "column", height: "100vh", background: "#0d1424" },
  assistantHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid #1e2d45",
    flexShrink: 0,
  },
  assistantHeaderLeft: { display: "flex", alignItems: "center", gap: 10 },
  assistantTitle: { fontSize: 15, fontWeight: 700, color: "#e2e8f0" },
  assistantNote: { fontSize: 12, color: "#64748b" },
  chatbotDot: { width: 8, height: 8, borderRadius: "50%", background: "#10b981" },
  slmCaseBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: "14px 20px",
    borderBottom: "1px solid #1e2d45",
    background: "#0b1221",
  },
  slmCaseLabel: { fontSize: 12, color: "#94a3b8", fontWeight: 600 },
  slmCasePill: {
    border: "1px solid #1e2d45",
    background: "#12203a",
    color: "#e2e8f0",
    padding: "8px 12px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
  },
  slmCasePillActive: {
    background: "#4338ca",
    borderColor: "#4338ca",
    color: "#fff",
  },
  slmClearBtn: {
    marginLeft: "auto",
    border: "1px solid #1e2d45",
    background: "transparent",
    color: "#f8fafc",
    padding: "8px 12px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
  },

  assistantMessages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  chatMsg: { display: "flex", alignItems: "flex-start", gap: 10 },
  chatMsgBot: { flexDirection: "row" },
  chatMsgUser: { flexDirection: "row-reverse" },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#1e3a5f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    flexShrink: 0,
    marginTop: 2,
  },
  msgBubble: { maxWidth: "80%", padding: "10px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.65 },
  msgBubbleBot: {
    background: "#111827",
    border: "1px solid #1e2d45",
    color: "#e2e8f0",
    borderTopLeftRadius: 4,
  },
  msgBubbleUser: {
    background: "#1e3a5f",
    color: "#e2e8f0",
    borderTopRightRadius: 4,
  },
  typingDots: { fontSize: 22, letterSpacing: 3, color: "#64748b", lineHeight: 1 },

  assistantInputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    padding: "12px 16px",
    borderTop: "1px solid #1e2d45",
    background: "#0d1424",
    flexShrink: 0,
  },
  assistantTextarea: {
    flex: 1,
    padding: "10px 14px",
    background: "#111827",
    border: "1px solid #1e2d45",
    borderRadius: 10,
    color: "#e2e8f0",
    fontSize: 13,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
  },
  assistantSendBtn: {
    padding: "10px 16px",
    background: "#1e3a5f",
    border: "none",
    borderRadius: 10,
    color: "#93c5fd",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  assistantSendBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },

  micBtn: {
    padding: "10px",
    background: "#1e3a5f",
    border: "none",
    borderRadius: 10,
    color: "#93c5fd",
    cursor: "pointer",
    fontSize: 16,
    flexShrink: 0,
    transition: "all 0.2s",
  },
  micBtnListening: {
    background: "#dc2626",
    color: "#fff",
    animation: "mic-pulse 1.5s infinite",
  },
  voiceStatus: {
    fontSize: 12,
    color: "#64748b",
    marginLeft: 8,
    animation: "fade-in 0.3s",
  },

  // ──────────────────────────────────────────────────────────────────────────
}

export default function LawyerDashboard() {
  const [view, setView] = useState("requests")
  const [requests, setRequests] = useState([])
  const [activeCases, setActiveCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [selectedCase, setSelectedCase] = useState(null)
  const [messages, setMessages] = useState({})
  const [chatInput, setChatInput] = useState("")
  const [chatSending, setChatSending] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [assistantCases, setAssistantCases] = useState([])
  const [activeAssistantCaseId, setActiveAssistantCaseId] = useState(null)

  const [slmChat, setSlmChat] = useState([
    {
      role: "bot",
      text: "Hello! I'm your AI legal assistant. Ask me about any legal matter, research case law, or get guidance on Indian civil law.",
    },
  ])
  const [slmInput, setSlmInput] = useState("")
  const [slmLoading, setSlmLoading] = useState(false)
  const [slmActiveCaseId, setSlmActiveCaseId] = useState(null)

  // ── Voice input state ──────────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const recognitionRef = useRef(null)
  // ──────────────────────────────────────────────────────────────────────────

  const bottomRef = useRef(null)
  const slmBottomRef = useRef(null)

  const token = localStorage.getItem("token")
  const name = localStorage.getItem("name") || "Advocate"
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  useEffect(() => {
    fetchCases()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, selectedCase])

  useEffect(() => {
    slmBottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [slmChat])

  // ── Voice setup ───────────────────────────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setVoiceSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false  // Only fire once with final result
      recognition.lang = "en-IN" // Indian English — change as needed

      recognition.onresult = (event) => {
        // Only use the single final transcript result
        const transcript = event.results[0][0].transcript
        setSlmInput((prev) => {
          const base = prev.endsWith(" ") || prev === "" ? prev : prev + " "
          return base + transcript
        })
      }

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }
  }, [])
  // ──────────────────────────────────────────────────────────────────────────

  async function fetchCases() {
    setLoading(true)
    try {
      const res = await fetch("http://127.0.0.1:8000/lawyer/cases", { headers })
      const data = await res.json()
      const all = Array.isArray(data) ? data : []
      
      // Deduplicate by case_id (keep first occurrence)
      const seen = new Set()
      const deduped = all.filter(r => {
        if (seen.has(r.case_id)) return false
        seen.add(r.case_id)
        return true
      })
      
      setRequests(deduped.filter((r) => r.status === "Pending"))
      setActiveCases(deduped.filter((r) => r.status === "In Progress"))
    } catch {
      setRequests([])
      setActiveCases([])
    } finally {
      setLoading(false)
    }
  }

  async function updateStatus(rec, newStatus) {
    if (submitting) return

    const caseId = rec.case_id
    setSubmitting(true)
    setActionLoading((p) => ({ ...p, [rec.id]: newStatus }))

    try {
      const res = await fetch(`http://127.0.0.1:8000/cases/${caseId}/status?t=${Date.now()}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      await fetchCases()

      if (selectedCase?.id === rec.id) {
        if (newStatus === "Resolved" || newStatus === "Rejected") {
          setSelectedCase(null)
        } else {
          setSelectedCase({ ...rec, status: newStatus })
        }
      }
    } catch (err) {
      console.error("Failed:", err)
      alert("Failed: " + err.message)
    } finally {
      setSubmitting(false)
      setActionLoading((p) => ({ ...p, [rec.id]: null }))
    }
  }

  async function sendClientMessage(caseId) {
    if (!chatInput.trim() || chatSending) return
    const text = chatInput.trim()
    setChatInput("")
    setChatSending(true)

    setMessages((prev) => ({
      ...prev,
      [caseId]: [...(prev[caseId] || []), { role: "lawyer", text }],
    }))

    setTimeout(() => {
      setMessages((prev) => ({
        ...prev,
        [caseId]: [
          ...(prev[caseId] || []),
          {
            role: "client",
            text: "(Client messaging requires a real-time backend. This is a UI preview.)",
          },
        ],
      }))
      setChatSending(false)
    }, 600)
  }

  async function sendSlmMessage() {
    if (!slmInput.trim() || slmLoading) return
    const text = slmInput.trim()
    setSlmInput("")
    setSlmChat((prev) => [...prev, { role: "user", text }])
    setSlmLoading(true)

    // Stop voice if still active when the message is sent
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    }

    try {
      const body = {
        message: text,
        ...(slmActiveCaseId !== null ? { case_id: slmActiveCaseId } : {}),
      }

      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      const data = await res.json()
      setSlmChat((prev) => [
        ...prev,
        { role: "bot", text: data.answer?.trim() || "I'm unable to process that right now." },
      ])
    } catch (err) {
      const msg = err.message?.includes("Failed to fetch")
        ? "Cannot reach the server. Make sure the backend is running on port 8000."
        : `Error: ${err.message}`

      setSlmChat((prev) => [...prev, { role: "bot", text: msg }])
    } finally {
      setSlmLoading(false)
    }
  }

  const handleSlmKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendSlmMessage()
    }
  }

  const clearSlmCaseContext = () => {
    setSlmActiveCaseId(null)
  }

  // ── Voice toggle ──────────────────────────────────────────────────────────
  const toggleVoice = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      // Clear any trailing interim text before starting fresh segment
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (err) {
        // Recognition already started — just stop it
        recognitionRef.current.stop()
        setIsListening(false)
      }
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const navItems = [
    { key: "requests", icon: "📨", label: "Requests", badge: requests.length },
    { key: "active", icon: "⚡", label: "Active Cases", badge: activeCases.length },
    { key: "assistant", icon: "⚖️", label: "AI Legal Assistant" },
  ]

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.brand}>
          Lex<span style={s.gold}>Connect</span>
        </div>

        <div style={s.userBox}>
          <div style={s.avatar}>{name.charAt(0).toUpperCase()}</div>
          <div>
            <div style={s.userName}>{name}</div>
            <div style={s.userRole}>Advocate</div>
          </div>
        </div>

        <nav style={s.nav}>
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setView(item.key)
                setSelectedCase(null)
              }}
              style={{
                ...s.navBtn,
                ...(view === item.key ? s.navBtnActive : {}),
              }}
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
            {activeCases.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCase(c)}
                style={{
                  ...s.sidebarCaseBtn,
                  ...(selectedCase?.id === c.id ? s.sidebarCaseBtnActive : {}),
                }}
              >
                <span>{CASE_TYPE_ICONS[c.case_type] || "⚖️"}</span>
                <span style={s.sidebarCaseName}>{c.title || `Case #${c.case_id || c.id}`}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            localStorage.clear()
            window.location.href = "/"
          }}
          style={s.logoutBtn}
        >
          🚪 Logout
        </button>
      </aside>

      <main style={s.main}>
        {view === "requests" && (
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <h2 style={s.panelTitle}>Incoming Requests</h2>
              <button style={s.refreshBtn} onClick={fetchCases}>
                ↻ Refresh
              </button>
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
                {requests.map((r) => (
                  <div
                    key={r.id}
                    style={{ ...s.caseCard, cursor: "pointer" }}
                    onClick={() => setSelectedCase(r)}
                  >
                    <div style={s.caseCardLeft}>
                      <div style={s.caseCardTop}>
                        <span style={s.caseTypeTag}>{r.case_type || "General"}</span>
                        <span
                          style={{
                            ...s.statusDot,
                            background: STATUS_COLORS[r.status] || "#6b7280",
                          }}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div style={s.caseTitle}>{r.title || `Case #${r.case_id || r.id}`}</div>
                      <div style={s.caseDesc}>
                        {r.description?.slice(0, 120)}
                        {r.description?.length > 120 ? "…" : ""}
                      </div>
                      {r.client_name && <div style={s.clientName}>👤 {r.client_name}</div>}
                    </div>

                    <div style={s.caseActions}>
                      <button
                        style={s.acceptBtn}
                        disabled={!!actionLoading[r.id] || submitting}
                        onClick={(e) => {
                          e.stopPropagation()
                          updateStatus(r, "In Progress")
                        }}
                      >
                        {actionLoading[r.id] === "In Progress" ? "..." : "✓ Accept"}
                      </button>

                      <button
                        style={s.rejectBtn}
                        disabled={!!actionLoading[r.id] || submitting}
                        onClick={(e) => {
                          e.stopPropagation()
                          updateStatus(r, "Rejected")
                        }}
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

        {view === "active" && (
          <div style={s.panel}>
            <div style={s.panelHeader}>
              <h2 style={s.panelTitle}>Active Cases</h2>
              <button style={s.refreshBtn} onClick={fetchCases}>
                ↻ Refresh
              </button>
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
                {activeCases.map((r) => (
                  <div
                    key={r.id}
                    style={{ ...s.caseCard, cursor: "pointer" }}
                    onClick={() => setSelectedCase(r)}
                  >
                    <div style={s.caseCardLeft}>
                      <div style={s.caseCardTop}>
                        <span style={s.caseTypeTag}>{r.case_type || "General"}</span>
                        <span
                          style={{
                            ...s.statusDot,
                            background: STATUS_COLORS[r.status] || "#6b7280",
                          }}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div style={s.caseTitle}>{r.title || `Case #${r.case_id || r.id}`}</div>
                      <div style={s.caseDesc}>
                        {r.description?.slice(0, 120)}
                        {r.description?.length > 120 ? "…" : ""}
                      </div>
                      {r.client_name && <div style={s.clientName}>👤 {r.client_name}</div>}
                    </div>

                    <div style={s.caseActions}>
                      <button
                        style={s.chatBtn}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCase(r)
                        }}
                      >
                        💬 Chat & Video
                      </button>

                      <button
                        style={s.resolveBtn}
                        disabled={!!actionLoading[r.id] || submitting}
                        onClick={(e) => {
                          e.stopPropagation()
                          updateStatus(r, "Resolved")
                        }}
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

        {view === "assistant" && (
          <div style={s.assistantShell}>
            <div style={s.assistantHeader}>
              <div style={s.assistantHeaderLeft}>
                <div style={s.chatbotDot} />
                <span style={s.assistantTitle}>AI Legal Assistant</span>
              </div>
              <span style={s.assistantNote}>AI-powered · Indian Civil Law</span>
            </div>

            {activeCases.length > 0 && (
              <div style={s.slmCaseBar}>
                <span style={s.slmCaseLabel}>Case context:</span>
                <button
                  style={{
                    ...s.slmCasePill,
                    ...(slmActiveCaseId === null ? s.slmCasePillActive : {}),
                  }}
                  onClick={() => setSlmActiveCaseId(null)}
                >
                  All Cases
                </button>
                {activeCases.map((c) => {
                  const id = c.case_id || c.id
                  return (
                    <button
                      key={id}
                      style={{
                        ...s.slmCasePill,
                        ...(slmActiveCaseId === id ? s.slmCasePillActive : {}),
                      }}
                      onClick={() => setSlmActiveCaseId(id)}
                    >
                      {c.title || `Case #${id}`}
                    </button>
                  )
                })}
                {slmActiveCaseId !== null && (
                  <button style={s.slmClearBtn} onClick={clearSlmCaseContext}>
                    Clear
                  </button>
                )}
              </div>
            )}

            <div style={s.assistantMessages}>
              {slmChat.map((m, i) => (
                <div
                  key={i}
                  style={{ ...s.chatMsg, ...(m.role === "user" ? s.chatMsgUser : s.chatMsgBot) }}
                >
                  {m.role === "bot" && <div style={s.botAvatar}>⚖️</div>}
                  <div
                    style={{
                      ...s.msgBubble,
                      ...(m.role === "user" ? s.msgBubbleUser : s.msgBubbleBot),
                    }}
                  >
                    {m.role === "bot" ? renderMarkdown(m.text) : m.text}
                  </div>
                </div>
              ))}

              {slmLoading && (
                <div style={{ ...s.chatMsg, ...s.chatMsgBot }}>
                  <div style={s.botAvatar}>⚖️</div>
                  <div style={{ ...s.msgBubble, ...s.msgBubbleBot }}>
                    <span style={s.typingDots}>
                      <span>·</span>
                      <span>·</span>
                      <span>·</span>
                    </span>
                  </div>
                </div>
              )}

              <div ref={slmBottomRef} />
            </div>

            <div style={s.assistantInputRow}>
              <textarea
                style={s.assistantTextarea}
                placeholder="Ask about Indian law, case research, legal procedures..."
                value={slmInput}
                onChange={(e) => setSlmInput(e.target.value)}
                onKeyDown={handleSlmKey}
                rows={2}
              />

              {/* Mic button — only rendered when browser supports Web Speech API */}
              {voiceSupported && (
                <button
                  style={{
                    ...s.micBtn,
                    ...(isListening ? s.micBtnListening : {}),
                  }}
                  onClick={toggleVoice}
                  title={isListening ? "Stop recording" : "Speak your message"}
                  type="button"
                >
                  {isListening ? (
                    /* Animated waveform icon while recording */
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                      <rect x="2"  y="9"  width="3" height="6" rx="1.5" fill="currentColor" className="wave-bar bar1"/>
                      <rect x="7"  y="5"  width="3" height="14" rx="1.5" fill="currentColor" className="wave-bar bar2"/>
                      <rect x="12" y="3"  width="3" height="18" rx="1.5" fill="currentColor" className="wave-bar bar3"/>
                      <rect x="17" y="5"  width="3" height="14" rx="1.5" fill="currentColor" className="wave-bar bar4"/>
                    </svg>
                  ) : (
                    /* Microphone icon at rest */
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Z" fill="currentColor"/>
                      <path d="M19 10a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.08A7 7 0 0 0 19 10Z" fill="currentColor"/>
                    </svg>
                  )}
                </button>
              )}

              <button
                style={{
                  ...s.assistantSendBtn,
                  ...(!slmInput.trim() || slmLoading ? s.assistantSendBtnDisabled : {}),
                }}
                onClick={sendSlmMessage}
                disabled={!slmInput.trim() || slmLoading}
              >
                ➤
              </button>
            </div>

            {/* Listening status label */}
            {isListening && (
              <div style={s.voiceStatus}>
                🎙️ Listening… speak now
              </div>
            )}
          </div>
        )}
      </main>

      {selectedCase && (
        <div style={s.modalOverlay} onClick={() => setSelectedCase(null)}>
          <div style={{
            width: "100%",
            maxWidth: "900px",
            height: "80vh",
            borderRadius: "12px",
            background: "white",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)"
          }} onClick={(e) => e.stopPropagation()}>
            <CommunicationPanel
              caseId={selectedCase.case_id || selectedCase.id}
              cases={activeCases.filter((c) => c.client_id === selectedCase.client_id)}
              otherUserId={selectedCase.client_id}
              otherUserName={selectedCase.client_name}
              onClose={() => setSelectedCase(null)}
            />
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(232,75,75,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(232,75,75,0); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}} />
      {/* Video call modal removed - now integrated into case detail modal */}
    </div>
  )
}

/* const s_duplicate = {
  shell: {
    display: "flex",
    height: "100vh",
    background: "#0a0f1e",
    color: "#e2e8f0",
    fontFamily: "Inter, sans-serif",
    overflow: "hidden",
  },

  sidebar: {
    width: 240,
    minWidth: 240,
    background: "#0d1424",
    borderRight: "1px solid #1e2d45",
    display: "flex",
    flexDirection: "column",
    padding: "24px 0",
    overflowY: "auto",
  },
  brand: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 1,
    padding: "0 20px 20px",
    color: "#e2e8f0",
  },
  gold: { color: "#d4af37" },
  userBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 16px 24px",
    borderBottom: "1px solid #1e2d45",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#1e3a5f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 15,
    color: "#93c5fd",
    flexShrink: 0,
  },
  userName: { fontSize: 13, fontWeight: 600, color: "#e2e8f0" },
  userRole: { fontSize: 11, color: "#d4af37", marginTop: 1 },
  nav: { padding: "16px 12px 0", display: "flex", flexDirection: "column", gap: 4 },
  navBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    textAlign: "left",
    width: "100%",
    transition: "all 0.15s",
  },
  navBtnActive: { background: "#1e2d45", color: "#e2e8f0" },
  badge: {
    background: "#1e2d45",
    color: "#94a3b8",
    borderRadius: 10,
    fontSize: 11,
    padding: "2px 7px",
    fontWeight: 600,
  },
  badgeGold: { background: "#78350f", color: "#fbbf24" },
  sidebarCases: { padding: "16px 12px 0", borderTop: "1px solid #1e2d45", marginTop: 16 },
  sidebarCasesTitle: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 600,
    padding: "0 4px 8px",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sidebarCaseBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 6,
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
    textAlign: "left",
    width: "100%",
    transition: "all 0.15s",
  },
  sidebarCaseBtnActive: { background: "#1e2d45", color: "#e2e8f0" },
  sidebarCaseName: { flex: 1, fontSize: 12 },
  logoutBtn: {
    margin: "auto 12px 20px",
    padding: "10px",
    borderRadius: 8,
    background: "transparent",
    border: "1px solid #1e2d45",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
    width: "calc(100% - 24px)",
    transition: "all 0.15s",
  },
  logoutBtnHover: { background: "#1e2d45", color: "#e2e8f0" },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  panel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#0d1424",
    borderRadius: "12px",
    margin: "20px",
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px",
    borderBottom: "1px solid #1e2d45",
    flexShrink: 0,
  },
  panelTitle: { fontSize: 18, fontWeight: 700, color: "#e2e8f0" },
  refreshBtn: {
    padding: "8px 12px",
    borderRadius: 6,
    background: "#1e3a5f",
    border: "none",
    color: "#93c5fd",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },

  empty: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "40px 20px",
  },
  emptyIcon: { fontSize: 48, marginBottom: 16, opacity: 0.5 },
  emptyText: { fontSize: 14, color: "#64748b", marginBottom: 8 },
  emptySubtext: { fontSize: 12, color: "#475569" },

  stack: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  caseCard: {
    background: "#111827",
    border: "1px solid #1e2d45",
    borderRadius: 12,
    padding: 0,
    overflow: "hidden",
    transition: "border-color 0.2s",
  },
  caseCardHover: { borderColor: "#374151" },
  caseCardLeft: { padding: "16px" },
  caseCardTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 },
  caseTypeTag: {
    background: "#1e3a5f",
    color: "#93c5fd",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
  caseTitle: { fontSize: 16, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 },
  caseDesc: { fontSize: 13, color: "#94a3b8", lineHeight: 1.5 },
  clientName: { fontSize: 12, color: "#64748b", marginTop: 8 },
  caseActions: {
    display: "flex",
    gap: 8,
    padding: "12px 16px",
    background: "#0a0f1e",
    borderTop: "1px solid #1e2d45",
  },
  acceptBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 6,
    background: "#10b981",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  rejectBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 6,
    background: "transparent",
    border: "1px solid #ef4444",
    color: "#ef4444",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  chatBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 6,
    background: "#3b82f6",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  resolveBtn: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 6,
    background: "#8b5cf6",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },

  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  assistantShell: { display: "flex", flexDirection: "column", height: "100vh", background: "#0d1424" },
  assistantHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid #1e2d45",
    flexShrink: 0,
  },
  assistantHeaderLeft: { display: "flex", alignItems: "center", gap: 10 },
  assistantTitle: { fontSize: 15, fontWeight: 700, color: "#e2e8f0" },
  assistantNote: { fontSize: 12, color: "#64748b" },
  chatbotDot: { width: 8, height: 8, borderRadius: "50%", background: "#10b981" },
  slmCaseBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: "14px 20px",
    borderBottom: "1px solid #1e2d45",
    background: "#0b1221",
  },
  slmCaseLabel: { fontSize: 12, color: "#94a3b8", fontWeight: 600 },
  slmCasePill: {
    border: "1px solid #1e2d45",
    background: "#12203a",
    color: "#e2e8f0",
    padding: "8px 12px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
  },
  slmCasePillActive: {
    background: "#4338ca",
    borderColor: "#4338ca",
    color: "#fff",
  },
  slmClearBtn: {
    marginLeft: "auto",
    border: "1px solid #1e2d45",
    background: "transparent",
    color: "#f8fafc",
    padding: "8px 12px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
  },

  assistantMessages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  chatMsg: { display: "flex", alignItems: "flex-start", gap: 10 },
  chatMsgBot: { flexDirection: "row" },
  chatMsgUser: { flexDirection: "row-reverse" },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#1e3a5f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    flexShrink: 0,
    marginTop: 2,
  },
  msgBubble: { maxWidth: "80%", padding: "10px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.65 },
  msgBubbleBot: {
    background: "#111827",
    border: "1px solid #1e2d45",
    color: "#e2e8f0",
    borderTopLeftRadius: 4,
  },
  msgBubbleUser: {
    background: "#1e3a5f",
    color: "#e2e8f0",
    borderTopRightRadius: 4,
  },
  typingDots: { fontSize: 22, letterSpacing: 3, color: "#64748b", lineHeight: 1 },

  assistantInputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    padding: "12px 16px",
    borderTop: "1px solid #1e2d45",
    background: "#0d1424",
    flexShrink: 0,
  },
  assistantTextarea: {
    flex: 1,
    padding: "10px 14px",
    background: "#111827",
    border: "1px solid #1e2d45",
    borderRadius: 10,
    color: "#e2e8f0",
    fontSize: 13,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
  },
  assistantSendBtn: {
    padding: "10px 16px",
    background: "#1e3a5f",
    border: "none",
    borderRadius: 10,
    color: "#93c5fd",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  assistantSendBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },

  micBtn: {
    padding: "10px",
    background: "#1e3a5f",
    border: "none",
    borderRadius: 10,
    color: "#93c5fd",
    cursor: "pointer",
    fontSize: 16,
    flexShrink: 0,
    transition: "all 0.2s",
  },
  micBtnListening: {
    background: "#dc2626",
    color: "#fff",
    animation: "mic-pulse 1.5s infinite",
  },
  voiceStatus: {
    fontSize: 12,
    color: "#64748b",
    marginLeft: 8,
    animation: "fade-in 0.3s",
  },

  // ──────────────────────────────────────────────────────────────────────────
}
    minWidth: 240,
    background: "#0d1424",
    borderRight: "1px solid #1e2d45",
    display: "flex",
    flexDirection: "column",
    padding: "24px 0",
    overflowY: "auto",
  },
  brand: {
    fontSize: 22,
    fontWeight: 800,
    letterSpacing: 1,
    padding: "0 20px 20px",
    color: "#e2e8f0",
  },
  gold: { color: "#d4af37" },
  userBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 16px 24px",
    borderBottom: "1px solid #1e2d45",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: "#1e3a5f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 15,
    color: "#93c5fd",
    flexShrink: 0,
  },
  userName: { fontSize: 13, fontWeight: 600, color: "#e2e8f0" },
  userRole: { fontSize: 11, color: "#d4af37", marginTop: 1 },
  nav: { padding: "16px 12px 0", display: "flex", flexDirection: "column", gap: 4 },
  navBtn: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 8,
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    textAlign: "left",
    width: "100%",
    transition: "all 0.15s",
  },
  navBtnActive: { background: "#1e2d45", color: "#e2e8f0" },
  badge: {
    background: "#1e2d45",
    color: "#94a3b8",
    borderRadius: 10,
    fontSize: 11,
    padding: "2px 7px",
    fontWeight: 600,
  },
  badgeGold: { background: "#78350f", color: "#fbbf24" },
  sidebarCases: { padding: "16px 12px 0", borderTop: "1px solid #1e2d45", marginTop: 16 },
  sidebarCasesTitle: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 600,
    padding: "0 4px 8px",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sidebarCaseBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 6,
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
    width: "100%",
    textAlign: "left",
  },
  sidebarCaseBtnActive: { background: "#1e2d45", color: "#e2e8f0" },
  sidebarCaseName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 },
  logoutBtn: {
    margin: "auto 12px 0",
    padding: "10px 12px",
    background: "transparent",
    border: "none",
    color: "#64748b",
    cursor: "pointer",
    fontSize: 13,
    borderRadius: 8,
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  main: { flex: 1, overflow: "auto", display: "flex", flexDirection: "column" },
  panel: { padding: "32px 36px", maxWidth: 860, width: "100%" },
  panelHeader: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
  panelTitle: { fontSize: 20, fontWeight: 700, color: "#e2e8f0", margin: 0 },
  refreshBtn: {
    marginLeft: "auto",
    padding: "6px 14px",
    background: "#1e2d45",
    border: "none",
    borderRadius: 6,
    color: "#94a3b8",
    cursor: "pointer",
    fontSize: 12,
  },
  stack: { display: "flex", flexDirection: "column", gap: 12 },

  caseCard: {
    background: "#0d1424",
    border: "1px solid #1e2d45",
    borderRadius: 10,
    padding: "16px 20px",
    display: "flex",
    alignItems: "flex-start",
    gap: 16,
  },
  caseCardLeft: { flex: 1 },
  caseCardTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  caseTypeTag: {
    fontSize: 11,
    background: "#1e2d45",
    color: "#93c5fd",
    padding: "2px 8px",
    borderRadius: 10,
    fontWeight: 600,
    textTransform: "capitalize",
  },
  statusDot: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 10,
    color: "#fff",
    fontWeight: 600,
  },
  caseTitle: { fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 },
  caseDesc: { fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 6 },
  clientName: { fontSize: 12, color: "#94a3b8" },
  caseActions: { display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 },
  acceptBtn: {
    padding: "8px 16px",
    background: "#064e3b",
    border: "1px solid #10b981",
    borderRadius: 6,
    color: "#6ee7b7",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  rejectBtn: {
    padding: "8px 16px",
    background: "#450a0a",
    border: "1px solid #ef4444",
    borderRadius: 6,
    color: "#fca5a5",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  chatBtn: {
    padding: "8px 16px",
    background: "#1e2d45",
    border: "1px solid #3b82f6",
    borderRadius: 6,
    color: "#93c5fd",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  resolveBtn: {
    padding: "8px 16px",
    background: "#1e2d45",
    border: "1px solid #10b981",
    borderRadius: 6,
    color: "#6ee7b7",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
  },
  empty: { textAlign: "center", color: "#64748b", padding: "60px 20px" },
  emptyIcon: { fontSize: 40, marginBottom: 12 },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(2, 6, 23, 0.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 1000,
  },
  modalCard: {
    width: "100%",
    maxWidth: 760,
    maxHeight: "85vh",
    overflowY: "auto",
    background: "#0d1424",
    border: "1px solid #1e2d45",
    borderRadius: 14,
    padding: 24,
    boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
  },
  modalTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: "#e2e8f0",
  },
  modalCloseBtn: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    fontSize: 20,
    cursor: "pointer",
  },
  modalBody: { marginTop: 16 },
  modalSectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#64748b",
    marginBottom: 8,
    fontWeight: 700,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 1.7,
    color: "#cbd5e1",
    whiteSpace: "pre-wrap",
  },
  modalActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 20,
  },
  modalChatBox: {
    background: "#0a0f1e",
    border: "1px solid #1e2d45",
    borderRadius: 10,
    padding: 12,
    minHeight: 140,
    maxHeight: 240,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginBottom: 12,
  },

  chatEmpty: { textAlign: "center", color: "#64748b", padding: "40px 0", fontSize: 13 },
  bubble: { maxWidth: "72%", padding: "10px 14px", borderRadius: 10, fontSize: 13, lineHeight: 1.6 },
  bubbleLawyer: { alignSelf: "flex-end", background: "#1e3a5f", color: "#e2e8f0" },
  bubbleClient: { alignSelf: "flex-start", background: "#1e2d45", color: "#e2e8f0" },
  bubbleLabel: {
    fontSize: 10,
    color: "#64748b",
    marginBottom: 4,
    fontWeight: 600,
    textTransform: "uppercase",
  },
  caseInfoBar: {
    background: "#0a0f1e",
    border: "1px solid #1e2d45",
    borderRadius: 8,
    padding: "10px 14px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    fontSize: 12,
    flexWrap: "wrap",
  },
  chatInputRow: { display: "flex", gap: 10, paddingTop: 12, borderTop: "1px solid #1e2d45" },
  chatInput: {
    flex: 1,
    padding: "10px 14px",
    background: "#0d1424",
    border: "1px solid #1e2d45",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 13,
    outline: "none",
  },
  sendBtn: {
    padding: "10px 20px",
    background: "#1e3a5f",
    border: "none",
    borderRadius: 8,
    color: "#93c5fd",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  },

  assistantShell: { display: "flex", flexDirection: "column", height: "100vh", background: "#0d1424" },
  assistantHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid #1e2d45",
    flexShrink: 0,
  },
  assistantHeaderLeft: { display: "flex", alignItems: "center", gap: 10 },
  assistantTitle: { fontSize: 15, fontWeight: 700, color: "#e2e8f0" },
  assistantNote: { fontSize: 12, color: "#64748b" },
  chatbotDot: { width: 8, height: 8, borderRadius: "50%", background: "#10b981" },
  slmCaseBar: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: "14px 20px",
    borderBottom: "1px solid #1e2d45",
    background: "#0b1221",
  },
  slmCaseLabel: { fontSize: 12, color: "#94a3b8", fontWeight: 600 },
  slmCasePill: {
    border: "1px solid #1e2d45",
    background: "#12203a",
    color: "#e2e8f0",
    padding: "8px 12px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
  },
  slmCasePillActive: {
    background: "#4338ca",
    borderColor: "#4338ca",
    color: "#fff",
  },
  slmClearBtn: {
    marginLeft: "auto",
    border: "1px solid #1e2d45",
    background: "transparent",
    color: "#f8fafc",
    padding: "8px 12px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
  },

  assistantMessages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  chatMsg: { display: "flex", alignItems: "flex-start", gap: 10 },
  chatMsgBot: { flexDirection: "row" },
  chatMsgUser: { flexDirection: "row-reverse" },
  botAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#1e3a5f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    flexShrink: 0,
    marginTop: 2,
  },
  msgBubble: { maxWidth: "80%", padding: "10px 14px", borderRadius: 12, fontSize: 13, lineHeight: 1.65 },
  msgBubbleBot: {
    background: "#111827",
    border: "1px solid #1e2d45",
    color: "#e2e8f0",
    borderTopLeftRadius: 4,
  },
  msgBubbleUser: {
    background: "#1e3a5f",
    color: "#e2e8f0",
    borderTopRightRadius: 4,
  },
  typingDots: { fontSize: 22, letterSpacing: 3, color: "#64748b", lineHeight: 1 },

  assistantInputRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    padding: "12px 16px",
    borderTop: "1px solid #1e2d45",
    background: "#0d1424",
    flexShrink: 0,
  },
  assistantTextarea: {
    flex: 1,
    padding: "10px 14px",
    background: "#111827",
    border: "1px solid #1e2d45",
    borderRadius: 10,
    color: "#e2e8f0",
    fontSize: 13,
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
    lineHeight: 1.5,
  },
  assistantSendBtn: {
    padding: "10px 16px",
    background: "#1e3a5f",
    border: "none",
    borderRadius: 10,
    color: "#93c5fd",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  assistantSendBtnDisabled: { opacity: 0.4, cursor: "not-allowed" },

  // ── Voice styles ──────────────────────────────────────────────────────────
  micBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: "50%",
    border: "none",
    background: "transparent",
    color: "#64748b",
    cursor: "pointer",
    flexShrink: 0,
    transition: "background 0.2s, color 0.2s, transform 0.15s",
  },
  micBtnListening: {
    background: "rgba(232, 75, 75, 0.15)",
    color: "#e84b4b",
    animation: "mic-pulse 1.2s ease-in-out infinite",
  },
  voiceStatus: {
    fontSize: 11,
    color: "#e84b4b",
    textAlign: "center",
    padding: "4px 0 6px",
    letterSpacing: "0.03em",
    animation: "fade-in 0.3s ease",
  },
  // ──────────────────────────────────────────────────────────────────────────
}

// ── Voice CSS animations ───────────────────────────────────────────────────
const voiceStyles = /*
  @keyframes mic-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(232,75,75,0.4); }
    50%       { box-shadow: 0 0 0 8px rgba(232,75,75,0); }
  }

  .wave-bar {
    transform-origin: bottom center;
    animation: wave-bounce 0.7s ease-in-out infinite;
  }
  .bar1 { animation-delay: 0s;    }
  .bar2 { animation-delay: 0.1s;  }
  .bar3 { animation-delay: 0.2s;  }
  .bar4 { animation-delay: 0.3s;  }
  @keyframes wave-bounce {
    0%, 100% { transform: scaleY(0.5); opacity: 0.6; }
    50%       { transform: scaleY(1.0); opacity: 1;   }
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
*/
// ──────────────────────────────────────────────────────────────────────────

// export default function LawyerDashboard() {