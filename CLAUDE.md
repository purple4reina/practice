# Claude Code Instructions: Practice Recorder

## Platform & Input Architecture

The app runs across four configurations. Two dimensions are handled independently:

### Dimension 1: Screen Width → Bootstrap breakpoints only
Bootstrap responsive classes (`col-md-X`, `@media (max-width: 767px)`) handle layout automatically. No build-time switch needed. An iPad Pro at 1024px naturally gets the desktop layout.

### Dimension 2: Input Modality (touch vs keyboard/mouse) → Three mechanisms

**Layer A — CSS `@media (hover: none) and (pointer: coarse)`**
Handles all visual/styling differences declaratively. No JS required.
- `.block-control` icons: always visible (dimmed grey) instead of white-on-white
- `:active` rules already exist on pattern buttons and replace `:hover` on touch

**Layer B — Runtime `body.touch-mode` class (set in `src/main.ts`)**
Set once at startup based on `window.matchMedia('(hover: hover) and (pointer: fine)')`. Drives JS behavior that CSS alone cannot change:
- `src/blocks/block.ts`: skips `mouseenter`/`mouseleave` listeners when `touch-mode` is active (icons stay at dimmed CSS color)
- Future touch-specific JS behavior should gate on `document.body.classList.contains('touch-mode')`

**Layer C — Build-time `--mode ios` flag**
For platform-level feature toggles only — NOT for interaction style:
- Base URL `/` vs `/practice/`
- `VITE_ENABLE_MONITORING` — disables Datadog in iOS builds
- Google Sign-In — disabled in iOS builds

**Key rule**: Use build-time flags for features that must be compiled out. Use runtime detection for interaction style, because a Bluetooth keyboard on an iPad should get keyboard behavior even in an iOS build.

### Block Controls (chevrons + trash)
In touch mode: always visible at reduced opacity (`color: #aaa; opacity: 0.6`), go full color on `:active`. The `hover-color` attribute on each icon drives the `:active` color in JS click handlers.
