import { useState, useEffect } from "react"

const SPEC_ICONS = {
  "Civil Law": "⚖️",
  "Property Disputes": "🏠",
  "Property Law": "🏠",
  "Criminal Law": "🔒",
  "Family Law": "👨‍👩‍👧",
  "Corporate Law": "🏢",
  "Tax Law": "📊",
  "General": "📜",
}

export default function LawyerRecommendations() {
  const [lawyers, setLawyers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")

  // ✅ Single request enforcement:
  // requestedId tracks which ONE lawyer has been requested (null = none yet)
  // Once set, all other buttons become disabled and show their normal label
  const [requestedId, setRequestedId] = useState(null)
  const [requesting, setRequesting] = useState(false)

  const token = localStorage.getItem("token")
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  useEffect(() => {
    fetch("http://127.0.0.1:8000/lawyers", { headers })
      .then((r) => r.json())
      .then((d) => setLawyers(Array.isArray(d) ? d : []))
      .catch(() => setLawyers([]))
      .finally(() => setLoading(false))
  }, [])

  async function requestLawyer(lawyerId) {
    if (requestedId !== null) return  // already sent one request
    setRequesting(true)
    try {
      const res = await fetch("http://127.0.0.1:8000/request-lawyer", {
        method: "POST",
        headers,
        body: JSON.stringify({ lawyer_id: lawyerId }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.detail || "Request failed. Make sure you have an open case first.")
        return
      }
      // Lock in this lawyer — no more requests allowed
      setRequestedId(lawyerId)
    } catch {
      alert("Request failed. Try again.")
    } finally {
      setRequesting(false)
    }
  }

  // Unique specializations for filter pills
  const specializations = ["all", ...new Set(lawyers.map((l) => l.specialization).filter(Boolean))]

  const displayed = filter === "all"
    ? lawyers
    : lawyers.filter((l) => l.specialization === filter)

  return (
    <div className="lawyer-list">
      <div className="case-list-header">
        <h2 className="section-title">Find an Advocate</h2>
        <span className="lawyer-count">{lawyers.length} available</span>
      </div>

      {/* Filter pills */}
      {lawyers.length > 0 && (
        <div className="filter-pills">
          {specializations.map((s) => (
            <button
              key={s}
              className={`filter-pill ${filter === s ? "active" : ""}`}
              onClick={() => setFilter(s)}
            >
              {s === "all" ? "⚖️ All" : `${SPEC_ICONS[s] || "📜"} ${s}`}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading-state">Finding advocates...</div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👨‍⚖️</div>
          <p>No advocates available at the moment.</p>
        </div>
      ) : (
        <div className="lawyers-grid">
          {displayed.map((l, idx) => {
            const rating = l.rating || 0
            const exp = l.experience_years || l.experience || 0
            const spec = l.specialization || "General"
            return (
              <div key={l.id} className="lawyer-card">
                {/* Rank badge for top 3 */}
                {idx < 3 && filter === "all" && (
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
                  disabled={requestedId !== null || requesting}
                  title={requestedId !== null && requestedId !== l.id ? "You have already sent a request" : ""}
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