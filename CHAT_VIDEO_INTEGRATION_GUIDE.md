# Chat and Video Call Feature - Integration Guide

## Overview
This feature enables real-time communication between lawyers and clients with integrated video calling via Jitsi.

## Components Created

### Backend (Python/FastAPI)
- **Database Models**: `Message`, `VideoCall`, `CallSession` in `backend/database.py`
- **API Endpoints**: In `backend/app.py`
  - `/messages/send` - Send a message
  - `/messages/conversation/{other_user_id}` - Get conversation history
  - `/messages/unread` - Get unread messages
  - `/messages/recent-conversations` - Get recent chat partners
  - `/calls/initiate` - Start a video call
  - `/calls/{call_id}/status` - Update call status
  - `/calls/active/{case_id}` - Get active call for a case
  - `/calls/pending` - Get pending incoming calls

### Frontend (React)
- **Components**:
  - `ChatWindow.jsx` - Chat interface
  - `VideoCall.jsx` - Jitsi video call integration
  - `CommunicationPanel.jsx` - Combined chat + video interface

- **Styles**:
  - `ChatWindow.css`
  - `VideoCall.css`
  - `CommunicationPanel.css`

## Installation

### 1. Backend Setup

Already done! The models and endpoints are added to your backend.

### 2. Frontend Dependencies

Jitsi Meet uses external CDN, so no npm install needed. The iframe is loaded dynamically.

## Integration into Your Pages

### Option 1: Add to LawyerDashboard (Recommended)

Add the import at the top of `LawyerDashboard.jsx`:

```jsx
import CommunicationPanel from "../components/CommunicationPanel"
```

Then modify the active cases section when chat button is clicked:

```jsx
// In the activeCases map, update the chat button:
<button
  style={s.chatBtn}
  onClick={(e) => {
    e.stopPropagation()
    setSelectedCase(r)
    setShowCommunication(true)  // Add this state
  }}
>
  💬 Chat
</button>

// Add this state at the top:
const [showCommunication, setShowCommunication] = useState(false)
const [selCommunicationUser, setSelCommunicationUser] = useState(null)
```

### Option 2: Add to ClientDashboard

Import the component and use it to chat with assigned lawyers:

```jsx
import CommunicationPanel from "../components/CommunicationPanel"

// Add a button/tab to open communication with the assigned lawyer
<CommunicationPanel 
  caseId={selectedCaseId}
  otherUserId={assignedLawyerId}
  otherUserName="Your Lawyer"
  onClose={() => setCommunicationOpen(false)}
/>
```

## How It Works

### Messaging Flow
1. User sends a message through ChatWindow component
2. Frontend calls `/messages/send` endpoint
3. Message is stored in database
4. Recipient can see message when they open the conversation
5. Messages auto-refresh every 3 seconds

### Video Call Flow
1. User clicks "Start Video Call"
2. Frontend creates a video call session via `/calls/initiate`
3. A unique Jitsi room is created
4. Recipient receives a notification of pending call
5. Recipient can accept or decline
6. Once accepted, both users join the Jitsi room
7. Jitsi handles all video/audio streaming

## Configuration

### Jitsi Server
By default, it uses the public Jitsi server: `https://meet.jit.si`

To use your own Jitsi server, modify `VideoCall.jsx`:
```jsx
const domain = "your-jitsi-domain.com"  // Change this line
```

### Message Refresh Rate
To change how often messages are fetched, modify in `ChatWindow.jsx`:
```jsx
const interval = setInterval(fetchMessages, 3000)  // Change 3000 to desired milliseconds
```

## Database Migrations

The new tables will be created automatically when the backend starts (via SQLAlchemy's `create_all`).

## Testing

### Test Messaging:
1. Open two browser windows - one as client, one as lawyer
2. Navigate to active case
3. Open communication panel
4. Send message from one side
5. Verify message appears on other side within 3 seconds

### Test Video Calling:
1. Open two browser windows
2. One user clicks "Start Video Call"
3. Other user should see incoming call notification
4. Accept the call
5. Both should see Jitsi interface
6. Video/audio should work through Jitsi

## Styling

All components use CSS files in `frontend/src/styles/`:
- Colors are purple/blue gradient (#667eea, #764ba2)
- Responsive design for mobile
- Dark mode compatible

To customize colors, edit the CSS files (search for #667eea).

## Security Notes

1. Authentication uses Bearer tokens (user_id)
2. Messages are stored in database with sender/recipient IDs
3. Only authenticated users can send/receive messages
4. Jitsi rooms are unique per case+users, preventing unauthorized access
5. Consider implementing room access tokens for enhanced security

## Troubleshooting

### Messages not appearing
- Check browser console for errors
- Verify authentication token is valid
- Ensure backend API is running on port 8000
- Check database for stored messages

### Video call not working
- Verify Jitsi server is accessible
- Check browser console for errors
- Allow microphone/camera permissions
- Try using a different Jitsi server
- Check that `window.JitsiMeetExternalAPI` is loaded

### CORS Issues
- Ensure CORS middleware is properly configured in `app.py`
- Frontend should be able to reach `http://127.0.0.1:8000`

## Future Enhancements

1. **Real-time notifications** - Use WebSockets instead of polling
2. **Message reactions** - Add emoji reactions
3. **File sharing** - Share documents in chat
4. **Message encryption** - End-to-end encryption
5. **Call recording** - Record video calls
6. **Screen sharing** - Enhanced Jitsi config for screen share
7. **Voice messages** - Audio message support
8. **Read receipts** - Show when message was read
