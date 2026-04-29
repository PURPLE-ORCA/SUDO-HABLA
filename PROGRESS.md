## MISSION DEBRIEF: Sliding Window Scroll

### Executive Summary
Shipped a message-count-based sliding window scroll system for Ink's totalitarian rendering engine. Since Ink constantly overwrites stdout, native mouse wheel scrolling is destroyed. We built a "camera" that slices `history` via `scrollOffset` and renders only the visible window. Arrow keys and PageUp/PageDown move the camera. Active panels (quiz, commit confirm, PR actions) suppress scroll keys to avoid fighting `ink-select-input`. Inline indicators show when older/newer messages are off-screen. Debug status line confirms scroll state. TypeScript clean.

### Battle Log

**Iteration 1: The Architecture**
- *What:* Added `scrollOffset` state and `maxVisible` derived from `dimensions.rows - 12` (min 5).
- *Why:* Ink has no native scroll concept. We must manually window the history array.
- *Fix:* `history.slice(history.length - maxVisible - scrollOffset, history.length - scrollOffset)`.

**Iteration 2: The Key Binding**
- *What:* Bound `↑`/`↓` to +/- 1 message, `PageUp`/`PageDown` to +/- `maxVisible`.
- *Why:* Standard terminal scroll behavior. Page keys for fast traversal.
- *Fix:* Expanded `handleGlobalInput` type signature. Guarded with `hasActivePanel` check to avoid hijacking `SelectInput` focus in quiz/commit/PR panels.

**Iteration 3: The Window Size Fail**
- *What:* User reported scrolling did nothing. Arrow keys pressed, no visible change.
- *Why:* `maxVisible = rows - 12` gave ~28-38 messages for a 40-row terminal. With only 8-10 messages in history, `maxScroll = 0`. Camera had nothing to scroll.
- *Fix:* Shrunk window to `maxVisible = Math.max(3, Math.floor(rows / 8))`. For 50 rows = 6 messages. With 8 messages, `maxScroll = 2`. Scrolling now triggers.

**Iteration 4: The Visual Confirmation**
- *What:* User couldn't tell if scrolling worked even after fixing window size.
- *Why:* No visual feedback when scroll state changed.
- *Fix:* Added inline indicators: `↑ {n} older messages ↑` and `↓ newer messages below ↓`. Added debug status line at bottom: `[start..end/total msgs | offset:X | visible:Y/Z]`.

**Iteration 5: The Auto-Reset**
- *What:* When user submits new input, should camera snap to bottom?
- *Decision:* Yes. `setScrollOffset(0)` at top of `handleSubmit`. New input means user wants to see the response.

### Future Note
1. Could add `Home`/`End` keys for jump-to-top/bottom.
2. Could make `maxVisible` smarter: account for actual message line heights instead of raw count.
3. Could add mouse wheel support via raw mode (complex, platform-specific).
4. Could persist scroll position across sessions (probably not useful).

---

## MISSION DEBRIEF: Workspace Brain

### Executive Summary
Auto-detect local AI context files and inject into every prompt. Scans `llms.txt`, `.cursorrules`, `AGENT.md`, `AI.md` in `process.cwd()`. Returns formatted block `=== REPOSITORY RULES ===`. Silent fail. Zero UI noise. TypeScript clean.

### Battle Log

**Iteration 1: The Scanner**
- *What:* Added `getWorkspaceContext()` to `src/lib/workspace.ts`.
- *Why:* Need local project guidelines injected into AI context for terrifying accuracy.
- *Fix:* Iterate contextFiles array, `Bun.file(path).exists()` check, `text()` on first match, formatted return.

**Iteration 2: The Injection Point**
- *What:* Where to inject in handleSubmit?
- *Why:* Must be after all command interceptors format `aiPrompt`, but before `runAssistantPrompt`.
- *Fix:* Placed call just before `startThinking()`, appends to `userContent` via `+= workspaceContext`.

