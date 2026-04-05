import { useEffect } from "react"

export default function Toast({ title, message, onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!message) return

    const timer = setTimeout(() => {
      if (onDismiss) onDismiss()
    }, duration)

    return () => clearTimeout(timer)
  }, [message, duration, onDismiss])

  if (!message) return null

  return (
    <div className="toast-notification" onClick={onDismiss}>
      <div className="toast-title">{title}</div>
      <div className="toast-body">{message}</div>
    </div>
  )
}
