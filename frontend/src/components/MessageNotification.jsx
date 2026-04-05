import Toast from "./Toast"

export default function MessageNotification({ message, otherUserName, onDismiss }) {
  if (!message) return null

  return (
    <Toast
      title={`New message from ${otherUserName}`}
      message={message.content || "You received a new message."}
      onDismiss={onDismiss}
    />
  )
}
