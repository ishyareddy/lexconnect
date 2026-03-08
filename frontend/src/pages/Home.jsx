import { Link } from "react-router-dom"
import { useEffect, useState } from "react"

export default function Home() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 100)
  }, [])

  return (
    <div className="home-root">
      <div className={`home-content ${visible ? "visible" : ""}`}>
        <div className="home-badge">AI-Powered Legal Platform</div>
        <h1 className="home-title">
          Lex<span className="gold">Connect</span>
        </h1>
        <p className="home-sub">
          Intelligent legal assistance connecting clients with the right advocates — seamlessly, securely, and swiftly.
        </p>
        <div className="home-actions">
          <Link to="/login" className="btn-primary">Login</Link>
          <Link to="/register" className="btn-secondary">Register</Link>
        </div>
        <div className="home-features">
          <div className="feature-pill">⚖️ Case Tracking</div>
          <div className="feature-pill">🤖 AI Legal Assistant</div>
          <div className="feature-pill">👨‍⚖️ Lawyer Matching</div>
          <div className="feature-pill">📁 Intake Management</div>
        </div>
      </div>
      <div className="home-glow" />
      <div className="home-grid" />
    </div>
  )
}