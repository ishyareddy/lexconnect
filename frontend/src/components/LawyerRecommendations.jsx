import { useState, useEffect, useMemo } from "react"

const SPEC_ICONS = {
  "Property Disputes & Rent": "🏠",
  "Marriage, Divorce & Maintenance": "👨‍👩‍👧",
  "Child Custody & Adoption": "👶",
  "Consumer Rights & Contracts": "📋",
  "Inheritance & Wills": "📜",
}

export default function LawyerRecommendations({ caseId }) {
  const [lawyers, setLawyers] = useState([])
  const [loading, setLoading] = useState(true)
  const [requestedId, setRequestedId] = useState(null)
  const [requesting, setRequesting] = useState(false)

  const token = localStorage.getItem("token")

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  )

  useEffect(() => {
    if (!caseId) {
      setLawyers([])
      setLoading(false)
      return
    }

    setLoading(true)

    fetch(`http://127.0.0.1:8000/cases/${caseId}/recommendations`, {
      method: "POST",
      headers,
    })
      .then((r) => r.json())
      .then((d) => setLawyers(Array.isArray(d.recommendations) ? d.recommendations : []))
      .catch(() => setLawyers([]))
      .finally(() => setLoading(false))
  }, [caseId, headers])

  async function requestLawyer(lawyerId) {
    if (requesting || requestedId !== null) return

    if (!caseId) {
      alert("Please select a case first.")
      return
    }

    setRequesting(true)

    try {
      const res = await fetch("http://127.0.0.1:8000/request-lawyer", {
        method: "POST",
        headers,
        body: JSON.stringify({
          lawyer_id: lawyerId,
          case_id: caseId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.detail || "Request failed. Make sure you have an open case first.")
        return
      }

      setRequestedId(lawyerId)
    } catch {
      alert("Request failed. Try again.")
    } finally {
      setRequesting(false)
    }
  }

  return (
    <div className="lawyer-list">
      <div className="case-list-header">
        <h2 className="section-title">Find an Advocate</h2>
        <span className="lawyer-count">{lawyers.length} available</span>
      </div>

      {loading ? (
        <div className="loading-state">Finding advocates...</div>
      ) : lawyers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👨‍⚖️</div>
          <p>No advocates available at the moment.</p>
        </div>
      ) : (
        <div className="lawyers-grid">
          {lawyers.map((l, idx) => {
            const rating = l.rating || 0
            const exp = l.experience_years || l.experience || 0
            const spec = l.specialization || "General"

            return (
              <div key={l.id} className="lawyer-card">
                {idx < 3 && (
                  <div className={`lawyer-rank rank-${idx + 1}`}>
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
                  </div>
                )}

                <div className="lawyer-avatar">
                  {(l.name || "A").charAt(0).toUpperCase()}
                </div>

                <div className="lawyer-info">
                  <h3 className="lawyer-name">{l.name}</h3>
                  <p className="lawyer-spec">
                    {SPEC_ICONS[spec] || "📜"} {spec}
                  </p>

                  <div className="lawyer-meta-row">
                    {rating > 0 && (
                      <span className="lawyer-rating">
                        {"⭐".repeat(Math.min(Math.round(rating), 5))}
                        <span className="rating-num"> {rating}/5</span>
                      </span>
                    )}

                    {exp > 0 && (
                      <span className="lawyer-exp">🗓 {exp} yrs</span>
                    )}

                    {l.city && (
                      <span className="lawyer-city">📍 {l.city}</span>
                    )}
                  </div>
                </div>

                <button
                  className={`btn-request ${requestedId === l.id ? "requested" : ""}`}
                  onClick={() => requestLawyer(l.id)}
                  disabled={requesting || requestedId !== null}
                  title={
                    requestedId !== null && requestedId !== l.id
                      ? "You have already sent a request"
                      : ""
                  }
                >
                  {requesting && requestedId === null
                    ? "..."
                    : requestedId === l.id
                    ? "✓ Requested"
                    : "Request"}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}