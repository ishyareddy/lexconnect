import { useState, useEffect, useRef } from "react"
import "../styles/VideoCall.css"

export default function VideoCallComponent({ caseId, otherUserId, otherUserName, onClose }) {
  const [callId, setCallId] = useState(null)
  const [roomName, setRoomName] = useState(null)
  const [callStatus, setCallStatus] = useState("idle") // idle, initiating, active, completed
  const [loading, setLoading] = useState(false)
  const [pendingCalls, setPendingCalls] = useState([])
  const jitsiContainerRef = useRef(null)
  const jitsiApiRef = useRef(null)
  const token = localStorage.getItem("token")
  const userId = parseInt(token)
  const userName = localStorage.getItem("name")

  // Check for pending calls periodically
  useEffect(() => {
    if (!token) return

    const fetchPendingCalls = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/calls/pending", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (response.ok) {
          const data = await response.json()
          setPendingCalls(data)
        }
      } catch (error) {
        console.error("Failed to fetch pending calls:", error)
      }
    }

    fetchPendingCalls()
    const interval = setInterval(fetchPendingCalls, 3000)
    return () => clearInterval(interval)
  }, [token])

  const initiateCall = async () => {
    if (!otherUserId || !caseId) {
      alert("Missing user ID or case ID")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("http://127.0.0.1:8000/calls/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient_id: otherUserId,
          case_id: caseId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCallId(data.call_id)
        setRoomName(data.room_name)
        setCallStatus("initiating")
      } else {
        alert("Failed to initiate call")
      }
    } catch (error) {
      console.error("Failed to initiate call:", error)
      alert("Error initiating call: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  const acceptCall = async (incomingCallId) => {
    setCallId(incomingCallId)
    // Fetch call details
    try {
      const response = await fetch(`http://127.0.0.1:8000/calls/${incomingCallId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      // Note: You might need to add this endpoint to get call details
    } catch (error) {
      console.error("Error:", error)
    }

    // Update call status to active
    await updateCallStatus(incomingCallId, "active")
  }

  const declineCall = async (incomingCallId) => {
    await updateCallStatus(incomingCallId, "declined")
    setPendingCalls(pendingCalls.filter((c) => c.call_id !== incomingCallId))
  }

  const updateCallStatus = async (id, status) => {
    try {
      await fetch(`http://127.0.0.1:8000/calls/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      })
    } catch (error) {
      console.error("Failed to update call status:", error)
    }
  }

  const startJitsiMeet = (room) => {
    if (!jitsiContainerRef.current) return

    const domain = import.meta.env.VITE_JITSI_DOMAIN || "meet.jit.si"
    
    const options = {
      roomName: room,
      height: 600,
      width: 800,
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: userName || `User ${userId}`,
        email: localStorage.getItem("email") || "",
      },
      configOverwrite: {
        disableSimulcast: false,
        startWithAudioMuted: true,
        startWithVideoMuted: false,
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          "microphone",
          "camera",
          "desktop",
          "fullscreen",
          "fodeviceselection",
          "hangup",
          "chat",
          "recordings",
          "raisehand",
          "participants-pane",
          "tileview",
          "verticalfilms",
          "stats",
          "shortcuts",
          "help",
          "mute-everyone",
          "security",
        ],
        SHOW_JITSI_WATERMARK: true,
      },
    }

    const script = document.createElement("script")
    script.src = `https://${domain}/external_api.js`
    script.async = true
    script.onload = () => {
      if (window.JitsiMeetExternalAPI) {
        jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options)

        jitsiApiRef.current.addEventListener("videoConferenceJoined", () => {
          setCallStatus("active")
          updateCallStatus(callId, "active")
        })

        jitsiApiRef.current.addEventListener("videoConferenceLeft", () => {
          setCallStatus("completed")
          updateCallStatus(callId, "completed")
          endCall()
        })

        jitsiApiRef.current.addEventListener("readyToClose", () => {
          endCall()
        })
      }
    }

    if (!document.querySelector(`script[src="https://${domain}/external_api.js"]`)) {
      document.head.appendChild(script)
    }
  }

  const endCall = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose()
      jitsiApiRef.current = null
    }
    setCallStatus("idle")
    setCallId(null)
    setRoomName(null)
    if (jitsiContainerRef.current) {
      jitsiContainerRef.current.innerHTML = ""
    }
  }

  // Start Jitsi when roomName changes and status is initiating/active
  useEffect(() => {
    if (roomName && (callStatus === "initiating" || callStatus === "active")) {
      startJitsiMeet(roomName)
    }
  }, [roomName])

  return (
    <div className="video-call-container">
      {/* Incoming Calls Notifications */}
      {pendingCalls.length > 0 && (
        <div className="incoming-calls-notification">
          {pendingCalls.map((call) => (
            <div key={call.call_id} className="incoming-call">
              <div className="call-info">
                <strong>{call.initiator_name}</strong> is calling about case {call.case_id}
              </div>
              <div className="call-actions">
                <button
                  onClick={() => acceptCall(call.call_id)}
                  className="btn btn-accept"
                >
                  Accept
                </button>
                <button
                  onClick={() => declineCall(call.call_id)}
                  className="btn btn-decline"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Call Controls */}
      {callStatus === "idle" && (
        <div className="call-controls">
          <button
            onClick={initiateCall}
            disabled={loading || !otherUserId}
            className="btn btn-primary"
          >
            {loading ? "Initiating..." : "Start Video Call"}
          </button>
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      )}

      {/* Jitsi Container */}
      {(callStatus === "initiating" || callStatus === "active") && (
        <div className="jitsi-container">
          <div
            ref={jitsiContainerRef}
            id="jitsi-container"
            style={{ height: "100%", width: "100%" }}
          />
          {callStatus === "active" && (
            <button onClick={endCall} className="btn btn-danger btn-end-call">
              End Call
            </button>
          )}
        </div>
      )}

      {callStatus === "completed" && (
        <div className="call-completed">
          <p>Call ended</p>
          <button onClick={onClose} className="btn btn-primary">
            Close
          </button>
        </div>
      )}
    </div>
  )
}
