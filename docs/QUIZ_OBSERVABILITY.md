# Quiz Observability - Comprehensive Logging Guide

## Overview

This document describes the structured logging system implemented for quiz gameplay. It enables full traceability of user sessions from page load to completion, supporting production debugging and monitoring.

## Architecture

### Trace Correlation

- **Backend**: Extracts `X-Request-ID` or `X-Trace-ID` from headers, generates 8-char UUID if missing
- **Frontend**: Generates trace_id on page load, sends via `X-Trace-ID` header in all API requests
- **Response**: Backend adds `X-Trace-ID` to response headers for client correlation

### Log Structure

All logs use structured format:
```python
{
  "event": "QUIZ_EVENT_NAME",      # Standardized event name
  "level": "info|warn|error|debug", # Log level
  "trace_id": "a1b2c3d4",          # Request correlation ID
  "timestamp": "2024-01-15T10:30:45.123Z",
  "path": "/api/quiz/run/123/state",
  "method": "GET",
  "player_id": "uuid",              # Player UUID
  "anonymous": true,                # Anonymous flag
  # Event-specific fields...
}
```

**Important**: Never logs sensitive data (cookies, tokens, PINs, passwords).

## Event Reference

### HTML Routes

#### QUIZ_PLAY_HTML_ENTER
- **When**: User lands on `/quiz/<topic>/play` page
- **Level**: info
- **Fields**: `topic_id`
- **Purpose**: Track page entries

#### QUIZ_SESSION_CREATED
- **When**: New anonymous session created (no existing cookie)
- **Level**: info
- **Fields**: `session_token` (safe to log), `player_id`, `anonymous=true`
- **Purpose**: Track new anonymous players

#### QUIZ_SESSION_COOKIE_SET
- **When**: Cookie set in response after session creation
- **Level**: info
- **Fields**: `cookie_set=true`, `topic_id`
- **Purpose**: Confirm cookie was sent to client

### Auth Decorator

#### QUIZ_AUTH_NO_SESSION
- **When**: API request without `quiz_session` cookie
- **Level**: warn
- **Fields**: `code="NO_SESSION"`
- **Purpose**: Detect missing session cookies (possible client bug)

#### QUIZ_AUTH_INVALID_SESSION
- **When**: Session token invalid/expired
- **Level**: warn
- **Fields**: `code="INVALID_SESSION"`
- **Purpose**: Track session invalidation issues

#### QUIZ_AUTH_OK
- **When**: Successful authentication
- **Level**: debug
- **Fields**: `player_id`, `anonymous`
- **Purpose**: Trace authenticated requests (debug only)

### API Endpoints

#### QUIZ_RUN_START
- **When**: POST `/api/quiz/<topic>/run/start`
- **Level**: info
- **Fields**: `topic_id`, `force_new`
- **Purpose**: Track quiz runs started

#### QUIZ_RUN_START_OK
- **When**: Run successfully started/resumed
- **Level**: info
- **Fields**: `run_id`, `topic_id`, `is_new`, `status`, `current_index`
- **Purpose**: Confirm run creation

#### QUIZ_RUN_START_FAIL
- **When**: Topic not found
- **Level**: warn
- **Fields**: `topic_id`, `reason="TOPIC_NOT_FOUND"`

#### QUIZ_TIMER_START_REQUEST
- **When**: POST `/api/quiz/run/<id>/question/start`
- **Level**: info
- **Fields**: `run_id`, `question_index`, `time_limit_seconds`
- **Purpose**: Track timer start attempts

#### QUIZ_TIMER_START_OK
- **When**: Timer successfully started
- **Level**: info
- **Fields**: `run_id`, `question_index`, `remaining_seconds`, `expires_at_ms`
- **Purpose**: Confirm timer activation

#### QUIZ_TIMER_START_FAIL
- **When**: Timer start failed (missing index, timer not set)
- **Level**: error/warn
- **Fields**: `run_id`, `question_index`, `reason`, `success`, `has_expires_at`
- **Purpose**: Detect timer failures

#### QUIZ_ANSWER_SUBMIT
- **When**: POST `/api/quiz/run/<id>/answer`
- **Level**: info
- **Fields**: `run_id`, `question_index`, `selected_answer_id`, `used_joker`
- **Purpose**: Track all answer submissions