### Future Note
1. Could support multiple files and merge (current: first match only).
2. Could add `.aider.chat.history` or other AI metadata files.
3. Could cache file reads to avoid repeated I/O in same session.

---

## MISSION DEBRIEF: Ctrl+B Input Leak

### Executive Summary
Fixed Ctrl+B shortcut leaking stray `b` into TextInput while also toggling sidebar. Sidebar toggle now fires cleanly, input field stays pristine. TypeScript clean.

### Battle Log

**Iteration 1: The Symptom**
- *What:* Pressing Ctrl+B toggled sidebar but also appended literal `b` to input.
- *Why:* `ink-text-input` receives keystroke after `useInput` handler fires. No guard existed.
- *Fix:* Added `suppressNextInputChange` ref. On Ctrl+B, flag=true before toggle.

**Iteration 2: The Filter**
- *What:* Flag set, but TextInput still got `b`.
- *Why:* Need to actually filter the incoming `onChange` value.
- *Fix:* Wrapped input handler to drop trailing `b`/`B` when suppress flag is true. Reset flag after filter.

### Future Note
1. Could apply same pattern to other hotkeys that might bleed (Ctrl+C not in use, etc).
2. Could generalize suppress into a hotkey-to-input-map for cleaner handling.

---

## MISSION DEBRIEF: Update Nag (Distribution)

### Executive Summary
Shipped a background update checker that pings the NPM registry asynchronously on boot, compares semver versions, and renders a bright yellow nag below the ASCII logo if the user is behind. Uses a 24-hour TTL cache stored in `~/.sudo-habla.json` to avoid hammering the registry. Zero impact on the 300ms boot path. TypeScript clean.

### Battle Log

**Iteration 1: The Architecture**
- *What:* Built `src/lib/update.ts` with `checkForUpdates(localVersion)`.
- *Why:* NPM global packages don't auto-update. Users stay stuck on old versions forever.
- *Fix:* Pure async fetch. No blocking. Wrapped in `try/catch` so network failures are silent.

**Iteration 2: Semver, Not String Compare**
- *What:* Simple string comparison (`"1.10.0" > "1.9.0"`) fails because lexicographic ordering is wrong.
- *Why:* Need correct version ordering.
- *Fix:* Hand-rolled `parseSemver()` and `isNewer()` that destructure into `[major, minor, patch]` and compare numerically. No external dependency.

**Iteration 3: The TTL Cache**
- *What:* Hitting NPM on every boot is rude and slow.
- *Why:* Registry rate limits, user patience.
- *Fix:* Added `lastUpdateCheck` to `Config` type. Stores `{ timestamp, version }`. If cache age < 24h, returns cached result immediately. Writes cache back to disk best-effort (swallows write errors).

**Iteration 4: The Render**
- *What:* Where to show the nag?
- *Why:* Must be visible but not intrusive.
- *Fix:* Passed `updateAvailable` through `useReplController` → `Repl` → `ReplHeader`. Renders `<Text color="yellow">` directly below the logo. Conditionally rendered only when `updateAvailable` is truthy.

### Future Note
1. Could add a `/version` command to explicitly check for updates on demand.
2. Could show changelog URL or release notes in the nag.
3. Could add an auto-update command (`/update`) that runs `bun add -g sudo-habla` for the user.

---

## AUTOPSY REPORT: Sliding Window Scroll

### Executive Summary
Shipped a message-count-based sliding window scroll system for Ink's totalitarian rendering engine. Since Ink constantly overwrites stdout, native mouse wheel scrolling is destroyed. We built a "camera" that slices `history` via `scrollOffset` and renders only the visible window. Arrow keys and PageUp/PageDown move the camera. Active panels (quiz, commit confirm, PR actions) suppress scroll keys to avoid fighting `ink-select-input`. Inline indicator shows when older messages are above the fold. TypeScript clean.

### Battle Log

**Iteration 1: The Architecture**
- *What:* Added `scrollOffset` state and `maxVisible` derived from `dimensions.rows - 12` (min 5).
- *Why:* Ink has no native scroll concept. We must manually window the history array.
- *Fix:* `history.slice(history.length - maxVisible - scrollOffset, history.length - scrollOffset)`.

