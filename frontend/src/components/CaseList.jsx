import { useState, useEffect } from "react"

const STATUS_COLORS = {
  Open: "status-pending",
  Pending: "status-pending",
  "In Progress": "status-active",
  Matched: "status-active",
  Resolved: "status-resolved",
  Closed: "status-resolved",
  Rejected: "status-rejected",
}

const CIVIL_CASE_TYPES = [
  { value: "property",    label: "🏠 Property Disputes & Rent" },
  { value: "family",      label: "💍 Marriage, Divorce & Maintenance" },
  { value: "custody",     label: "👶 Child Custody & Adoption" },
  { value: "consumer",    label: "🛒 Consumer Rights & Contracts" },
  { value: "inheritance", label: "📜 Inheritance & Wills" },
]

const caseTypeLabel = (value) => {
  const match = CIVIL_CASE_TYPES.find((t) => t.value === value?.toLowerCase())
  if (match) return match.label.replace(/^\S+\s/, "") // strip emoji
  return value || "General"
}

// autoOpenModal — true when navigating from /client/new-case sidebar link
// onFindLawyer(caseType) — called when client clicks "Find Lawyer" on a case
export default function CaseList({ autoOpenModal = false, onFindLawyer }) {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(autoOpenModal)
  const [form, setForm] = useState({ title: "", description: "", case_type: "property" })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const token = localStorage.getItem("token")
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  useEffect(() => { fetchCases() }, [])

  async function fetchCases() {
    setLoading(true)
    try {
      const res = await fetch("http://127.0.0.1:8000/cases", { headers })
      const data = await res.json()
      setCases(Array.isArray(data) ? data : [])
    } catch {
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  async function submitCase(e) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError("")
    try {
      const res = await fetch("http://127.0.0.1:8000/cases", {
        method: "POST",
        headers,
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.detail || "Failed to submit case. Please try again.")
        return
      }
      setShowModal(false)
      setForm({ title: "", description: "", case_type: "property" })
      fetchCases()
    } catch {
      setSubmitError("Could not reach server. Make sure the backend is running.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="case-list">
      <div className="case-list-header">
        <h2 className="section-title">My Legal Cases</h2>
        <button className="btn-primary sm" onClick={() => setShowModal(true)}>+ New Case</button>
      </div>

      {loading ? (
        <div className="loading-state">Loading cases...</div>
      ) : cases.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <p>No cases yet. File a new case to get started.</p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>File a Case</button>
        </div>
      ) : (
        <div className="cases-stack">
          {cases.map((c) => (
            <div key={c.id} className="case-block">
              <div className="case-card-row">
                <div className="case-card-left">
                  <div className="case-card-top">
                    <span className="case-type-tag">{caseTypeLabel(c.case_type)}</span>
                    <span className={`status-badge ${STATUS_COLORS[c.status] || "status-pending"}`}>
                      {c.status}
                    </span>
                  </div>
                  <h3 className="case-title">{c.title}</h3>
                  <p className="case-desc">{c.description}</p>
                  {c.assigned_lawyer && (
                    <div className="case-lawyer">👨‍⚖️ Assigned: {c.assigned_lawyer}</div>
                  )}
                  <div className="case-id">Case #{c.id}</div>
                </div>

                <div className="case-card-actions">
                  {!c.assigned_lawyer && (
                    <button
                      className="btn-find-lawyer"
                      onClick={() => onFindLawyer && onFindLawyer(c.case_type)}
                    >
                      👨‍⚖️ Find Lawyer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>File a New Case</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={submitCase} className="modal-form">
              {submitError && (
                <div className="auth-error" style={{ marginBottom: "12px" }}>
                  ⚠️ {submitError}
                </div>
              )}
              <div className="field-group">
                <label>Case Title</label>
                <input
                  placeholder="e.g. Property Dispute – 123 Main St"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>
              <div className="field-group">
                <label>Case Type</label>
                <select
                  value={form.case_type}
                  onChange={(e) => setForm({ ...form, case_type: e.target.value })}
                >
                  {CIVIL_CASE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="field-group">
                <label>Brief Description</label>
                <textarea
                  placeholder="Describe your legal issue in detail..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowModal(false); setSubmitError("") }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Case"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}