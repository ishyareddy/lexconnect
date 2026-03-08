import { useState, useEffect } from "react"

const SPEC_ICONS = {
  "Civil Law": "⚖️", "Property Disputes": "🏠", "Property Law": "🏠",
  "Criminal Law": "🔒", "Family Law": "👨‍👩‍👧", "Corporate Law": "🏢",
  "Tax Law": "📊", "General": "📜",
}

// Maps backend case_type keys → lawyer specialization keywords
// so "Find Lawyer" from a property case pre-filters to property lawyers
const DOMAIN_SPEC_MAP = {
  property:    ["Property Law", "Property Disputes", "Civil Law"],
  family:      ["Family Law", "Civil Law"],
  custody:     ["Family Law", "Civil Law"],
  consumer:    ["Civil Law", "Corporate Law"],
  inheritance: ["Civil Law"],
  all:         [],
}

const CASE_TYPE_LABELS = {
  property:    "🏠 Property",
  family:      "💍 Family",
  custody:     "👶 Custody",
  consumer:    "🛒 Consumer",
  inheritance: "📜 Inheritance",
  all:         "⚖️ All",
}

export default function LawyerRecommendations({ filterType = "all", onFilterChange }) {
  const [lawyers, setLawyers] = useState([])
  const [loading, setLoading] = useState(true)
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

  // Reset request state when filter changes (new domain = fresh search)
  useEffect(() => { setRequestedId(null) }, [filterType])

  async function requestLawyer(lawyerId) {
    if (requestedId !== null) return
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
      setRequestedId(lawyerId)
    } catch {
      alert("Request failed. Try again.")
    } finally {
      setRequesting(false)
    }
  }

  // Filter + rank lawyers by domain relevance, return top 5
  const getDisplayedLawyers = () => {
    if (filterType === "all" || !DOMAIN_SPEC_MAP[filterType]) {
      return lawyers.slice(0, 5)
    }

    const preferred = DOMAIN_SPEC_MAP[filterType]

    // Score each lawyer: higher = better match for this case domain
    const scored = lawyers.map((l) => {
      const spec = l.specialization || "General"
      const specScore = preferred.indexOf(spec)
      const score =
        (specScore === -1 ? -1 : preferred.length - specScore) * 100 +
        (l.experience_years || l.experience || 0) * 2 +
        (l.rating || 0) * 10
      return { ...l, _score: score }
    })

    return scored
      .filter((l) => l._score > 0)        // only relevant specialists
      .sort((a, b) => b._score - a._score) // best first
      .slice(0, 5)                          // top 5 only
  }

  const displayed = getDisplayedLawyers()
  const filterLabel = CASE_TYPE_LABELS[filterType] || "⚖️ All"
  const domainName = filterType !== "all"
    ? CASE_TYPE_LABELS[filterType]?.replace(/^\S+\s/, "")
    : null

  return (
    <div className="lawyer-list">
      <div className="case-list-header">
        <h2 className="section-title">
          {domainName ? `Top Advocates for ${domainName}` : "Find an Advocate"}
        </h2>
        <span className="lawyer-count">{displayed.length} matches</span>
      </div>

      {/* Domain filter pills */}
      <div className="filter-pills">
        {Object.entries(CASE_TYPE_LABELS).map(([value, label]) => (
          <button
            key={value}
            className={`filter-pill ${filterType === value ? "active" : ""}`}
            onClick={() => onFilterChange && onFilterChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Info banner when coming from a case */}
      {filterType !== "all" && (
        <div className="domain-banner">
          🎯 Showing top 5 advocates best suited for <strong>{filterLabel}</strong> cases
        </div>
      )}

      {loading ? (
        <div className="loading-state">Finding advocates...</div>
      ) : displayed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👨‍⚖️</div>
          <p>No specialists found for this domain. Try viewing all advocates.</p>
          <button className="btn-secondary sm" onClick={() => onFilterChange && onFilterChange("all")}>
            View All Advocates
          </button>
        </div>
      ) : (
        <div className="lawyers-grid">
          {displayed.map((l, idx) => {
            const spec = l.specialization || "General"
            const rating = l.rating || 0
            const exp = l.experience_years || l.experience || 0
            return (
              <div key={l.id} className="lawyer-card">
                <div className="lpi-rank">
                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`}
                </div>
                <div className="lawyer-avatar">
                  {(l.name || "A").charAt(0).toUpperCase()}
                </div>
                <div className="lawyer-info">
                  <h3 className="lawyer-name">{l.name}</h3>
                  <p className="lawyer-spec">{SPEC_ICONS[spec] || "📜"} {spec}</p>
                  <div className="lawyer-meta-row">
                    {rating > 0 && (
                      <span className="lawyer-rating">
                        {"⭐".repeat(Math.min(Math.round(rating), 5))}
                        <span className="rating-num"> {rating}/5</span>
                      </span>
                    )}
                    {exp > 0 && <span className="lawyer-exp">🗓 {exp} yrs</span>}
                    {l.city && <span className="lawyer-city">📍 {l.city}</span>}
                  </div>
                </div>
                <button
                  className={`btn-request ${requestedId === l.id ? "requested" : ""}`}
                  onClick={() => requestLawyer(l.id)}
                  disabled={requestedId !== null || requesting}
                  title={requestedId !== null && requestedId !== l.id
                    ? "You have already sent a request"
                    : ""}
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