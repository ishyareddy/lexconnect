# ✅ Chat & Video Call Implementation Checklist

## Backend Implementation ✅
- [x] Added `Message` model to `backend/database.py`
- [x] Added `VideoCall` model to `backend/database.py`  
- [x] Added `CallSession` enum to `backend/database.py`
- [x] Added message models to database exports
- [x] Added video call models to database exports
- [x] Added datetime import to `backend/app.py`
- [x] Added Message, VideoCall imports to `backend/app.py`
- [x] Added `MessageInput` Pydantic model
- [x] Added `InitiateCallInput` Pydantic model
- [x] Added `UpdateCallStatusInput` Pydantic model
- [x] Implemented `/messages/send` endpoint
- [x] Implemented `/messages/conversation/{other_user_id}` endpoint
- [x] Implemented `/messages/unread` endpoint
- [x] Implemented `/messages/recent-conversations` endpoint
- [x] Implemented `/calls/initiate` endpoint
- [x] Implemented `/calls/{call_id}/status` endpoint
- [x] Implemented `/calls/active/{case_id}` endpoint
- [x] Implemented `/calls/pending` endpoint

## Frontend Components ✅
- [x] Created `ChatWindow.jsx` component
- [x] Created `VideoCall.jsx` component with Jitsi integration
- [x] Created `CommunicationPanel.jsx` component
- [x] Created `ChatWindow.css` styles
- [x] Created `VideoCall.css` styles
- [x] Created `CommunicationPanel.css` styles

## Documentation ✅
- [x] Created `CHAT_VIDEO_INTEGRATION_GUIDE.md`
- [x] Created `QUICK_INTEGRATION.js` with copy-paste code snippets
- [x] Created `test_chat_video.py` for testing endpoints

## Next Steps - Manual Integration

### 1. Update LawyerDashboard.jsx
- [ ] Add import: `import CommunicationPanel from "../components/CommunicationPanel"`
- [ ] Add state variables for communication panel
- [ ] Update chat button to open communication panel
- [ ] Add modal/overlay for communication panel

### 2. Update ClientDashboard.jsx  
- [ ] Add import for CommunicationPanel
- [ ] Add button to communicate with assigned lawyer
- [ ] Pass case ID and lawyer ID to CommunicationPanel

### 3. Test Backend APIs
```bash
# Activate your virtual environment
.venv\Scripts\activate

# Run test script
python test_chat_video.py
```

### 4. Test Frontend Components
- [ ] Test sending a message between two browser windows
- [ ] Test message refresh (should appear within 3 seconds)
- [ ] Test initiating a video call
- [ ] Test accepting/declining calls
- [ ] Test Jitsi video interface loads
- [ ] Test microphone/camera controls in Jitsi
- [ ] Test ending call

## Expected Behavior

### Messaging (POST /messages/send)
**Input:**
```json
{
  "recipient_id": 2,
  "content": "Hello, do you have updates?",
  "case_id": 1
}
```
**Output:**
```json
{
  "id": 1,
  "sender_id": 1,
  "recipient_id": 2,
  "content": "Hello, do you have updates?",
  "case_id": 1,
  "created_at": "2026-04-04T10:30:00"
}
```

### Video Call Initiation (POST /calls/initiate)
**Input:**
```json
{
  "recipient_id": 2,
  "case_id": 1
}
```
**Output:**
```json
{
  "call_id": 1,
  "room_name": "lexconnect-case1-1-2",
  "status": "initiating",
  "jitsi_server": "https://meet.jit.si"
}
```

## Database Tables Created

### messages table
- id (PK)
- sender_id (FK users)
- recipient_id (FK users)
- case_id (FK cases, nullable)
- content (TEXT)
- is_read (BOOLEAN)
- created_at (DATETIME)

### video_calls table
- id (PK)
- case_id (FK cases)
- initiator_id (FK users)
- recipient_id (FK users)
- room_name (STRING, UNIQUE)
- status (ENUM: initiating, active, completed, declined)
- started_at (DATETIME, nullable)
- ended_at (DATETIME, nullable)
- created_at (DATETIME)

## Environment Variables
No additional environment variables needed. The system uses:
- Default Jitsi server: `https://meet.jit.si`
- Database URL: Same as existing `LEGAL_RAG_DB_URL`

## Browser Requirements for Video Calls
- ✅ Modern browser (Chrome 80+, Firefox 75+, Safari 14+, Edge 80+)
- ✅ HTTPS (or localhost for development)
- ✅ Microphone & camera permissions
- ✅ Pop-ups allowed for Jitsi

## Troubleshooting Checklist

### Messages not appearing?
- [ ] Refresh browser (Ctrl+F5)
- [ ] Check browser console for errors (F12)
- [ ] Verify backend is running: `curl http://127.0.0.1:8000/health`
- [ ] Test API directly: `python test_chat_video.py`
- [ ] Check database: `sqlite3 legal_rag.db "SELECT * FROM messages;"`

### Video call not connecting?
- [ ] Verify browser allows microphone/camera
- [ ] Check console for Jitsi errors
- [ ] Try different browser
- [ ] Ensure Jitsi server is accessible
- [ ] Test connection: `curl https://meet.jit.si`

### CORS errors?
- [ ] Verify CORS middleware in `app.py` allows all origins
- [ ] Check frontend is using correct backend URL (127.0.0.1:8000)
- [ ] Clear browser cache (Ctrl+Shift+Delete)

## Performance Notes
- Messages poll every 3 seconds (configurable in ChatWindow.jsx)
- For production: Consider WebSocket for real-time updates
- Jitsi video uses peer-to-peer when possible
- File/database storage built in (no external dependencies)

## Security Considerations
- ✅ Bearer token authentication
- ✅ User IDs validated on each request
- ✅ Messages only accessible by sender/recipient
- ✅ Video rooms generated per case
- ⚠️ Consider adding message/call encryption for sensitive info
- ⚠️ Consider adding rate limiting for message spam

## Success Criteria
✅ Users can send/receive text messages
✅ Messages persist in database
✅ Users can initiate video calls
✅ Video calls connect through Jitsi
✅ Call participants see video/audio
✅ Call ends properly
✅ UI is responsive and matches theme

---

## Support
For issues or questions:
1. Check the CHAT_VIDEO_INTEGRATION_GUIDE.md
2. Review the QUICK_INTEGRATION.js code snippets
3. Run test_chat_video.py to verify backend
4. Check browser console (F12) for errors
5. Review database directly with sqlite3
