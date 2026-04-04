import { useEffect, useRef } from "react"

export default function MessageNotification({ message, otherUserName, onDismiss }) {
  const notificationRef = useRef(null)

  useEffect(() => {
    if (!message) return

    // Play sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.value = 800
    oscillator.type = "sine"

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.1)

    // Browser notification
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`Message from ${otherUserName}`, {
        body: message.content?.substring(0, 100) || "New message",
        icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect fill='%23667eea' width='100' height='100'/><text x='50' y='60' font-size='60' fill='white' text-anchor='middle'>💬</text></svg>",
        tag: "message-notification",
        requireInteraction: false,
      })
    }

    // Visual notification in UI
    if (notificationRef.current) {
      notificationRef.current.style.animation = "slideIn 0.3s ease-out"
      const dismissTimer = setTimeout(() => {
        if (notificationRef.current) {
          notificationRef.current.style.animation = "slideOut 0.3s ease-in"
        }
        // Call onDismiss after animation completes
        setTimeout(() => {
          if (onDismiss) onDismiss()
        }, 300)
      }, 3000)
      
      return () => clearTimeout(dismissTimer)
    }
  }, [message, otherUserName, onDismiss])

  if (!message) return null

  return (
    <div
      ref={notificationRef}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        padding: "16px 20px",
        borderRadius: "10px",
        boxShadow: "0 8px 24px rgba(102, 126, 234, 0.4)",
        maxWidth: "300px",
        zIndex: 9999,
        fontSize: "14px",
        fontWeight: "500",
      }}
    >
      <div style={{ fontWeight: "600", marginBottom: "4px" }}>💬 {otherUserName}</div>
      <div style={{ opacity: 0.9, fontSize: "13px" }}>
        {message.content?.substring(0, 80)}
        {message.content?.length > 80 ? "..." : ""}
      </div>
    </div>
  )
}

const styles = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`

if (typeof document !== "undefined") {
  const styleSheet = document.createElement("style")
  styleSheet.textContent = styles
  document.head.appendChild(styleSheet)
}