#### QUIZ_ANSWER_SUBMIT_OK
- **When**: Answer successfully processed
- **Level**: info
- **Fields**: `run_id`, `question_index`, `outcome` (correct/wrong/timeout), `is_correct`, `earned_points`, `running_score`, `level_completed`, `level_perfect`, `finished`
- **Purpose**: Track scoring and progression

#### QUIZ_ANSWER_SUBMIT_FAIL
- **When**: Answer submission rejected
- **Level**: warn
- **Fields**: `run_id`, `question_index`, `error_code`, `error`
- **Purpose**: Debug submission failures

#### QUIZ_STATE
- **When**: GET `/api/quiz/run/<id>/state` (with noise management)
- **Level**: info (if expired or phase change), debug (normal poll)
- **Fields**: `run_id`, `phase`, `current_index`, `timer_started`, `remaining_seconds`, `is_expired`, `running_score`, `debug`
- **Purpose**: Track phase transitions
- **Noise Management**: Only logs when:
  - Phase changed (NOT_STARTED → ANSWERING → POST_ANSWER)
  - Timer expired (`is_expired=true`)
  - Debug flag (`?debug=1`)
  - Otherwise silent to avoid log spam from polling

#### QUIZ_AUTO_TIMEOUT_APPLIED
- **When**: Server creates timeout answer on expired timer
- **Level**: warn
- **Fields**: `run_id`, `question_index`
- **Purpose**: Track server-side timeout enforcement

#### QUIZ_AUTO_TIMEOUT_DUPLICATE_PREVENTED
- **When**: UniqueConstraint prevents duplicate timeout answer
- **Level**: info
- **Fields**: `run_id`, `question_index`
- **Purpose**: Confirm race condition handling

#### QUIZ_JOKER_USE
- **When**: POST `/api/quiz/run/<id>/joker`
- **Level**: info
- **Fields**: `run_id`, `question_index`

#### QUIZ_JOKER_USE_OK
- **When**: Joker successfully used
- **Level**: info
- **Fields**: `run_id`, `question_index`, `disabled_count`, `joker_remaining`

#### QUIZ_JOKER_USE_FAIL
- **When**: Joker use rejected
- **Level**: warn
- **Fields**: `run_id`, `question_index`, `error_code`

#### QUIZ_RUN_FINISH
- **When**: POST `/api/quiz/run/<id>/finish`
- **Level**: info
- **Fields**: `run_id`

#### QUIZ_RUN_FINISH_OK
- **When**: Run successfully finished
- **Level**: info
- **Fields**: `run_id`, `total_score`, `tokens_count`, `player_rank`

#### QUIZ_RUN_FINISH_FAIL
- **When**: Run already finished
- **Level**: warn
- **Fields**: `run_id`, `reason="ALREADY_FINISHED"`, `status`

#### QUIZ_OWNERSHIP_DENY
- **When**: Run not found or doesn't belong to player
- **Level**: warn
- **Fields**: `run_id`, `reason="RUN_NOT_FOUND_OR_NOT_OWNED"`
- **Purpose**: Detect ownership violations (possible tampering)

## Usage Examples

### Trace Anonymous Session Flow

```bash
# Find initial page load
docker logs games-webapp 2>&1 | grep "trace_id.*a1b2c3d4" | grep "QUIZ_PLAY_HTML_ENTER"

# Follow session creation
docker logs games-webapp 2>&1 | grep "trace_id.*a1b2c3d4" | grep -E "SESSION_CREATED|COOKIE_SET"

# Trace full gameplay
docker logs games-webapp 2>&1 | grep "trace_id.*a1b2c3d4"
```

### Find Timer Issues

```bash
# Timer start failures
docker logs games-webapp 2>&1 | grep "event.*QUIZ_TIMER_START_FAIL"

# Auto-timeout events
docker logs games-webapp 2>&1 | grep "event.*QUIZ_AUTO_TIMEOUT"
```

### Monitor Anonymous Auth Failures

```bash
# Missing session cookies
docker logs games-webapp 2>&1 | grep "event.*QUIZ_AUTH_NO_SESSION"

# Invalid sessions
docker logs games-webapp 2>&1 | grep "event.*QUIZ_AUTH_INVALID_SESSION"
```

