---
phase: 03-gmail
plan: 01
subsystem: auth
tags: [oauth2, gmail-api, googleapis, electron-store, pkce, google-auth]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Electron app structure, TypeScript configs, IPC patterns
  - phase: 02-imessage
    provides: Service singleton pattern, IPC handler patterns

provides:
  - Gmail OAuth2 authentication with PKCE security
  - Encrypted token storage using electron-store + safeStorage
  - Automatic token refresh handling
  - IPC bridge for renderer to trigger authentication

affects: [03-02, 03-03, 03-04, 03-05, 05-unified-inbox]

# Tech tracking
tech-stack:
  added: [googleapis, google-auth-library, electron-store@8]
  patterns: [OAuth PKCE flow, loopback HTTP server for callback, encrypted credential storage]

key-files:
  created:
    - src/main/services/gmailTypes.ts
    - src/main/services/gmailAuthService.ts
  modified:
    - src/main/ipc.ts
    - src/main/preload.ts
    - src/shared/ipcTypes.ts
    - src/renderer/electron.d.ts

key-decisions:
  - "electron-store v8 for CommonJS compatibility (main process uses CommonJS, v11 is ESM-only)"
  - "PKCE over basic OAuth (S256 code challenge method for enhanced security)"
  - "Loopback server on 127.0.0.1:8847 instead of custom protocol handler"
  - "Always prompt=consent to ensure refresh_token is granted"
  - "safeStorage encryption when available with plaintext fallback"

patterns-established:
  - "OAuth callback via HTTP server on localhost (port 8847)"
  - "Encrypted credential storage pattern for sensitive tokens"
  - "Environment variables for OAuth client credentials (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET)"

# Metrics
duration: 5min
completed: 2026-01-22
---

# Phase 3 Plan 1: Gmail OAuth Authentication Summary

**OAuth2 authentication with PKCE, encrypted token storage, and automatic refresh for Gmail API access**

## Performance

- **Duration:** 5min
- **Started:** 2026-01-22T14:05:01Z
- **Completed:** 2026-01-22T14:10:29Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Gmail OAuth2 flow with PKCE security opens system browser and captures callback via loopback server
- Tokens encrypted using Electron's safeStorage API and persisted across app restarts
- Automatic token refresh configured with event listener for seamless re-authentication
- Complete IPC bridge exposing authenticate, isAuthenticated, getUserEmail, disconnect to renderer

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create Gmail types** - `f4f68ba` (feat)
2. **Task 2: Create Gmail auth service with OAuth flow** - `6e96cd0` (feat)
3. **Task 3: Add auth IPC handlers and preload exposure** - `fbcc069` (feat)

## Files Created/Modified

**Created:**
- `src/main/services/gmailTypes.ts` - Type definitions for GmailTokens, GmailThread, GmailMessage, GmailAttachment, SendReplyOptions
- `src/main/services/gmailAuthService.ts` - Singleton OAuth service with PKCE flow, token storage, auto-refresh

**Modified:**
- `src/main/ipc.ts` - Added gmail:authenticate, gmail:isAuthenticated, gmail:getUserEmail, gmail:disconnect handlers
- `src/main/preload.ts` - Exposed window.electron.gmail API
- `src/shared/ipcTypes.ts` - Added GmailAuthStatus type
- `src/renderer/electron.d.ts` - Added gmail interface to ElectronAPI
- `package.json` - Added googleapis, electron-store@8

## Decisions Made

**1. Downgraded electron-store to v8 (from v11)**
- **Rationale:** Main process uses CommonJS (tsconfig.main.json), but electron-store v11 is ESM-only. Downgrading to v8 maintains CommonJS compatibility without requiring major refactor of build system.
- **Impact:** Loses some v11 features but maintains compatibility. Can upgrade when/if main process switches to ESM.

**2. PKCE with S256 code challenge method**
- **Rationale:** Enhanced security over basic OAuth. PKCE prevents authorization code interception attacks, especially important for desktop apps.
- **Implementation:** Generate random code verifier, hash with SHA-256 to create code challenge, exchange verifier during token request.

**3. Loopback HTTP server on 127.0.0.1:8847**
- **Rationale:** More reliable than custom protocol handlers. Works without app registration, easier debugging, clearer redirect flow.
- **Security:** Localhost-only binding, state parameter for CSRF protection, 5-minute timeout.