**Iteration 2: The Key Binding**
- *What:* Bound `↑`/`↓` to +/- 1 message, `PageUp`/`PageDown` to +/- `maxVisible`.
- *Why:* Standard terminal scroll behavior. Page keys for fast traversal.
- *Fix:* Expanded `handleGlobalInput` type signature. Guarded with `hasActivePanel` check to avoid hijacking `SelectInput` focus in quiz/commit/PR panels.

**Iteration 3: The Auto-Clamp**
- *What:* If history shrinks (e.g., `/clear`) or terminal resizes, `scrollOffset` could point past the array.
- *Why:* Unbounded offset causes empty panes or negative slices.
- *Fix:* `useEffect` watches `[history.length, maxVisible]` and clamps `scrollOffset` to `Math.min(prev, maxScroll)`.

**Iteration 4: The Inline Indicator**
- *What:* User needs to know they're not at the bottom.
- *Why:* Without visual feedback, scrolled state is invisible.
- *Fix:* `HistoryPane` renders `↑ {scrollOffset} older messages ↑` inline when `scrollOffset > 0`.

**Iteration 5: The Reset on Submit**
- *What:* When user sends a new message, should camera snap to bottom?
- *Decision:* Yes. `setScrollOffset(0)` at the top of `handleSubmit`. New input means user wants to see the response.

### Future Note
1. Could add `Home`/`End` keys for jump-to-top/bottom.
2. Could persist scroll position across sessions (probably not useful).
3. Could make `maxVisible` smarter: account for message heights instead of raw count.
4. Could add mouse wheel support via raw mode (complex, platform-specific).

---

## AUTOPSY REPORT: Session Persistence & /clear Command

### Executive Summary
Shipped persistent chat history backed by `~/.sudo-habla-history.json`. Adds `/clear` command to wipe history and disk. Three iterations: initial hydration sync, disk-gate timing, Ink remount fix. TypeScript clean.

### Battle Log

**Iteration 1: The Double Load**
- *What:* History hydrated in useEffect but no flag to gate disk saves. Save fired twice: once from empty-init, once from hydrate.
- *Why:* `setHistory([])` initial state triggers effect before mount, then async load triggers again.
- *Fix:* Added `historyHydrated` state. Only save after hydrate=true.

**Iteration 2: The Ghosting Bug**
- *What:* Large restored history caused ghost rendering. Old messages stuck in viewport.
- *Why:* Ink doesn't remount on state change. Viewport stays at old scroll position.
- *Fix:* Added `key={repl.historyHydrated ? "history-ready" : "history-boot"}` to `<HistoryPane>`. Forces full remount after load, snaps to bottom.

**Iteration 3: The /clear Cleanup**
- *What:* /clear should wipe disk and UI state but not pollute history array.
- *Why:* SetHistory([]) clears UI but not pending quiz/commit states. Stale UI elements persisted.
- *Fix:* In handleSubmit for CMD_CLEAR, explicitly clear input, stream, quiz, interview, pendingCommit, pendingPr alongside history.

### Future Note
1. Could auto-save on every message instead of effect for finer grain.
2. Could export history to file with `/export` command.
3. Could limit history size (e.g., last 100 messages) to prevent unbounded growth.
4. Could encrypt history at rest (future concern for sensitive commits).

---

## 🗺️ THE ROADMAP (What's Next)

### Future Points
- [ ] **Advanced `/quiz` Modes:** Expand the quiz state machine. Add "Hard Recall" (typing the translation without options) and "Scenario Mode" (AI generates a scenario, user types a full Spanish response).
- [ ] **Data Export:** Add a command to export the local `~/.sudo-habla-vocab.json` to an Anki-compatible CSV deck.
- [ ] **Session Encryption:** Encrypt history at rest for sensitive commit messages.

---

## 🏛️ ARCHITECTURAL DECISION RECORDS (ADRs)

