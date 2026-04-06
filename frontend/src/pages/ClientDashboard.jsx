import { useState, useEffect, useCallback } from "react"
import Sidebar from "../components/Sidebar"
import Chatbot from "../components/Chatbot"
import CaseList from "../components/CaseList"
import LawyerRecommendations from "../components/LawyerRecommendations"
import CommunicationPanel from "../components/CommunicationPanel"

const TABS = ["My Cases", "Find Lawyers"]

export default function ClientDashboard({ defaultTab = "My Cases", openNewCase = false }) {
  const [tab, setTab] = useState(defaultTab)
  const [chatOpen, setChatOpen] = useState(true)
  const [selectedCaseId, setSelectedCaseId] = useState(null)
  // cases fetched here so Chatbot can reference them by ID
  const [cases, setCases] = useState([])
  const [showCommunication, setShowCommunication] = useState(false)
  const [communicationPartner, setCommunicationPartner] = useState(null)
  const name = localStorage.getItem("name") || "Client"
  const token = localStorage.getItem("token")

  useEffect(() => {
    setTab(defaultTab)
  }, [defaultTab])

  // Fetch cases once on mount so Chatbot has them available
  useEffect(() => {
    if (!token) return
    fetch("http://127.0.0.1:8000/cases", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((r) => r.json())
      .then((d) => setCases(Array.isArray(d) ? d : []))
      .catch(() => setCases([]))
  }, [token])

  const handleFindLawyer = useCallback((caseType, caseId) => {
  setSelectedCaseId(caseId || null)
  setTab("Find Lawyers")
  }, [])

  const handleChatWithLawyer = useCallback((lawyerId, lawyerName, caseId) => {
    setCommunicationPartner({
      userId: lawyerId,
      userName: lawyerName,
      caseId: caseId,
    })
    setShowCommunication(true)
  }, [])

  // When CaseList creates a new case, refresh the cases list for Chatbot
  const handleCasesRefreshed = useCallback((updatedCases) => {
    if (Array.isArray(updatedCases)) setCases(updatedCases)
  }, [])

  return (
    <div className="dashboard">
      <Sidebar role="client" />
      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <div>
            <h1 className="dashboard-greeting">Welcome back, {name} 👋</h1>
            <p className="dashboard-sub">Manage your cases and connect with advocates</p>
          </div>
          <button className="chat-toggle-btn" onClick={() => setChatOpen(!chatOpen)}>
            {chatOpen ? "Hide Assistant" : "🤖 AI Assistant"}
          </button>
        </div>

        <div className="tab-bar">
          {TABS.map((t) => (
            <button
              key={t}
              className={`tab-btn ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="dashboard-content">
          <div className="dashboard-panel">
            {tab === "My Cases" && (
              <CaseList
                key={openNewCase ? "new" : "default"}
                autoOpenModal={openNewCase}
                onFindLawyer={handleFindLawyer}
                onCasesLoaded={handleCasesRefreshed}
                onChatWithLawyer={handleChatWithLawyer}
              />
            )}
            {tab === "Find Lawyers" && (
              <LawyerRecommendations caseId={selectedCaseId} />
            )}
          </div>
          {chatOpen && (
            <div className="dashboard-chat">
              <Chatbot cases={cases} />
            </div>
          )}
        </div>
      </div>

      {showCommunication && communicationPartner && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000,
          padding: "20px"
        }}>
          <div style={{
            width: "100%",
            maxWidth: "900px",
            height: "80vh",
            borderRadius: "12px",
            background: "white",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)"
          }}>
            <CommunicationPanel
              caseId={communicationPartner.caseId}
              otherUserId={communicationPartner.userId}
              otherUserName={communicationPartner.userName}
              onClose={() => {
                setShowCommunication(false)
                setCommunicationPartner(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}