**4. Always use prompt=consent**
- **Rationale:** Ensures refresh_token is always granted. Without this, Google may not return refresh_token on subsequent authentications if user previously granted access.
- **UX impact:** User sees consent screen every time, but guarantees offline access capability.

**5. safeStorage with plaintext fallback**
- **Rationale:** Use hardware encryption when available (macOS Keychain), but don't break on systems without it. Better to have working auth than to require encryption.
- **Security:** Encrypted on macOS by default. Plaintext only if safeStorage unavailable (rare).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] electron-store v11 ESM incompatibility**
- **Found during:** Task 3 (Building with electron-store)
- **Issue:** electron-store v11 is ESM-only ("type": "module"), but main process uses CommonJS. TypeScript compiler failed with "Property 'set' does not exist on type 'ElectronStore'" because ESM types couldn't resolve in CommonJS context.
- **Fix:** Downgraded electron-store to v8.2.0, the last CommonJS-compatible version.
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm run build` succeeded, TypeScript compilation passed.
- **Committed in:** fbcc069 (Task 3 commit)

**2. [Rule 3 - Blocking] CodeChallengeMethod type error**
- **Found during:** Task 3 (TypeScript compilation)
- **Issue:** google-auth-library expects CodeChallengeMethod enum, not string literal 'S256'. Type error: "Type '"S256"' is not assignable to type 'CodeChallengeMethod | undefined'."
- **Fix:** Imported CodeChallengeMethod enum from google-auth-library and used CodeChallengeMethod.S256 constant.
- **Files modified:** src/main/services/gmailAuthService.ts
- **Verification:** TypeScript compilation passed.
- **Committed in:** fbcc069 (Task 3 commit)

**3. [Rule 3 - Blocking] getUserEmail return type handling**
- **Found during:** Task 3 (TypeScript compilation)
- **Issue:** electron-store v8 type signature for get() with defaultValue doesn't accept null. Type error: "Argument of type 'null' is not assignable to parameter of type 'string'."
- **Fix:** Changed from `store.get('gmail_user_email', null)` to `store.get('gmail_user_email') ?? null` using nullish coalescing.
- **Files modified:** src/main/services/gmailAuthService.ts
- **Verification:** TypeScript compilation passed.
- **Committed in:** fbcc069 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All deviations were type compatibility fixes required for compilation. No functional changes to plan. electron-store downgrade trades newer features for CommonJS compatibility, acceptable tradeoff given current build configuration.

## Issues Encountered

None - plan executed smoothly with only expected type compatibility fixes.

## User Setup Required

**External services require manual configuration.** Users must:

1. **Create Google Cloud Project and OAuth credentials:**
   - Go to https://console.cloud.google.com/
   - Create new project (or select existing)
   - Enable Gmail API
   - Configure OAuth consent screen (Desktop app type)
   - Create OAuth 2.0 Client ID credentials (Application type: Desktop app)
   - Download credentials JSON

2. **Set environment variables:**
   ```bash
   export GMAIL_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   export GMAIL_CLIENT_SECRET="your-client-secret"
   ```

3. **Verification:**
   - Start app: `npm run dev`
   - Call `window.electron.gmail.authenticate()` in DevTools console
   - Browser should open to Google consent screen
   - After approval, callback should succeed and tokens be stored
   - Check: `window.electron.gmail.isAuthenticated()` should return `true`
   - Check: `window.electron.gmail.getUserEmail()` should return authenticated email

**Note:** These credentials are developer-specific and should NOT be committed to git. Future plan should add onboarding UI to prompt for these credentials or guide user through setup.

## Next Phase Readiness

**Ready for next phases:**
- OAuth foundation complete, gmailAuthService.getOAuth2Client() available for Gmail API calls
- Token refresh automatic and transparent
- IPC bridge enables renderer to trigger auth flow and check status

**Blockers:**
- Users must manually configure Google Cloud credentials before authentication works
- Future plan (03-02 or later) should add onboarding flow to guide credential setup
- Consider adding UI for credential management instead of environment variables

**Concerns:**
- No validation that GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET are set until authenticate() is called
- Error message when credentials missing is clear but happens at runtime, not startup
- Consider adding startup check and UI prompt for missing credentials

---
*Phase: 03-gmail*
*Completed: 2026-01-22*
