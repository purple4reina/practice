# iOS App Store Publishing Plan: Practice to Perfection

## How to Use This Plan
This is the master plan. At the start of each sub-task session, say: **"refer to the master iOS plan"** and I will read this file to orient myself before we begin. Use `/plan` in the CLI at any time to view it. Each sub-task will have its own focused plan; when it completes, we return here to check off the step and move to the next one.

## Context

This is the master plan for packaging the existing TypeScript/Vite "Practice to Perfection" web app as an iOS App Store app. The app is a musician's practice tool with metronome, audio recording/playback, waveform visualization, pitch detection, video recording, and MIDI playback — all built on Web Audio API, MediaStream, Canvas, and localStorage.

The goal: publish to the App Store while keeping the GitHub Pages web app fully functional. Android support should remain possible in the future. The user has no prior iOS development experience.

**Packaging Approach: Capacitor (by Ionic)**
Chosen over Cordova (deprecated) and pure PWA submission (insufficient API access). Capacitor wraps the built web app in a WKWebView, integrates directly with the Vite build pipeline, and supports Android as a first-class target.

---

## Known iOS-Specific Code Issues to Fix

These must be fixed before or during Capacitor integration:

| # | File | Issue | Fix |
|---|---|---|---|
| 1 | `src/main.ts:42` | `new AudioContext()` created at class construction — iOS suspends it until user gesture | Add one-time `touchstart`/`click` listener that calls `audioContext.resume()` |
| 2 | `src/main.ts:36-39` | Monitoring/Google Sign-In only enabled for `purple4reina.github.io` hostname — Capacitor runs from `capacitor://localhost` | Extend check with a `VITE_ENABLE_MONITORING` env var flag for iOS builds |
| 3 | `src/recorder.ts:81-82` | AudioWorklet loaded via Blob URL — WKWebView may block blob: URLs due to CSP | Already has ScriptProcessorNode fallback at line 40-42; verify fallback works and log it |
| 4 | `src/video-recorder.ts:3-4` | Hardcoded `video/webm;codecs=vp9` MIME type — iOS does not support WebM | Replace with runtime `MediaRecorder.isTypeSupported()` detection; prefer `video/mp4` on iOS |
| 5 | `vite.config.js:2` | `base: '/practice/'` is wrong for Capacitor (needs `base: '/'`) | Add dual-mode build: `npm run build:ios` uses `--mode ios` with `base: '/'` |

---

## Phase 1: Prerequisites & Dev Environment Setup
**Estimated effort: 1-2 days (mostly waiting for downloads)**
**Cost: FREE — Apple Developer Program enrollment is deferred to Phase 6**

A free Apple ID is sufficient for everything through Phase 4 (testing). Xcode's "personal team" signing allows you to install and test on your own iPhone without a paid account.

- [ ] Install Xcode from Mac App Store (~14 GB download)
- [ ] Open Xcode once to accept license and install CLI tools; verify `xcodebuild -version`
- [ ] Sign in to Xcode with your Apple ID (free): Xcode → Settings → Accounts → Add Apple ID
- [ ] Install CocoaPods: `sudo gem install cocoapods` (required by Capacitor for iOS deps)
- [ ] Download iOS Simulator in Xcode → Settings → Platforms (iOS 17 or 18)
- [ ] Register physical iPhone for testing: connect via USB, Xcode → Window → Devices

**Notes:**
- Simulator cannot access the Mac microphone — all audio recording tests require a real device
- Enable Web Inspector on iPhone: Settings → Safari → Advanced → Web Inspector (needed for debugging)
- With a free Apple ID: apps signed with "Personal Team" expire after 7 days and must be re-installed; limited to 3 registered devices. This is fine for development testing.
- **The $99 Apple Developer Program is only required in Phase 6 when submitting to the App Store.**

---

## Phase 2: Code Fixes for iOS Compatibility
**Estimated effort: 1-2 days**

Fix the 5 issues listed above in order:
1. Extend `vite.config.js` to support `mode === 'ios'` with `base: '/'`; add `"build:ios"` script to `package.json`
2. Expand the monitoring/login hostname check in `main.ts` to use `VITE_ENABLE_MONITORING` env var
3. Fix `video-recorder.ts` MIME type detection with `MediaRecorder.isTypeSupported()` fallback chain: `video/mp4` → `video/webm;codecs=vp9` → `video/webm`
4. Add AudioContext user-gesture unlock in `main.ts` (one-time `touchstart`/`click` listener calling `audioContext.resume()`)
5. Verify the ScriptProcessorNode fallback path in `recorder.ts` still works (it should — only the Blob URL loading may fail on WKWebView)

---

