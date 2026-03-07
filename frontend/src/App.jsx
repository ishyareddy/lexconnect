import { BrowserRouter, Routes, Route } from "react-router-dom"

import Home from "./pages/Home"
import Login from "./pages/Login"
import Register from "./pages/Register"
import ClientDashboard from "./pages/ClientDashboard"
import LawyerDashboard from "./pages/LawyerDashboard"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/client" element={<ClientDashboard />} />
        <Route path="/lawyer" element={<LawyerDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App