* **ADR 001: The Hidden Brain (v1.1)**
  * *Context:* We needed the LLM to provide structured JSON vocabulary while streaming a fluent markdown roast.
  * *Decision:* Implemented a strict prompt injection forcing the AI to append `|||VOCAB||| [{"word": "x", "translation": "y"}] |||END_VOCAB|||` at the very end of its response. The UI intercepts, strips this block from stdout, and saves it silently to a local JSON DB.
* **ADR 002: Tab Autocomplete over Menus (v1.2)**
  * *Context:* Ink's `<SelectInput>` hijacked focus from the `<TextInput>`, breaking backspace and cursor positioning.
  * *Decision:* Ripped out vertical menus. Implemented a custom `useInput` hook to listen for `Tab` and auto-fill the command bar. 
* **ADR 003: Zen Mode UI (v1.2)**
  * *Context:* Large LLM responses (especially markdown tables) crashed Ink's Flexbox engine, squishing the sidebar.
  * *Decision:* Banned the AI from outputting markdown tables via prompt engineering, and added a `Ctrl + B` toggle to instantly hide the right sidebar, giving the chat pane 100% terminal width.
* **ADR 004: Bun Native over Node `fs` (v1.2)**
  * *Context:* Needed to read local files for the `/revisar` command.
  * *Decision:* Bypassed standard Node `fs` module in favor of `Bun.file().text()` for zero-config, high-speed asynchronous file reading.
* **ADR 005: Commit Confirmation State Machine (v1.2.1)**
  * *Context:* The `/commit` command needed a two-step flow: generate message → wait for user Y/N → execute `git commit`.
  * *Decision:* Built a `pendingCommit` state that triggers a dedicated `<CommitConfirmPanel>` with `<SelectInput>`. When user confirms, execute `git commit -m` with proper error handling.
* **ADR 006: PR Post-Export Panel (v1.3)**
  * *Context:* `/pr` generates PR description in Spanish. Terminal cannot create real panes, so mouse selection grabs both sidebar and chat content. We needed a clean copy mechanism.
  * *Decision:* After `/pr` generates description, show `<PrActionPanel>` with three choices: copy to clipboard (via `pbcopy`), write `PR_DESCRIPTION.md` to project root, or skip. Uses same `SelectInput` state pattern as `/commit`.
* **ADR 007: Session Persistence (v1.4)**
  * *Context:* Chat history lost on app restart. Users wanted conversation continuity.
  * *Decision:* Added `~/.sudo-habla-history.json` with load/save/clear using Bun file I/O. Hydrates on mount, persists on state change. Added `/clear` command.
  * *Tradeoff:* Async hydration means first render may show empty. Added key remount to force scroll position.

---

## 📜 CHANGELOG / HISTORY

### **v1.4.0** - *The Session Persistence Update* (Current)
* **Feature:** Added persistent session history backed by `~/.sudo-habla-history.json`. Chat survives app restarts.
* **Feature:** Added `/clear` command to wipe chat history from disk and UI.
* **Feature:** History hydrates on mount. Saves on every state change.
* **Fix:** Hydration gated with `historyHydrated` flag to prevent double-save race.
* **Fix:** `<HistoryPane>` remounts after hydrate to snap viewport to bottom, preventing ghost rendering.
* **Refactor:** Extracted session utilities to `src/lib/session.ts` following existing pattern (config/vocab).
* **Type:** All builds clean with `bunx tsc --noEmit`.

