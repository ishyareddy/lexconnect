import { useState, useEffect } from "react"

const STATUS_COLORS = {
  Pending: "status-pending",
  "In Progress": "status-active",
  Resolved: "status-resolved",
  Rejected: "status-rejected",
}

export default function LawyerCaseRequests() {
  const [all, setAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [tab, setTab] = useState("pending") // "pending" | "active" | "resolved"

  const token = localStorage.getItem("token")
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  useEffect(() => { fetchRequests() }, [])

  async function fetchRequests() {
    setLoading(true)
    try {
      const res = await fetch("http://127.0.0.1:8000/lawyer/cases", { headers })
      const data = await res.json()
      setAll(Array.isArray(data) ? data : [])
    } catch { setAll([]) }
    finally { setLoading(false) }
  }

  async function updateStatus(recId, caseId, newStatus) {
    setActionLoading((p) => ({ ...p, [recId]: newStatus }))
    try {
      await fetch(`http://127.0.0.1:8000/cases/${caseId}/status`, {
        method: "PATCH", headers,
        body: JSON.stringify({ status: newStatus }),
      })
      setAll((prev) =>
        prev.map((r) => r.id === recId ? { ...r, status: newStatus } : r)
      )
    } catch { alert("Action failed. Try again.") }
    finally { setActionLoading((p) => ({ ...p, [recId]: null })) }
  }

  const pending  = all.filter((r) => r.status === "Pending")
  const active   = all.filter((r) => r.status === "In Progress")
  const resolved = all.filter((r) => r.status === "Resolved" || r.status === "Rejected")

  const tabList = [
    { key: "pending",  label: "Requests",     count: pending.length,  items: pending },
    { key: "active",   label: "Active Cases",  count: active.length,   items: active },
    { key: "resolved", label: "Closed",        count: resolved.length, items: resolved },
  ]

  const current = tabList.find((t) => t.key === tab)

  return (
    <div className="case-list">
      {/* Header */}
      <div className="case-list-header">
        <h2 className="section-title">Case Management</h2>
        <button className="btn-secondary sm" onClick={fetchRequests}>↻ Refresh</button>
      </div>

      {/* Tabs */}
      <div className="lawyer-tabs">
        {tabList.map((t) => (
          <button
            key={t.key}
            className={`lawyer-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`tab-badge ${t.key === "pending" ? "badge-gold" : ""}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">Loading cases...</div>
      ) : current.items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            {tab === "pending" ? "📨" : tab === "active" ? "⚡" : "✅"}
          </div>
          <p>
            {tab === "pending"
              ? "No pending requests. Clients will appear here when they send requests."
              : tab === "active"
              ? "No active cases right now."
              : "No closed cases yet."}
          </p>
        </div>
      ) : (
        <div className="cases-stack">
          {current.items.map((r) => (
            <div key={r.id} className="case-block">
              <div className="case-card-row">
                <div className="case-card-left">
                  <div className="case-card-top">
                    <span className="case-type-tag">{r.case_type || "General"}</span>
                    <span className={`status-badge ${STATUS_COLORS[r.status] || "status-pending"}`}>
                      {r.status}
                    </span>
                  </div>
                  <h3 className="case-title">{r.title}</h3>
                  <p className="case-desc">{r.description}</p>
                  {r.client_name && (
                    <div className="case-lawyer">👤 Client: <strong>{r.client_name}</strong></div>
                  )}
                  <div className="case-id">Case #{r.case_id || r.id}</div>
                </div>

                {/* Action buttons */}
                <div className="case-card-actions">
                  {r.status === "Pending" && (
                    <>
                      <button
                        className="btn-accept"
                        disabled={!!actionLoading[r.id]}
                        onClick={() => updateStatus(r.id, r.case_id || r.id, "In Progress")}
                      >
                        {actionLoading[r.id] === "In Progress" ? "..." : "✓ Accept"}
                      </button>
                      <button
                        className="btn-reject"
                        disabled={!!actionLoading[r.id]}
                        onClick={() => updateStatus(r.id, r.case_id || r.id, "Rejected")}
                      >
                        {actionLoading[r.id] === "Rejected" ? "..." : "✕ Decline"}
                      </button>
                    </>
                  )}
                  {r.status === "In Progress" && (
                    <button
                      className="btn-resolve"
                      disabled={!!actionLoading[r.id]}
                      onClick={() => updateStatus(r.id, r.case_id || r.id, "Resolved")}
                    >
                      {actionLoading[r.id] === "Resolved" ? "..." : "✓ Mark Resolved"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}