## Phase 3: Capacitor Integration
**Estimated effort: 2-3 days**

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Practice to Perfection" "com.yourname.ptp" --web-dir docs
npm install @capacitor/ios
npx cap add ios
```

- [ ] Create `capacitor.config.ts` with app ID, `webDir: 'docs'`, and `server.allowNavigation` for CDN domains
- [ ] Add iOS permission strings to `ios/App/App/Info.plist`:
  - `NSMicrophoneUsageDescription` — audio recording
  - `NSCameraUsageDescription` — video recording (optional feature)
- [ ] Install `@capacitor/assets`: `npm install --save-dev @capacitor/assets`
- [ ] Create source `assets/icon.png` (1024×1024 px, no transparency) and `assets/splash.png` (2732×2732)
- [ ] Generate all icon sizes: `npx capacitor-assets generate --ios`
- [ ] Build and sync: `npm run build:ios && npx cap sync ios`
- [ ] Open in Xcode: `npx cap open ios`
- [ ] In Xcode: Signing & Capabilities → check "Automatically manage signing" → select your Team

---

## Phase 4: Testing
**Estimated effort: 3-5 days of iterative testing**

### Simulator (UI only, no audio)
- App loads and renders correctly
- Block manager UI, settings panel, canvas visualization
- Navigation between saves

### Real Device (required for all audio)
Test matrix in order of priority:

| Feature | What to verify |
|---|---|
| Microphone permission | iOS dialog appears on first launch |
| AudioContext unlock | Audio works after first tap anywhere on screen |
| Audio recording | Record → play instrument → Stop → waveform appears |
| Metronome click | Audible and correctly timed |
| Drone tone | Starts/stops, pitch changes work |
| Slow-down playback | Recorded audio plays back at fractional speeds |
| Pitch detection/Tuner | Intonation overlay appears on waveform |
| Video recording | Toggle video → record → preview appears (mp4 format) |
| Save/load | Create save, force-quit app, reopen, load save |
| Download | Download button → iOS share sheet appears |

### Debugging on Device
Connect iPhone to Mac → Safari DevTools (Develop menu → [your iPhone]) → Console for logs

### Target iOS versions
- Minimum: iOS 15 (for maximum reach; set in Xcode deployment target)
- Test on: iOS 16, iOS 17, iOS 18
- Audio critical note: AudioWorklet supported since iOS 14.5; Blob URL loading uncertain — the ScriptProcessorNode fallback handles this

---

## Phase 5: Mobile UI / Responsive Design
**Estimated effort: 1-2 weeks (scope depends on how much redesign is needed)**

The existing UI was designed for laptop/desktop. On a phone it renders poorly — controls are too small, layout wraps badly, and the overall flow isn't touch-friendly. This phase is deferred until core functionality is proven working on iOS (audio, recording, playback, video all pass Phase 4 testing). Do not start this phase until the functional baseline is confirmed.

### Goals
- The app should be usable with one hand on a phone screen
- Controls must be large enough to tap accurately (Apple HIG minimum: 44×44 pt tap targets)
- Key flows (start recording, stop, play back) should be reachable without scrolling
- The waveform visualization needs to work on a narrow screen

### Approach
- Audit the current layout at 390px wide (iPhone 14 viewport) — identify every broken or cramped element
- Use CSS media queries to apply a mobile layout when width < ~768px; the desktop layout stays untouched for the web app
- Consider collapsing the block manager into a scrollable drawer or accordion on mobile
- Ensure Bootstrap breakpoints are used correctly (the app already imports Bootstrap 5)
- Touch event handling: verify drag interactions (waveform scroll/zoom) work with touch, not just mouse

### What NOT to do in this phase
- Do not redesign the desktop web app experience
- Do not add new features
- Do not change any audio/recording logic

### Re-test after UI changes
Run the same functional test matrix from Phase 4 again to confirm no regressions.

---

## Phase 6: App Store Setup & Submission Materials
**Estimated effort: 1 week**
**This is when the $99 Apple Developer Program enrollment happens.**

### Step 0: Enroll in Apple Developer Program
- [ ] Enroll at developer.apple.com/programs/enroll ($99/year)
- [ ] Wait 24-48 hours for approval
- [ ] Accept the Apple Developer Program License Agreement

### App Store Connect
- [ ] Create app record at appstoreconnect.apple.com
- [ ] Set Bundle ID, app name, SKU, primary category: **Music**, secondary: **Education**
- [ ] Age rating: **4+**

### Required Metadata
- **App Name (≤30 chars):** "Practice to Perfection" (23 chars — fits)
- **Subtitle (≤30 chars):** "Metronome, Record & Analyze"
- **Keywords (≤100 chars, comma-separated):** `metronome,recorder,practice,music,pitch,tuner,tempo,musician,instrument,waveform`
- **Description (≤4000 chars):** Lead with "record + slow down playback" hook; list: metronome, pitch detection, waveform visualization, MIDI playback, drone tone, video recording
- **Promotional text (≤170 chars):** Can change without re-review; use for "What's New"
- **Support URL:** GitHub Pages or simple README page

### Privacy Policy
Required before submission. Must document:
- Audio recordings: stay on device, not transmitted
- Datadog RUM telemetry (if enabled in iOS build): usage data, linked to identity
- Google Sign-In email (if enabled): linked to identity
Recommend disabling both Datadog and Google Sign-In in the iOS build to simplify privacy labels.

### Screenshots (required device sizes)
| Device | Resolution |
|---|---|
| 6.9-inch iPhone (16 Pro Max) — **required** | 1320 × 2868 px |
| 6.5-inch iPhone (11 Pro Max / 12 Pro Max) — **required** | 1242 × 2688 px |
| 5.5-inch iPhone (8 Plus) — **required** | 1242 × 2208 px |

Capture in Xcode Simulator (File → Take Screenshot). Annotate with feature callouts in Figma or Canva. Aim for 3-5 screenshots per size showing the key flows.

### App Icon
1024×1024 px PNG, no transparency, no rounded corners (Apple adds them). Simple bold symbol: consider a microphone + waveform or metronome + play button in the app's purple brand color.

### Build & Upload
1. In Xcode: build scheme → "Any iOS Device (arm64)"
2. Product → Archive → Distribute App → App Store Connect → Upload
3. Build appears in App Store Connect → TestFlight & Releases → Builds

### TestFlight (recommended before submission)
- Add yourself as internal tester
- Install TestFlight on iPhone
- Test the exact build that will be submitted

### App Review Notes to Include
"Core features (recording, metronome, playback, pitch detection) work without internet. Microphone permission is required. Video recording is optional. No login is required to use the app."

### App Review Compliance Risks
- **Guideline 4.2 (thin wrapper):** Mitigated by genuine functionality (audio recording, pitch detection, visual waveform) — emphasize this in review notes
- **Guideline 2.5.6 (web views):** Ensure no links open the Safari browser unexpectedly; use Capacitor's in-app browser for external links
- **Privacy nutrition labels:** Declare audio data (on-device only, not linked to identity) and any analytics

---

## Phase 7: Marketing & App Store Optimization
**Estimated effort: 2-3 days**

- Research competing apps for keyword gaps (search "metronome recorder", "practice recording app")
- Keyword field excludes words already in title/subtitle — target long-tail: `slow practice`, `intonation tuner`, `recording metronome`, `waveform recorder`, `beat counter`
- Icon must stand out at small sizes (120×120 px) — test thumbnails early
- First 3 lines of description appear without expansion — make them count
- Promotional text can be updated anytime without re-review — useful for A/B-like iteration

---

## Order of Operations

```
[FREE] 1. Install Xcode + CocoaPods (free, no Apple Developer account needed yet)

