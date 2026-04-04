// QUICK START - Add to LawyerDashboard.jsx

// Step 1: Add this import at the top of the file
import CommunicationPanel from "../components/CommunicationPanel"

// Step 2: Add these state variables after your existing useState declarations
const [showCommunication, setShowCommunication] = useState(false)
const [communicationPartner, setCommunicationPartner] = useState(null)

// Step 3: Replace the chat button in the "active" cases view (around line 470) with:
/*
FIND THIS:
                      <button
                        style={s.chatBtn}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCase(r)
                        }}
                      >
                        💬 Chat
                      </button>

REPLACE WITH THIS:
                      <button
                        style={s.chatBtn}
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowCommunication(true)
                          setCommunicationPartner({
                            userId: r.client_id || r.id,
                            userName: r.client_name || "Client",
                            caseId: r.case_id || r.id
                          })
                        }}
                      >
                        💬 Chat & Video
                      </button>
*/

// Step 4: Add this before the closing </div> of the main shell (before the last closing tag)
{showCommunication && communicationPartner && (
  <div style={s.communicationModal}>
    <CommunicationPanel
      caseId={communicationPartner.caseId}
      otherUserId={communicationPartner.userId}
      otherUserName={communicationPartner.userName}
      onClose={() => {
        setShowCommunication(false)
        setCommunicationPartner(null)
      }}
    />
  </div>
)}

// Step 5: Add this style to the 's' object at the bottom of the file
communicationModal: {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
  padding: "20px"
}

// Step 6: Also add this style to handle the modal content
communicationPanelStyle: {
  width: "100%",
  maxWidth: "900px",
  height: "80vh",
  borderRadius: "12px",
  background: "white",
  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)"
}

// ============================================================================
// QUICK START - Add to ClientDashboard.jsx

// Step 1: Add import at the top
import CommunicationPanel from "../components/CommunicationPanel"

// Step 2: Add state
const [showChat, setShowChat] = useState(false)
const [selectedLawyer, setSelectedLawyer] = useState(null)

// Step 3: Add a button in the My Cases tab to open chat with assigned lawyer
/*
When a case has an assigned_lawyer, add a button like:
<button
  onClick={() => {
    setSelectedLawyer({
      id: lawyerId,
      name: lawyerName
    })
    setShowChat(true)
  }}
>
  💬 Chat with {lawyerName}
</button>
*/

// Step 4: Render the communication panel
{showChat && selectedLawyer && (
  <div style={{
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000
  }}>
    <CommunicationPanel
      caseId={selectedCaseId}
      otherUserId={selectedLawyer.id}
      otherUserName={selectedLawyer.name}
      onClose={() => {
        setShowChat(false)
        setSelectedLawyer(null)
      }}
    />
  </div>
)}

// ============================================================================
// IMPORTANT NOTES:

// 1. Make sure your demo users are set up correctly in the database:
//    - Client: email=test@test.com, id=1
//    - Lawyer: email=lawyer@demo.com, id=2

// 2. Browser Requirements for Video Calls:
//    - HTTPS required (unless localhost)
//    - Microphone/camera permissions
//    - Modern browser (Chrome, Firefox, Safari, Edge)

// 3. Styling:
//    - All new components use CSS files in frontend/src/styles/
//    - Match your existing theme by editing CSS colors

// 4. Real-time Features:
//    - Messages refresh every 3 seconds (edit ChatWindow.jsx to change)
//    - Not real WebSocket (use Socket.io or similar for production)

// 5. Testing:
//    - Run: python test_chat_video.py
//    - Use two browser tabs to test messaging
//    - Jitsi requires proper browser permissions
