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
  if (match) return match.label.replace(/^\S+\s/, "")
  return value || "General"
}

const caseTypeEmoji = (value) => {
  const match = CIVIL_CASE_TYPES.find((t) => t.value === value?.toLowerCase())
  return match ? match.label.split(" ")[0] : "📁"
}

const formatDate = (iso) => {
  if (!iso) return "Unknown date"
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  })
}

export default function CaseList({ autoOpenModal = false, onFindLawyer, onCasesLoaded }) {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)

  // New case modal
  const [showNewModal, setShowNewModal] = useState(autoOpenModal)
  const [form, setForm] = useState({ title: "", description: "", case_type: "property" })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  // Detail modal
  const [detailCase, setDetailCase] = useState(null)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null) // case id pending deletion
  const [deleting, setDeleting] = useState(false)

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
      const list = Array.isArray(data) ? data : []
      setCases(list)
      // Notify parent (ClientDashboard) so Chatbot gets the updated list
      if (onCasesLoaded) onCasesLoaded(list)
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
      setShowNewModal(false)
      setForm({ title: "", description: "", case_type: "property" })
      fetchCases()
    } catch {
      setSubmitError("Could not reach server. Make sure the backend is running.")
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`http://127.0.0.1:8000/cases/${deleteTarget}`, {
        method: "DELETE",
        headers,
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.detail || "Could not delete case.")
        return
      }
      setCases((prev) => prev.filter((c) => c.id !== deleteTarget))
      // If the detail modal was showing this case, close it
      if (detailCase?.id === deleteTarget) setDetailCase(null)
    } catch {
      alert("Could not reach server.")
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="case-list">
      <div className="case-list-header">
        <h2 className="section-title">My Legal Cases</h2>
        <button className="btn-primary sm" onClick={() => setShowNewModal(true)}>+ New Case</button>
      </div>

      {loading ? (
        <div className="loading-state">Loading cases...</div>
      ) : cases.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <p>No cases yet. File a new case to get started.</p>
          <button className="btn-primary" onClick={() => setShowNewModal(true)}>File a Case</button>
        </div>
      ) : (
        <div className="cases-stack">
          {cases.map((c) => (
            <div key={c.id} className="case-block">
              <div
                className="case-card-row"
                style={{ cursor: "pointer" }}
                onClick={() => setDetailCase(c)}
              >
                <div className="case-card-left">
                  <div className="case-card-top">
                    <span className="case-type-tag">{caseTypeLabel(c.case_type)}</span>
                    <span className={`status-badge ${STATUS_COLORS[c.status] || "status-pending"}`}>
                      {c.status}
                    </span>
                  </div>
                  <h3 className="case-title">{c.title}</h3>
                  <p className="case-desc">{c.description?.slice(0, 100)}{c.description?.length > 100 ? "…" : ""}</p>
                  {c.assigned_lawyer && (
                    <div className="case-lawyer">👨‍⚖️ Assigned: {c.assigned_lawyer}</div>
                  )}
                  <div className="case-id">Case #{c.id}</div>
                </div>

                <div className="case-card-actions" onClick={(e) => e.stopPropagation()}>
                  {!c.assigned_lawyer && (
                    <button
                      className="btn-find-lawyer"
                      onClick={() => onFindLawyer && onFindLawyer(c.case_type)}
                    >
                      👨‍⚖️ Find Lawyer
                    </button>
                  )}
                  <button
                    className="btn-delete-case"
                    title="Delete case"
                    onClick={() => setDeleteTarget(c.id)}
                    style={{
                      marginTop: "8px",
                      background: "transparent",
                      border: "1px solid rgba(239,68,68,0.4)",
                      color: "#ef4444",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      cursor: "pointer",
                      fontSize: "12px",
                      width: "100%",
                    }}
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Case Detail Modal ─────────────────────────────────────────── */}
      {detailCase && (
        <div className="modal-overlay" onClick={() => setDetailCase(null)}>
          <div className="modal" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {caseTypeEmoji(detailCase.case_type)}&nbsp;
                Case #{detailCase.id} — Details
              </h3>
              <button className="modal-close" onClick={() => setDetailCase(null)}>✕</button>
            </div>

            <div style={{ padding: "0 4px 4px" }}>
              {/* Status row */}
              <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px", flexWrap: "wrap" }}>
                <span className="case-type-tag">{caseTypeLabel(detailCase.case_type)}</span>
                <span className={`status-badge ${STATUS_COLORS[detailCase.status] || "status-pending"}`}>
                  {detailCase.status}
                </span>
                {detailCase.created_at && (
                  <span style={{ fontSize: "12px", color: "var(--text-muted, #8899aa)", marginLeft: "auto" }}>
                    📅 Filed: {formatDate(detailCase.created_at)}
                  </span>
                )}
              </div>

              {/* Title */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted, #8899aa)", marginBottom: "4px" }}>
                  Case Title
                </div>
                <div style={{ fontWeight: 600, fontSize: "16px" }}>{detailCase.title}</div>
              </div>

              {/* Full description */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted, #8899aa)", marginBottom: "4px" }}>
                  Description
                </div>
                <div style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: "8px",
                  padding: "12px",
                  fontSize: "14px",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}>
                  {detailCase.description}
                </div>
              </div>

              {/* Assigned lawyer */}
              {detailCase.assigned_lawyer && (
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted, #8899aa)", marginBottom: "4px" }}>
                    Assigned Advocate
                  </div>
                  <div style={{ fontWeight: 600 }}>👨‍⚖️ {detailCase.assigned_lawyer}</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="modal-actions" style={{ marginTop: "8px" }}>
              <button
                className="btn-secondary"
                style={{ borderColor: "rgba(239,68,68,0.5)", color: "#ef4444" }}
                onClick={() => { setDeleteTarget(detailCase.id); setDetailCase(null) }}
              >
                🗑 Delete Case
              </button>
              {!detailCase.assigned_lawyer && (
                <button
                  className="btn-primary"
                  onClick={() => { setDetailCase(null); onFindLawyer && onFindLawyer(detailCase.case_type) }}
                >
                  👨‍⚖️ Find Lawyer
                </button>
              )}
              <button className="btn-secondary" onClick={() => setDetailCase(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────────────────── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal" style={{ maxWidth: "380px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🗑 Delete Case</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)} disabled={deleting}>✕</button>
            </div>
            <p style={{ padding: "0 4px 16px", lineHeight: "1.6", color: "var(--text-muted, #aab)" }}>
              Are you sure you want to delete <strong>Case #{deleteTarget}</strong>?
              This will also remove all lawyer requests linked to it.
              <br /><br />
              <span style={{ color: "#ef4444", fontWeight: 600 }}>This cannot be undone.</span>
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ background: "#ef4444", borderColor: "#ef4444" }}
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Case Modal ────────────────────────────────────────────── */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>File a New Case</h3>
              <button className="modal-close" onClick={() => setShowNewModal(false)}>✕</button>
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
                  onClick={() => { setShowNewModal(false); setSubmitError("") }}
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