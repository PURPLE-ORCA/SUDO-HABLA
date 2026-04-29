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