### Analyze Player Journey

```bash
# Extract all events for specific run_id
docker logs games-webapp 2>&1 | grep "run_id.*abc123def456"

# Expected sequence for complete game:
# PLAY_HTML_ENTER → SESSION_CREATED → COOKIE_SET → AUTH_OK →
# RUN_START → RUN_START_OK → STATE(NOT_STARTED) →
# TIMER_START_REQUEST → TIMER_START_OK → STATE(ANSWERING) →
# ANSWER_SUBMIT → ANSWER_SUBMIT_OK → STATE(POST_ANSWER) →
# [repeat for 10 questions] →
# RUN_FINISH → RUN_FINISH_OK
```

### Filter by Event Type

```bash
# All quiz events
docker logs games-webapp 2>&1 | grep "event.*QUIZ_"

# Only errors/warnings
docker logs games-webapp 2>&1 | grep "event.*QUIZ_" | grep -E "level.*(error|warn)"

# Specific event
docker logs games-webapp 2>&1 | grep "event.*QUIZ_ANSWER_SUBMIT_OK"
```

### Production Monitoring

```bash
# Count events per hour (journalctl)
journalctl -u games-webapp --since "1 hour ago" | grep "event.*QUIZ_" | \
  awk -F'event":"' '{print $2}' | awk -F'"' '{print $1}' | sort | uniq -c

# Failed authentications rate
journalctl -u games-webapp --since "1 hour ago" | grep -c "QUIZ_AUTH_NO_SESSION"

# Auto-timeout rate (indicates UX issues)
journalctl -u games-webapp --since "1 day ago" | grep -c "QUIZ_AUTO_TIMEOUT_APPLIED"
```

## Filtering Guidelines

### What to Monitor

- **QUIZ_AUTH_NO_SESSION** spike → Client-side cookie issues
- **QUIZ_TIMER_START_FAIL** → Backend timer logic broken
- **QUIZ_AUTO_TIMEOUT_APPLIED** rate → Players not answering (UX issue?)
- **QUIZ_OWNERSHIP_DENY** → Possible tampering attempts
- **QUIZ_ANSWER_SUBMIT_FAIL** → Race conditions or logic bugs

### What to Ignore

- **QUIZ_AUTH_OK** (debug level) → Normal operation, only useful for detailed traces
- **QUIZ_STATE** (debug level) → Polling noise, only relevant on phase changes
- **QUIZ_SESSION_COOKIE_SET** → Normal operation, only needed for debugging session creation

## Frontend Integration

The frontend generates a trace_id on page load and includes it in all API requests:

```javascript
// Generated on page load
const TRACE_ID = generateTraceId(); // 8-char hex

// Added to all fetch calls
fetch('/api/quiz/run/123/state', {
  headers: { 'X-Trace-ID': TRACE_ID }
});
```

This enables client-server correlation: frontend console logs with `[QUIZ] trace_id: a1b2c3d4` can be matched to backend logs with `trace_id: a1b2c3d4`.

## Security Notes

- ❌ **Never logs**: `quiz_session` cookie, PIN codes, tokens, passwords
- ✅ **Safe to log**: player_id (UUID), run_id (UUID), session_token (server-generated UUID)
- ✅ **Safe to log**: Behavioral data (scores, answers, timings)
- ⚠️ **Do not expose**: Correct answer IDs before submission (logged after answer)

## Performance Impact

- Structured logging adds ~1-5ms per request (negligible)
- Noise management prevents /state endpoint from generating excessive logs
- Debug-level logs can be filtered out in production via log level configuration

## Configuration

Default log level: INFO (shows all events except AUTH_OK and normal STATE polls)

To enable debug logging:
```bash
# In production environment
export LOG_LEVEL=DEBUG

# Or via docker-compose
environment:
  - LOG_LEVEL=DEBUG
```

To enable debug flag for /state endpoint:
```
GET /api/quiz/run/<id>/state?debug=1
```

## Future Enhancements

- [ ] Add OpenTelemetry spans for distributed tracing
- [ ] Export logs to ELK stack or CloudWatch
- [ ] Add metrics (Prometheus) for event counts
- [ ] Add alerting for anomalies (high failure rates)
- [ ] Add session replay correlation (trace_id → replay_id)
