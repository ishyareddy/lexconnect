import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"

export default function Register() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("client")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function register(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await fetch("http://127.0.0.1:8000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Registration failed")
      navigate("/login")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-root">
      <div className="auth-card">
        <Link to="/" className="auth-brand">Lex<span className="gold">Connect</span></Link>
        <h2 className="auth-title">Create account</h2>
        <p className="auth-sub">Join as a client or advocate</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={register} className="auth-form">
          <div className="field-group">
            <label>Full Name</label>
            <input
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label>Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label>I am registering as</label>
            <div className="role-toggle">
              <button
                type="button"
                className={`role-btn ${role === "client" ? "active" : ""}`}
                onClick={() => setRole("client")}
              >
                👤 Client
              </button>
              <button
                type="button"
                className={`role-btn ${role === "lawyer" ? "active" : ""}`}
                onClick={() => setRole("lawyer")}
              >
                ⚖️ Lawyer / Advocate
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary full" disabled={loading}>
            {loading ? <span className="spinner" /> : "Create Account"}
          </button>
        </form>
        <p className="auth-footer">
          Already registered? <Link to="/login">Login here</Link>
        </p>
      </div>
      <div className="auth-glow" />
    </div>
  )
}