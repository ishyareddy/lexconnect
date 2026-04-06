import { useState, useEffect, useRef } from "react"
import "../styles/ChatWindow.css"
import MessageNotification from "./MessageNotification"

export default function ChatWindow({ caseId, cases = [], otherUserId, otherUserName }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [newMessageNotification, setNewMessageNotification] = useState(null)
  const [lastMessageId, setLastMessageId] = useState(null)
  const [activeCaseId, setActiveCaseId] = useState(caseId || null)
  const messagesEndRef = useRef(null)
  const token = localStorage.getItem("token")
  const userId = parseInt(token)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    setActiveCaseId(caseId || null)
  }, [caseId])

  useEffect(() => {
    console.log("ChatWindow mounted with:", { caseId, activeCaseId, otherUserId, userId, token })
    if (!otherUserId || !token) {
      console.warn("Missing otherUserId or token", { otherUserId, token })
      return
    }

    const fetchMessages = async () => {
      try {
        const url = new URL("http://127.0.0.1:8000/messages/conversation/" + otherUserId)
        if (activeCaseId) {
          url.searchParams.append("case_id", activeCaseId)
        }

        console.log("Fetching messages from:", url.toString())
        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (response.ok) {
          const data = await response.json()
          console.log("Fetched messages:", data)
          
          // Detect new incoming messages for notifications
          if (data.length > 0) {
            const latestMessage = data[data.length - 1]
            // Check if this is a new message (different ID than last tracked)
            // and it's from the other user (incoming, not sent by current user)
            if (lastMessageId !== latestMessage.id && latestMessage.sender_id !== userId) {
              console.log("New incoming message detected:", latestMessage)
              setNewMessageNotification(latestMessage)
              setLastMessageId(latestMessage.id)
            } else if (lastMessageId === null && data.length > 0) {
              // Initialize last message ID on first fetch
              setLastMessageId(latestMessage.id)
            }
          }
          
          setMessages(data)
        } else {
          console.error("Failed to fetch messages:", response.status, response.statusText)
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error)
      }
    }

    fetchMessages()
    const interval = setInterval(fetchMessages, 1000)  // Poll every 1 second for real-time feel
    return () => clearInterval(interval)
  }, [otherUserId, activeCaseId, token, userId, lastMessageId])

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    console.log("Sending message:", { otherUserId, activeCaseId, content: input })
    setLoading(true)
    try {
      const response = await fetch("http://127.0.0.1:8000/messages/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient_id: otherUserId,
          content: input,
          case_id: activeCaseId || null,
        }),
      })

      if (response.ok) {
        const newMessage = await response.json()
        console.log("Message sent successfully:", newMessage)
        setMessages([...messages, newMessage])
        setInput("")
      } else {
        const error = await response.json()
        console.error("Failed to send message:", error)
        alert("Failed to send message: " + (error.detail || response.statusText))
      }
    } catch (error) {
      console.error("Failed to send message:", error)
      alert("Error sending message: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h3>Chat with {otherUserName}</h3>
      </div>

      <div className="messages-container">
        <div className="case-context-bar">
        <div className="case-context-label">Case context:</div>
        <button
          className={`case-pill${activeCaseId === null ? " active" : ""}`}
          onClick={() => setActiveCaseId(null)}
        >
          All Cases
        </button>
        {cases.map((c) => {
          const id = c.case_id || c.id
          const title = c.title || `Case #${id}`
          return (
            <button
              key={id}
              className={`case-pill${activeCaseId === id ? " active" : ""}`}
              onClick={() => setActiveCaseId(id)}
            >
              {title}
            </button>
          )
        })}
        {activeCaseId && (
          <button className="clear-context" onClick={() => setActiveCaseId(null)}>
            Clear
          </button>
        )}
      </div>

      {messages.length === 0 ? (
          <div className="no-messages">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.sender_id === userId ? "sent" : "received"}`}
            >
              <div className="message-header">
                <span className="sender-name">{msg.sender_name}</span>
                <span className="timestamp">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">{msg.content}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="message-input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? "Sending..." : "Send"}
        </button>
      </form>

      {newMessageNotification && (
        <MessageNotification
          message={newMessageNotification}
          otherUserName={otherUserName}
          onDismiss={() => setNewMessageNotification(null)}
        />
      )}
    </div>
  )
}
