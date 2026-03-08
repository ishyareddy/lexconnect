import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Home from "./pages/Home"
import Login from "./pages/Login"
import Register from "./pages/Register"
import ClientDashboard from "./pages/ClientDashboard"
import LawyerDashboard from "./pages/LawyerDashboard"

function ProtectedRoute({ children, allowedRole }) {
  const token = localStorage.getItem("token")
  const role = localStorage.getItem("role")
  if (!token) return <Navigate to="/login" replace />
  if (allowedRole && role !== allowedRole) return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* ✅ Fixed: All /client/* sub-paths render ClientDashboard.
            The `tab` query param controls which tab is active.
            e.g. /client?tab=lawyers → Find Lawyers tab */}
        <Route
          path="/client"
          element={
            <ProtectedRoute allowedRole="client">
              <ClientDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/new-case"
          element={
            <ProtectedRoute allowedRole="client">
              <ClientDashboard defaultTab="My Cases" openNewCase />
            </ProtectedRoute>
          }
        />
        <Route
          path="/client/lawyers"
          element={
            <ProtectedRoute allowedRole="client">
              <ClientDashboard defaultTab="Find Lawyers" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/lawyer"
          element={
            <ProtectedRoute allowedRole="lawyer">
              <LawyerDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App