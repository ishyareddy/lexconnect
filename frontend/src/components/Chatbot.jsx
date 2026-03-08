import { useState, useRef, useEffect } from "react"

function renderMarkdown(text) {
  if (!text) return null

  const normalised = text
    .replace(/\r\n/g, "\n")
    .replace(/\n(\d+\.|-|\*)\s/g, "\n\n$1 ")

  const blocks = normalised.split(/\n{2,}/).filter(Boolean)

  // Merge consecutive numbered-list blocks into one <ol> with correct start
  const merged = []
  let i = 0
  while (i < blocks.length) {
    const trimmed = blocks[i].trim()
    if (/^\d+\.\s/.test(trimmed)) {
      // Collect all consecutive numbered blocks
      const items = []
      while (i < blocks.length && /^\d+\.\s/.test(blocks[i].trim())) {
        // Each block may itself contain multiple lines that are list items
        blocks[i].trim().split(/\n/).filter(Boolean).forEach((line) => {
          const m = line.match(/^(\d+)\.\s*(.*)/)
          if (m) items.push({ num: parseInt(m[1], 10), text: m[2] })
        })
        i++
      }
      const startNum = items[0]?.num ?? 1
      merged.push(
        <ol key={`ol-${i}`} start={startNum}>
          {items.map((item, idx) => (
            <li key={idx} value={item.num}>{inlineFormat(item.text)}</li>
          ))}
        </ol>
      )
    } else if (/^[-*]\s/.test(trimmed)) {
      merged.push(
        <ul key={`ul-${i}`}>
          {trimmed.split(/\n/).filter(Boolean).map((item, ii) => (
            <li key={ii}>{inlineFormat(item.replace(/^[-*]\s*/, ""))}</li>
          ))}
        </ul>
      )
      i++
    } else {
      merged.push(<p key={`p-${i}`}>{inlineFormat(trimmed)}</p>)
      i++
    }
  }
  return merged
}

function inlineFormat(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

/** Detects "case 4", "case #4", "case no 4", "case number 4" in a message. */
function extractCaseId(message) {
  const match = message.match(/case\s*#?\s*(?:no\.?\s*|number\s*)?(\d+)/i)
  return match ? parseInt(match[1], 10) : null
}

// cases prop: array of { id, title, description, case_type } passed from ClientDashboard
export default function Chatbot({ cases = [] }) {
  const [message, setMessage] = useState("")
  const [chat, setChat] = useState([
    {
      role: "bot",
      text: "Hello! I'm your AI legal assistant. Ask me anything about your case, legal procedures, or lawyer recommendations.",
    },
  ])
  const [loading, setLoading] = useState(false)
  const [activeCaseId, setActiveCaseId] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat])

  const activeCase = cases.find((c) => c.id === activeCaseId) || null

  const sendMessage = async () => {
    if (!message.trim() || loading) return
    const userMsg = message.trim()
    setMessage("")

    // Auto-detect case reference in the message
    const mentionedCaseId = extractCaseId(userMsg)
    let resolvedCaseId = activeCaseId

    if (mentionedCaseId !== null) {
      const exists = cases.find((c) => c.id === mentionedCaseId)
      if (exists) {
        resolvedCaseId = mentionedCaseId
        setActiveCaseId(mentionedCaseId)
      } else {
        setChat((prev) => [
          ...prev,
          { role: "user", text: userMsg },
          {
            role: "bot",
            text: `I couldn't find Case #${mentionedCaseId} in your cases. Please check the case number and try again.`,
          },
        ])
        return
      }
    }

    setChat((prev) => [...prev, { role: "user", text: userMsg }])
    setLoading(true)

    try {
      const body = {
        message: userMsg,
        use_case_context: false,
        ...(resolvedCaseId !== null ? { case_id: resolvedCaseId } : {}),
      }

      const res = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }
      const data = await res.json()
      const reply = data.answer?.trim() || "I'm unable to process that right now."
      setChat((prev) => [...prev, { role: "bot", text: reply }])
    } catch (err) {
      const msg = err.message?.includes("Failed to fetch")
        ? "Cannot reach the server. Make sure the backend is running on port 8000."
        : `Error: ${err.message}`
      setChat((prev) => [...prev, { role: "bot", text: msg }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearCaseContext = () => {
    setActiveCaseId(null)
    setChat((prev) => [
      ...prev,
      { role: "bot", text: "Case context cleared. Ask me anything about Indian civil law." },
    ])
  }

  return (
    <div className="chatbot">
      <div className="chatbot-header">
        <div className="chatbot-dot" />
        <span>AI Legal Assistant</span>
      </div>

      {/* Active case banner */}
      {activeCase && (
        <div className="chatbot-case-banner">
          <span>
            📁 <strong>Case #{activeCase.id}</strong>:{" "}
            {(activeCase.title || activeCase.description || "").slice(0, 45)}
            {(activeCase.title || activeCase.description || "").length > 45 ? "…" : ""}
          </span>
          <button className="chatbot-clear-case" onClick={clearCaseContext} title="Clear case context">
            ✕
          </button>
        </div>
      )}

      <div className="chatbot-messages">
        {chat.map((c, i) => (
          <div key={i} className={`chat-msg ${c.role}`}>
            {c.role === "bot" && <div className="bot-avatar">⚖️</div>}
            <div className="msg-bubble">
              {c.role === "bot" ? renderMarkdown(c.text) : c.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg bot">
            <div className="bot-avatar">⚖️</div>
            <div className="msg-bubble typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick-select case pills — shown only when no active case */}
      {cases.length > 0 && !activeCase && (
        <div className="chatbot-case-pills" style={{ overflowX: "auto", flexWrap: "nowrap" }}>
          <span className="pills-label" style={{ whiteSpace: "nowrap" }}>Ask about a case:</span>
          {cases.map((c) => (
            <button
              key={c.id}
              className="case-pill"
              style={{ whiteSpace: "nowrap", flexShrink: 0 }}
              onClick={() => {
                setActiveCaseId(c.id)
                setMessage(`Based on case #${c.id}, `)
              }}
            >
              Case #{c.id}
            </button>
          ))}
        </div>
      )}

      <div className="chatbot-input">
        <textarea
          placeholder="Ask about your case, legal rights, procedures..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
        />
        <button onClick={sendMessage} disabled={!message.trim() || loading} className="send-btn">
          ➤
        </button>
      </div>
    </div>
  )
}