### **v1.3.0** - *The Terminal Hardening & /pr Update*
* **Feature:** Added `/pr` command. Reads `git diff main...HEAD` + worktree, generates structured Spanish PR description with sections: ## Resumen, ## Cambios principales, ## Riesgos, ## Cómo probar.
* **Feature:** Adds `origin/main` detection: prefers remote base when available, falls back to local `main`.
* **Feature:** Includes dirty worktree: reads both `--staged` and unstaged diff, so uncommitted changes appear in PR output.
* **Feature:** Built `<PrActionPanel>` using `ink-select-input`. After PR generation, user picks: copy to clipboard (macOS `pbcopy`), write `PR_DESCRIPTION.md` to project root, or skip.
* **Feature:** Added `/copy` implicit hint in header: "Ctrl+B Zen / copy last response".
* **Fix:** Stripped `marked-terminal` renderer. Built pure Ink-native `<Markdown>` using `flexDirection="column"`. Wraps headings (`##`), code blocks (` ``` `), bullets, and plain text correctly.
* **Fix:** Added `flexShrink={0}` to sidebar to prevent it from compressing when main content grows.
* **Fix:** Added `overflow="hidden"` to `<HistoryPane>` and main `Box` to prevent ghost rendering on terminal overflow.
* **Refactor:** Centralized hidden-block extraction via `stripHiddenBlock()` helper in controller. Supports both `COMMIT` and `PR` hidden payloads.œ
* **Type:** All builds clean with `bunx tsc --noEmit`.
* **Feature:** Added `/blame <filepath>` command. Runs local `git blame --line-porcelain` through Bun, picks blame-heavy culprit, and feeds exact blame facts into a Spanish rant.
* **Feature:** Built `src/lib/replBlame.ts` to parse blame output, count non-empty owned lines per author, and extract concrete snippet evidence.
* **UX:** Registered `/blame` in Tab Autocomplete and added targeted usage / missing-blame error messages.
* **History:** Previous `/commit` confirmation work remains shipped below. Roadmap still points at broader v1.3.0 hardening work.

### **v1.2.1** - *The Commit Confirmation Update*
* **Feature:** Added `/commit` command. Reads git diff → generates Spanish commit message → shows Y/N confirmation panel → executes `git commit`.
* **Feature:** Created `<CommitConfirmPanel>` using `ink-select-input` (same pattern as onboarding provider/model selectors).
* **Feature:** Added `pendingCommit` state machine in `useReplController` to manage the two-step flow.
* **Refactor:** AI wraps commit message in `|||COMMIT|||` delimiters so UI can extract and clean visibleText.
* **Fix:** Hardened `git commit` execution with exitCode check and stderr capture.
* **Fix:** Resolved TypeScript errors (undefined `commitMatch[1]`, leftover `pendingCommit` prop in `InputBar`).

### **v1.2.0** - *The Scrum Master Update*
* **Feature:** Added `/daily <update>` command. Intercepts English updates, translates to Spanish, and roasts velocity via custom system prompt.
* **Feature:** Added `/entrevista` command. Triggers a two-step state machine for interactive technical interviews.
* **Feature:** Added `/revisar ` command. Uses `Bun.file()` to read local source code and pass it to the LLM for targeted Spanish code reviews.
* **Feature:** Added Moonshot AI (Kimi) model support via OpenAI-compatible API overriding.
* **UX:** Replaced buggy dropdown menus with native Tab Autocomplete.
* **UX:** Implemented `Ctrl + B` Zen Mode to toggle the vocabulary sidebar.
* **UI:** Upgraded layout with `#A855F7` purple branding, dynamic terminal height resizing via `useStdout`, and traffic-light color-coding for vocabulary mastery (`red/yellow/green`).

### **v1.1.1** - *The Bin Hotfix*
* **Fix:** Corrected an invalid `bin` path in `package.json` (missing `./`) that caused NPM to strip the executable on publish.

### **v1.1.0** - *The "I Actually Remember Things Now" Update*
* **Refactor:** Destroyed the original 400-line spaghetti `index.tsx`. Separated concerns into `src/components`, `src/lib`, and `src/prompts`.
* **Feature:** Migrated to Vercel AI SDK. Ripped out hardcoded OpenAI calls to support dynamic provider routing.
* **Feature:** Added `/config` onboarding flow to securely store API keys in `~/.sudo-habla-config.json`.
* **Feature:** Implemented dynamic model fetching to ping provider APIs directly for available text models.
* **Feature:** Built the Local Vocab Database (`src/lib/vocab.ts`) tracking word, translation, count, and mastery level.
* **UI:** Built the React Flexbox Split-Pane Dashboard with a persistent "Cheat Sheet" sidebar.

### **v1.0.0** - *Genesis*
* Initial proof of concept. Basic CLI REPL built with Bun and Ink.
* Hardcoded OpenAI integration. Basic `/roast`, `/lore`, and `/meaning` commands defined in a single file.

---

## 🔬 AUTOPSY REPORT: /Commit Command Implementation

### Executive Summary
Successfully shipped the `/commit` command with a two-step state machine: generate Spanish commit message from git diff → Y/N confirmation via `<SelectInput>` → execute `git commit`. Initial implementation had a silent failure bug and TypeScript errors, both resolved before commit.

### Battle Log

**Iteration 1: The Text Input Fiasco**
- *What:* Built Y/N confirmation as a text input asking user to type 'y' or 'n'.
- *Why it failed:* Users expected a menu selector (like onboarding), not typing. Also hijacked TextInput focus.
- *Fix:* Ripped out text input, built `<CommitConfirmPanel>` with `ink-select-input`.

**Iteration 2: The Ghosting Bug**
- *What:* Commit message wasn't showing up in the confirmation panel. `|||COMMIT|||` delimiters weren't being extracted.
- *Why it failed:* First regex only removed delimiters but left message in chat history, confusing users. Also AI wasn't outputting the delimiters reliably.
- *Fix:* Updated `COMMIT_PROMPT_INJECT` to force delimiters. Added greedy regex to remove entire block from `visibleText`.

**Iteration 3: The Silent Failure**
- *What:* Commit didn't execute. No error shown to user.
- *Why it failed:* `Bun.spawnSync` was called without capturing stderr or exit code. Errors swallowed.
- *Fix:* Added `{ stderr: "pipe" }` and explicit `exitCode !== 0` check with error message.

**Iteration 4: TypeScript Tantrums**
- *What:* Two TS errors:
  1. `commitMatch[1]` possibly undefined
  2. `InputBar` still required `pendingCommit` prop after we removed it from UI
- *Fix:* Added `&& commitMatch[1]` guard. Removed `pendingCommit` from `InputBarProps` entirely.

### Future Note
The `/commit` feature is now working, but we should monitor:
1. Does the AI reliably output `|||COMMIT|||` delimiters? If not, we may need stricter prompt enforcement.
2. Long commit messages might overflow the panel — consider truncating in `CommitConfirmPanel`.
3. Could add `git commit --amend` support or staging (`git add` first) in v1.3.

---

## AUTOPSY REPORT: /Blame Command Implementation

### Executive Summary
Shipped `/blame` toxic coworker autopsy command. Parses `git blame --line-porcelain` via Bun, identifies culprit by most non-empty lines owned, extracts 3 worst snippets, and feeds facts to AI for a hyper-specific Spanish rant. Two commits: feature + release bump. TypeScript clean.

### Battle Log

**Iteration 1: The Hidden Brain Pattern**
- *What:* Reused existing `/revisar` + `/commit` intercept pattern with hidden prompt injection and `|||VOCAB|||` extraction.
- *Why it works:* Minimal code duplication. Same state machine flow, just different prompt + parser.
- *Fix:* Built `src/lib/replBlame.ts` helper to keep controller clean.

**Iteration 2: The Blame Parsing Chaos**
- *What:* `git blame --line-porcelain` output is weird. Author lines, commit hashes, tab-prefixed content, all interleaved.
- *Why it failed:* Initial regex tried to grab commit hash lines as content. Wrong data.
- *Fix:* Track `currentAuthor` on `author` line, track `currentLineNumber` on hash line, only grab tab-prefixed lines as actual content. Normalize whitespace.

**Iteration 3: The Culprit Selection**
- *What:* How to pick who to blame? Most lines? Most recent? Longest snippets?
- *Why it failed:* "Most lines" is deterministic and reflects actual ownership. Others add complexity without clear signal.
- *Fix:* Sorted author counts descending, pick top entry. Simple, defensible, funny.

**Iteration 4: The Empty File Edge Case**
- *What:* Untracked files or empty files return null from `summarizeFileBlame`.
- *Why it failed:* No blame data means no rant. User sees confusing error.
- *Fix:* Check file exists first with `Bun.file().exists()`. Distinguish between "file missing" and "blame useless" in error messages.

**Iteration 5: The TypeScript Ghosts**
- *What:* Tiny TS errors around import ordering and possibly undefined map entries.
- *Why it failed:* Strict mode, `culpritEntry` could be undefined.
- *Fix:* Added `if (!culpritEntry)` guard. Added explicit `?? 0` fallback on map get.

### Future Note
Monitor:
1. Does blame correctly handle renamed files? May need `-M` flag.
2. Binary files: should detect and refuse gracefully.
3. Could add `--date-order` or `--ignore-rev` flags for advanced roasting.
4. Consider "most recent author" alternative heuristic for variety.

---

## AUTOPSY REPORT: /pr Command Implementation

### Executive Summary
Shipped `/pr` command with post-generation export panel. Solves terminal selection problem by giving users programmatic export choices instead of relying on mouse selection. Three iterations from empty output to working clipboard/file flow. TypeScript clean.

### Battle Log

**Iteration 1: Empty Output**
- *What:* First run showed empty response.
- *Why:* Prompt forced `|||PR||| ... |||END_PR|||` hidden block. Model put all text inside delimiters. UI stripped it. Result: visible text empty.
- *Fix:* Removed delimiting requirement. Made PR body visible text, not hidden payload.

**Iteration 2: Terminal Layout Nuke**
- *What:* Markdown rendering broke layout. Text squished sidebar. Borders wrong.
- *Why:* Ink Box defaults to `flexDirection="row"`. Assistant responses rendered each line as horizontal columns. Sidebar compressed.
- *Fix:* Stripped `marked-terminal`. Built own Ink-native `<Markdown>` component. Added `flexDirection="column"` to message Box. Added `flexShrink={0}` to sidebar.

**Iteration 3: Clipboard vs File Export**
- *What:* User wanted clean copy without mouse selection fighting sidebar.
- *Why:* Terminal selection is rectangular, grabs both panes. No way to separate in Ink.
- *Fix:* Added `<PrActionPanel>` after `/pr`. Options: copy to clipboard (pbcopy), write `PR_DESCRIPTION.md` to root, or skip. Same SelectInput pattern as `/commit`.

### Future Note
1. Could add more export formats: GitHub PR body, JSON, Slack markdown.
2. Could auto-detect base branch: `origin/develop`, `origin/main`, or explicit flag.
3. Could add prompt variants: "short", "detailed", "for management".
4. `/pr` runs every time; could cache last output and re-export without regenerating.

---

## AUTOPSY REPORT: Rotating Thinking Indicator

### Executive Summary
Shipped rotating loading indicator. Hostile messages rotate every 1500ms, braille spinner frames 100ms, kills on first stream chunk. Three iterations: initial pattern, first-chunk handler, lifecycle wiring errors. TypeScript clean.

### Battle Log

**Iteration 1: The Hidden Brain Pattern**
- *What:* Reused existing intercept pattern for loading state. Added three state variables: isThinking boolean, loadingMessage string, spinnerFrameIndex number.
- *Why it works:* Same hidden extraction flow as other features. Keep controller logic centralized.
- *Fix:* Created `startThinking()` / `stopThinking()` helper pair. Exposed `isThinking` and `loadingIndicator` to UI.

**Iteration 2: The First Chunk Problem**
- *What:* Indicator spun forever after AI started streaming. Stop only in `finally` block after full response.
- *Why it failed:* `runAssistantPrompt` wraps full stream, then processes hidden blocks. Indicator only stops after complete response.
- *Fix:* Wrapped `onText` callback inside `streamAssistantResponse`. Added `hasReceivedFirstChunk` flag. Immediately call `stopThinking()` on first non-empty text. Then pass to normal `setCurrentStream`.

**Iteration 3: The Lifecycle Gaps**
- *What:* Missing `stopThinking()` on error paths. `/commit` git operations ran without loading state. Quiz flow missed indicator.
- *Why it failed:* Many early-return paths after heavy work but before AI call. Each needed explicit `startThinking()` or `stopThinking()`.
- *Fix:* Added `startThinking()` before each heavy operation: `/commit`, `/pr`, `/blame`, `/revisar`, quiz submit, commit confirm. Added `stopThinking()` on every error catch, early returns after heavy work, and final `finally` blocks.

### Future Note
1. Could add more hostile messages: more Spanish options, random mix.
2. Could add visual variants: color changes, different speeds.
3. Commit confirm flow already shows indicator but needs test.
4. Could show "Wrote PR_DESCRIPTION.md" success message after export with different spin state.

---

## MISSION DEBRIEF: Context Injection Mentions

### Executive Summary
Shipped `@filepath` context injection plus autocomplete. Typing `@` now shows workspace file suggestions, Tab inserts path, and submit injects file contents into hidden system prompt. One bug hit: picked path still carried literal `@` into filesystem lookup. TypeScript clean.

### Battle Log

**Iteration 1: The Hidden Context Hook**
- *What:* Added mention parsing and prompt injection flow.
- *Why it worked:* Kept visible user text intact, pushed file code into hidden system prompt.
- *Fix:* Reused existing stream pipeline with optional system override.

**Iteration 2: The `@` Autocomplete Layer**
- *What:* Added suggestions after `@`, filtered by typed path prefix.
- *Why it worked:* Pulled workspace file list from `git ls-files` and used Tab insertion.
- *Fix:* Added `MentionMenu` and `getWorkspaceFiles()` helper.

**Iteration 3: The `@` Leakage Bug**
- *What:* `/revisar @src/components/Repl.tsx` failed with file-not-found.
- *Why it failed:* UI autocomplete inserted `@path`, but filesystem lookup expected raw path.
- *Fix:* Normalized mention-prefixed file paths at command boundary with `normalizeMentionPath()`.

### Future Note
1. Could add fuzzy matching and directory-first ranking.
2. Could show file type badges in mention menu.
3. Could cache workspace file list to avoid repeated git scan.
4. Could support multiline context picks and multiple mention blocks in one question.

# AUTOPSY REPORT: Session Persistence & /clear Command

## Executive Summary
Shipped persistent chat history backed by `~/.sudo-habla-history.json`. Adds `/clear` command to wipe history and disk. Three iterations: initial hydration sync, disk-gate timing, Ink remount fix. TypeScript clean.

## Battle Log

### Iteration 1: The Double Load
- *What:* History hydrated in useEffect but no flag to gate disk saves. Save fired twice: once from empty-init, once from hydrate.
- *Why:* `setHistory([])` initial state triggers effect before mount, then async load triggers again.
- *Fix:* Added `historyHydrated` state. Only save after hydrate=true.

### Iteration 2: The Ghosting Bug
- *What:* Large restored history caused ghost rendering. Old messages stuck in viewport.
- *Why:* Ink doesn't remount on state change. Viewport stays at old scroll position.
- *Fix:* Added `key={repl.historyHydrated ? "history-ready" : "history-boot"}` to `<HistoryPane>`. Forces full remount after load, snaps to bottom.

### Iteration 3: The /clear Cleanup
- *What:* /clear should wipe disk and UI state but not pollute history array.
- *Why:* SetHistory([]) clears UI but not pending quiz/commit states. Stale UI elements persisted.
- *Fix:* In handleSubmit for CMD_CLEAR, explicitly clear input, stream, quiz, interview, pendingCommit, pendingPr alongside history.

## Future Note
1. Could auto-save on every message instead of effect for finer grain.
2. Could export history to file with `/export` command.
3. Could limit history size (e.g., last 100 messages) to prevent unbounded growth.
4. Could encrypt history at rest (future concern for sensitive commits).
