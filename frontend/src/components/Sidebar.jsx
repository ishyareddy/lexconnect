import { Link, useNavigate } from "react-router-dom"

export default function Sidebar({ role }) {
  const navigate = useNavigate()
  const name = localStorage.getItem("name") || (role === "client" ? "Client" : "Advocate")

  const handleLogout = () => {
    localStorage.clear()
    navigate("/")
  }

  const clientLinks = [
    { to: "/client",         icon: "📋", label: "My Cases" },
    { to: "/client/new-case",icon: "➕", label: "New Case" },
    { to: "/client/lawyers", icon: "👨‍⚖️", label: "Find Lawyers" },
  ]

  // Lawyer nav is now handled inside LawyerDashboard itself,
  // but keep this for any routes that still use the shared sidebar
  const lawyerLinks = [
    { to: "/lawyer",           icon: "📨", label: "Case Requests" },
    { to: "/lawyer/active",    icon: "⚡", label: "Active Cases" },
    { to: "/lawyer/assistant", icon: "⚖️", label: "AI Legal Assistant" },
  ]

  const links = role === "client" ? clientLinks : lawyerLinks

  return (
    <aside className="sidebar">
      <div>
        <div className="sidebar-brand">
          Lex<span className="gold">Connect</span>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar">{name.charAt(0).toUpperCase()}</div>
          <div>
            <div className="sidebar-name">{name}</div>
            <div className="sidebar-role">{role === "client" ? "Client" : "Advocate"}</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="sidebar-link">
              <span className="sidebar-icon">{l.icon}</span>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <button onClick={handleLogout} className="sidebar-logout">
        <span>🚪</span> Logout
      </button>
    </aside>
  )
}
