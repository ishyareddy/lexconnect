import { useState } from "react"
import ChatWindow from "./ChatWindow"
import VideoCallComponent from "./VideoCall"
import "../styles/CommunicationPanel.css"

export default function CommunicationPanel({ 
  caseId, 
  cases = [],
  otherUserId, 
  otherUserName,
  onClose 
}) {
  const [activeTab, setActiveTab] = useState("chat") // chat or video

  return (
    <div className="communication-panel">
      <div className="panel-header">
        <h2>Communication with {otherUserName}</h2>
        <button onClick={onClose} className="btn-close">✕</button>
      </div>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          💬 Chat
        </button>
        <button
          className={`tab-button ${activeTab === "video" ? "active" : ""}`}
          onClick={() => setActiveTab("video")}
        >
          📹 Video Call
        </button>
      </div>

      <div className="panel-content">
        {activeTab === "chat" && (
          <ChatWindow 
            caseId={caseId}
            cases={cases}
            otherUserId={otherUserId}
            otherUserName={otherUserName}
          />
        )}
        {activeTab === "video" && (
          <VideoCallComponent
            caseId={caseId}
            otherUserId={otherUserId}
            otherUserName={otherUserName}
            onClose={() => setActiveTab("chat")}
          />
        )}
      </div>
    </div>
  )
}
