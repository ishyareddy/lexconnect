import { useState, useEffect, useCallback } from "react"
import Sidebar from "../components/Sidebar"
import Chatbot from "../components/Chatbot"
import CaseList from "../components/CaseList"
import LawyerRecommendations from "../components/LawyerRecommendations"

const TABS = ["My Cases", "Find Lawyers"]

export default function ClientDashboard({ defaultTab = "My Cases", openNewCase = false }) {
  const [tab, setTab] = useState(defaultTab)
  const [chatOpen, setChatOpen] = useState(true)
  const [lawyerFilter, setLawyerFilter] = useState("all")
  // cases fetched here so Chatbot can reference them by ID
  const [cases, setCases] = useState([])
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

  const handleFindLawyer = useCallback((caseType) => {
    setLawyerFilter(caseType || "all")
    setTab("Find Lawyers")
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
              />
            )}
            {tab === "Find Lawyers" && (
              <LawyerRecommendations
                filterType={lawyerFilter}
                onFilterChange={setLawyerFilter}
              />
            )}
          </div>
          {chatOpen && (
            <div className="dashboard-chat">
              <Chatbot cases={cases} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}