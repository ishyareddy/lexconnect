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
const initialBotText = "Hello! I'm your AI legal assistant. Ask me anything about your case, legal procedures, or lawyer recommendations."

export default function Chatbot({ cases = [] }) {
  const [message, setMessage] = useState("")
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem("legal_chat_history")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.length > 0 ? parsed : [{
          id: Date.now(),
          title: "New Chat",
          messages: [{ role: "bot", text: initialBotText }],
          activeCaseId: null,
          createdAt: new Date().toISOString()
        }]
      } catch {
        return [{
          id: Date.now(),
          title: "New Chat",
          messages: [{ role: "bot", text: initialBotText }],
          activeCaseId: null,
          createdAt: new Date().toISOString()
        }]
      }
    }
    return [{
      id: Date.now(),
      title: "New Chat",
      messages: [{ role: "bot", text: initialBotText }],
      activeCaseId: null,
      createdAt: new Date().toISOString()
    }]
  })
  const [currentChatId, setCurrentChatId] = useState(() => chats[0]?.id || null)
  const [loading, setLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [editingChatId, setEditingChatId] = useState(null)
  const [editTitle, setEditTitle] = useState("")
  const bottomRef = useRef(null)

  useEffect(() => {
    localStorage.setItem("legal_chat_history", JSON.stringify(chats))
  }, [chats])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chats, currentChatId])

  const currentChat = chats.find(c => c.id === currentChatId) || chats[0]
  const activeCase = cases.find((c) => c.id === currentChat?.activeCaseId) || null

  const sendMessage = async () => {
    if (!message.trim() || loading || !currentChat) return
    const userMsg = message.trim()
    setMessage("")

    // Auto-detect case reference in the message
    const mentionedCaseId = extractCaseId(userMsg)
    let resolvedCaseId = currentChat.activeCaseId

    if (mentionedCaseId !== null) {
      const exists = cases.find((c) => c.id === mentionedCaseId)
      if (exists) {
        resolvedCaseId = mentionedCaseId
      } else {
        setChats(prev => prev.map(chat =>
          chat.id === currentChatId
            ? { ...chat, messages: [...chat.messages, { role: "user", text: userMsg }, {
                role: "bot",
                text: `I couldn't find Case #${mentionedCaseId} in your cases. Please check the case number and try again.`,
              }] }
            : chat
        ))
        return
      }
    }

    // Update chat with user message
    setChats(prev => prev.map(chat =>
      chat.id === currentChatId
        ? { ...chat, messages: [...chat.messages, { role: "user", text: userMsg }], activeCaseId: resolvedCaseId }
        : chat
    ))

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

      // Update chat with bot response
      setChats(prev => prev.map(chat =>
        chat.id === currentChatId
          ? { ...chat, messages: [...chat.messages, { role: "bot", text: reply }] }
          : chat
      ))
    } catch (err) {
      const msg = err.message?.includes("Failed to fetch")
        ? "Cannot reach the server. Make sure the backend is running on port 8000."
        : `Error: ${err.message}`
      setChats(prev => prev.map(chat =>
        chat.id === currentChatId
          ? { ...chat, messages: [...chat.messages, { role: "bot", text: msg }] }
          : chat
      ))
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
    setChats(prev => prev.map(chat =>
      chat.id === currentChatId
        ? { ...chat, activeCaseId: null }
        : chat
    ))
    setMessage((prev) => {
      return prev.trim().match(/^Based on case #?\d+[,:]?\s*/i) ? "" : prev
    })
    setChats(prev => prev.map(chat =>
      chat.id === currentChatId
        ? { ...chat, messages: [...chat.messages, { role: "bot", text: "Case context cleared. Ask me anything about Indian civil law." }] }
        : chat
    ))
  }

  const startNewChat = () => {
    const newChatId = Date.now()
    const newChat = {
      id: newChatId,
      title: "New Chat",
      messages: [{ role: "bot", text: initialBotText }],
      activeCaseId: null,
      createdAt: new Date().toISOString()
    }
    setChats(prev => [newChat, ...prev])
    setCurrentChatId(newChatId)
    setMessage("")
  }

  const switchChat = (chatId) => {
    setCurrentChatId(chatId)
    setMessage("")
  }

  const deleteChat = (chatId) => {
    if (chats.length <= 1) return // Don't delete the last chat
    setChats(prev => prev.filter(chat => chat.id !== chatId))
    if (currentChatId === chatId) {
      const remainingChats = chats.filter(chat => chat.id !== chatId)
      setCurrentChatId(remainingChats[0]?.id || null)
    }
  }

  const startEditingChat = (chatId, currentTitle) => {
    setEditingChatId(chatId)
    setEditTitle(currentTitle)
  }

  const saveChatTitle = () => {
    if (editTitle.trim()) {
      setChats(prev => prev.map(chat =>
        chat.id === editingChatId
          ? { ...chat, title: editTitle.trim() }
          : chat
      ))
    }
    setEditingChatId(null)
    setEditTitle("")
  }

  const cancelEdit = () => {
    setEditingChatId(null)
    setEditTitle("")
  }

  return (
    <div className="chatbot-container">
      {/* Chat History Sidebar */}
      {showHistory && (
        <div className="chat-history-sidebar">
          <div className="history-header">
            <h3>Chat History</h3>
            <button className="close-sidebar" onClick={() => setShowHistory(false)}>✕</button>
          </div>
          <div className="history-list">
            {chats.map((chat) => (
              <div key={chat.id} className={`history-item ${chat.id === currentChatId ? 'active' : ''}`}>
                {editingChatId === chat.id ? (
                  <div className="edit-title">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveChatTitle()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      autoFocus
                    />
                    <button onClick={saveChatTitle}>✓</button>
                    <button onClick={cancelEdit}>✕</button>
                  </div>
                ) : (
                  <div className="chat-title" onClick={() => switchChat(chat.id)}>
                    <span className="title-text">{chat.title}</span>
                    <div className="chat-actions">
                      <button
                        className="edit-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditingChat(chat.id, chat.title)
                        }}
                        title="Rename chat"
                      >
                        ✏️
                      </button>
                      <button
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteChat(chat.id)
                        }}
                        title="Delete chat"
                        disabled={chats.length <= 1}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
                <div className="chat-preview">
                  {chat.messages.length > 1
                    ? `${chat.messages[1]?.text?.slice(0, 50) || 'New chat'}...`
                    : 'New chat'
                  }
                </div>
                <div className="chat-date">
                  {new Date(chat.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="chatbot">
        <div className="chatbot-header">
          <div>
            <button className="history-toggle" onClick={() => setShowHistory(!showHistory)}>
              ☰
            </button>
            <div className="chatbot-dot" />
            <span>AI Legal Assistant</span>
            {currentChat?.title && currentChat.title !== "New Chat" && (
              <span className="current-chat-title"> - {currentChat.title}</span>
            )}
          </div>
          <div className="chatbot-actions">
            <button className="chatbot-btn secondary" onClick={startNewChat}>
              New chat
            </button>
          </div>
        </div>

      {/* Active case banner */}
      {activeCase && (
        <div className="chatbot-case-banner">
          <span>
            📁 <strong>Case {activeCase.id}</strong>: {" "}
            {(activeCase.title || activeCase.description || "").slice(0, 45)}
            {(activeCase.title || activeCase.description || "").length > 45 ? "…" : ""}
          </span>
          <button className="chatbot-clear-case" onClick={clearCaseContext} title="Clear case context">
            ✕
          </button>
        </div>
      )}

      <div className="chatbot-messages">
        {currentChat?.messages.map((c, i) => (
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

      {/* Case context pills */}
      {cases.length > 0 && (
        <div className="chatbot-case-pills" style={{ overflowX: "auto" }}>
          <span className="pills-label">Ask about a case:</span>
          {cases.map((c) => {
            const isActive = c.id === currentChat?.activeCaseId
            return (
              <button
                key={c.id}
                className={`case-pill${isActive ? " active" : ""}`}
                onClick={() => {
                  if (isActive) {
                    clearCaseContext()
                  } else {
                    setChats(prev => prev.map(chat =>
                      chat.id === currentChatId
                        ? { ...chat, activeCaseId: c.id }
                        : chat
                    ))
                    setMessage(`Based on case ${c.id}, `)
                  }
                }}
              >
                Case {c.id}
              </button>
            )
          })}
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
    </div>
  )
}