[CODE] 2. Fix all 5 iOS compatibility issues in source code
[CODE] 3. Verify dual-mode Vite build works: npm run build && npm run build:ios

[CAP] 4. Install Capacitor, init, add ios
[CAP] 5. Configure capacitor.config.ts, Info.plist permissions
[CAP] 6. Generate icons and splash screens

[TEST] 7. Build and test on iOS Simulator — sign with free "Personal Team" Apple ID
[TEST] 8. Build and test on real iPhone — prove core functionality: audio, recording, playback, video
[TEST] 9. Fix any functional issues, repeat as needed

[UI]   10. Audit mobile layout at 390px, implement responsive CSS fixes
[UI]   11. Re-run functional test matrix to confirm no regressions

[$$]   12. Enroll in Apple Developer Program ($99/year) → wait for approval (1-2 days)

[ASSETS] 13. Write privacy policy and host it          ← do these while waiting for enrollment
[ASSETS] 14. Write App Store metadata (name, subtitle, description, keywords)
[ASSETS] 15. Capture and annotate screenshots (showing the polished mobile UI)

[SUBMIT] 16. Archive and upload build from Xcode (requires paid account)
[SUBMIT] 17. TestFlight beta test on real device
[SUBMIT] 18. Submit for App Store Review

[WAIT]   19. Wait for review (24-72 hours typical)
[ITERATE] 20. Post-launch: iterate on keywords and screenshots based on search performance
```

---

## Tools & Accounts Needed

| Item | Cost | Purpose |
|---|---|---|
| Apple Developer Program | $99/year | Required for App Store distribution |
| Xcode | Free (Mac App Store) | Build, sign, archive, submit |
| CocoaPods | Free | iOS dependency manager (used by Capacitor) |
| `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios` | Free npm packages | iOS wrapping |
| `@capacitor/assets` | Free npm package | Icon/splash generation |
| Figma (free tier) | Free | Screenshot annotation, icon design |
| Privacy policy host | Free | GitHub Pages static page |
| Physical iPhone | Already owned | Real device testing (required for audio) |

---

## Estimated Total Timeline: 5-7 weeks
- Phase 1 (setup): 1-2 days
- Phase 2 (code fixes): 1-2 days
- Phase 3 (Capacitor): 2-3 days
- Phase 4 (functional testing): 3-5 days
- Phase 5 (mobile UI): 1-2 weeks
- Phase 6 (submission): 5-7 days (including review wait)
- Phase 7 (ASO): 2-3 days
