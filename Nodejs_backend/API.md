# Ekatra API Documentation

## Base URL

```
http://localhost:3000 (Development)
https://your-domain.com (Production)
```

## Authentication

Webhook endpoints use WATI authentication via the `Authorization` header configured in WATI dashboard.

## Rate Limits

- **General API**: 100 requests per 15 minutes per IP
- **Webhooks**: 1000 requests per 15 minutes per IP
- **LLM Queries**: 10 requests per minute per IP (costly operations)

## Endpoints

### Health Check

#### GET `/health`

Check if the server is running and healthy.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-22T10:00:00.000Z",
  "uptime": 12345.67
}
```

**Status Codes:**
- `200 OK` - Service is healthy
- `500 Internal Server Error` - Service is unhealthy

---

### WhatsApp Webhook

#### POST `/cop`

Receives WhatsApp events from WATI platform.

**Request Body:**
```json
{
  "eventType": "message",
  "waId": "1234567890",
  "text": "User message text",
  "buttonReply": {
    "text": "Start Day",
    "payload": "start_day"
  },
  "type": "interactive"
}
```

**Event Types:**

1. **Start Day Button:**
   ```json
   {
     "eventType": "message",
     "buttonReply": {
       "text": "Start Day"
     },
     "waId": "1234567890"
   }
   ```

2. **Next Module Button:**
   ```json
   {
     "type": "interactive",
     "text": "Next Module",
     "waId": "1234567890"
   }
   ```

3. **Doubt Yes/No Buttons:**
   ```json
   {
     "type": "interactive",
     "text": "Yes",  // or "No"
     "waId": "1234567890"
   }
   ```

4. **User Text Message (Doubt Query):**
   ```json
   {
     "eventType": "message",
     "text": "How does this work?",
     "waId": "1234567890"
   }
   ```

**Response:**
```
200 OK (Always returns 200 to acknowledge receipt)
```

**Error Responses:**
```json
{
  "error": "Invalid phone number",
  "message": "Phone number (waId) format is invalid"
}
```

**Status Codes:**
- `200 OK` - Event received and processed
- `400 Bad Request` - Invalid request format
- `429 Too Many Requests` - Rate limit exceeded

---

### Course Reminder

#### GET `/nextday`

Sends course reminders to all pending students.

**Response:**
```
"Sending Remainder to students"
```

**Process:**
- Queries all students with status: "Content Created" and Progress: "Pending"
- Sends WhatsApp template message with next day information
- Sends follow-up text to start the day

**Status Codes:**
- `200 OK` - Reminders sent successfully

---

### Course Approval (Legacy)

#### GET `/ping`

Triggers course approval and generation process.

**Response:**
```
"Booting Up AI Engine........."
```

**Process:**
- Queries Airtable for approved course requests
- Generates personalized 3-day courses using Azure LLM
- Creates course tables in Airtable
- Sends WhatsApp notification to students

**Status Codes:**
- `200 OK` - Process initiated

---

## Webhook Event Flows

### 1. Course Delivery Flow

```
Student clicks "Start Day"
  → GET /cop (webhook)
  → Fetch student data from Airtable
  → Fetch course module content
  → Send module text via WhatsApp
  → Update progress in Airtable
  → Send "Next Module" or "Day Complete" button
```

### 2. Doubt Resolution Flow

```
Student clicks "Yes" (has doubt)
  → GET /cop (webhook)
  → Set doubt bit to 1 in Airtable
  → Send "Please type your query" message

Student sends query text
  → GET /cop (webhook)
  → Sanitize and validate query
  → Send to Azure LLM for answer
  → Return AI response via WhatsApp
  → Send "Any other doubts?" button
```

### 3. Course Completion Flow

```
Student completes Day 3, Module 3
  → Send congratulations message
  → Generate PDF certificate with student name
  → Send certificate via WhatsApp
  → Mark progress as "Completed"
```

---

## Data Models

### Student Record (Airtable)

```javascript
{
  "Phone": "1234567890",
  "Name": "Student Name",
  "Topic": "Course Topic",
  "Course Status": "Content Created",
  "Progress": "Pending",
  "Next Day": 1,
  "Next Module": 1,
  "Day Completed": 0,
  "Module Completed": 0,
  "Doubt": 0,  // 0 = No, 1 = Yes
  "Goal": "Student's learning goal",
  "Style": "Teaching style preference",
  "Language": "English"
}
```

### Course Record (Airtable)

Table name: `{Topic}_{Phone}`

```javascript
{
  "Day": 1,
  "Module 1 Text": "Content for module 1...",
  "Module 2 Text": "Content for module 2...",
  "Module 3 Text": "Content for module 3..."
}
```

---

## Error Handling

### Validation Errors

```json
{
  "error": "Invalid input",
  "message": "Your query contains disallowed content"
}
```

### Rate Limit Errors

```json
{
  "error": "Too many requests",
  "message": "Too many requests from this IP, please try again later.",
  "retryAfter": "2024-01-22T10:15:00.000Z"
}
```

### Server Errors

```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

---

## Input Validation

### Phone Number (waId)
- Format: 10-15 digits
- Optional + prefix
- Example: `+1234567890` or `1234567890`

### User Query Text
- Min length: 3 characters
- Max length: 2000 characters
- Blocked patterns: prompt injection attempts
- Sanitized before sending to LLM

### Course Topic
- Length: 2-100 characters
- Allowed: Alphanumeric, spaces, and common punctuation
- Pattern: `^[a-zA-Z0-9\s\-_,.()]{2,100}$`

---

## Security

### Request Sanitization
All user inputs are sanitized to prevent:
- SQL injection (Airtable formula injection)
- Prompt injection (LLM manipulation)
- XSS attacks

### Rate Limiting
Applied to all endpoints to prevent abuse and control costs.

### CORS
Restricted to allowed origins in production (configured via `ALLOWED_ORIGINS` env var).

---

## Integration Examples

### Webhook Setup (WATI)

1. Go to WATI Dashboard → Webhooks
2. Set Webhook URL: `https://your-domain.com/cop`
3. Add Authorization header with your API key
4. Enable events: Messages, Button Replies

### Testing with cURL

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Simulate Webhook (Start Day):**
```bash
curl -X POST http://localhost:3000/cop \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "message",
    "waId": "1234567890",
    "buttonReply": {
      "text": "Start Day"
    }
  }'
```

**Send Course Reminder:**
```bash
curl http://localhost:3000/nextday
```

---

## Changelog

### v1.1.0 (Production Ready)
- ✅ Added input validation
- ✅ Implemented rate limiting
- ✅ Added proper error handling
- ✅ Created health check endpoint
- ✅ Implemented graceful shutdown
- ✅ Added comprehensive logging
- ✅ Fixed security vulnerabilities

### v1.0.0 (Initial)
- Initial WhatsApp integration
- Course generation with Azure LLM
- Certificate generation
- Basic webhook handling
