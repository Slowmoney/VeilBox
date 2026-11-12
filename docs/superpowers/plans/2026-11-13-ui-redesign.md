# VeilBox UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the VeilBox UI with a restrained, Incy/Happ-like three-tab app on one from-scratch design system, and show live AmneziaWG tunnel status on Главная.

**Architecture:** The store (`src/store/useAppStore.ts`), IPC bridge (`src/lib/tauri.ts`) and Rust stay; the UI layer is rewritten: `src/ui/` primitives + `src/screens/` screens + one stylesheet `src/styles.css` written from scratch. Pure logic (import detection, handshake health, profile grouping) lives in `src/lib/` with vitest tests. One new Rust module parses `awg show … dump` and backs a new `amnezia_status` command.

**Tech Stack:** React 18, react-router 6 (HashRouter), zustand 5, lucide-react, Vite 5, TypeScript 5; vitest (new devDependency, tests only); Rust/Tauri 2.11.

**Spec:** `docs/superpowers/specs/2026-11-13-ui-redesign-design.md`

## Global Constraints

- One stylesheet: `src/styles.css` rewritten from scratch; `src/styles-mobile.css` deleted; no class from the old CSS survives unless re-declared in the new file.
- No new runtime dependencies. Dev-only: `vitest`.
- Theme tokens on `:root` (light) and `:root[data-theme='dark']`; dark palette reference: bg `#0d0e11`, surface `#15171b`, raised `#17191d`, hairline `#1f2227`, text `#e9ecef`, secondary `#8b929b`, tertiary `#6f7680`, accent `#35d0a5`.
- Font stack `-apple-system, "Segoe UI", Inter, sans-serif`; screen title 15–17px bold; body 13–14px; secondary 11–12px; no display type, no gradients/glow for decoration; motion only for state; honour `prefers-reduced-motion`.
- Copy: Russian primary, English via `settings.language`; segmented labels one line at 380px width (Исключения: «Выкл / Кроме списка / Только список»; Режим: «Система / TUN / Прокси»).
- Tabs exactly: Главная, Серверы, Настройки. Журнал and О программе are sub-screens of Настройки.
- Главная has no management controls (no delete/edit/refresh/add-subscription actions).
- Window stays 420×860, min 380×640.

## Review Focus

- A subscription with 30+ profiles and long names (60+ chars) at 380px width: rows truncate with ellipsis, no horizontal scroll, ping and «⋯» stay visible → Task 5/6 manual checklist line + `groupProfiles` test with long names.
- No profiles at all (fresh install): Главная shows one line and «Добавить сервер» opening the add sheet; Серверы shows the same; nothing crashes on `selectedProfileId = null` → Task 5 test `pickerGroups([])` returns `[]`, Task 5/6 checklist.
- AmneziaWG connected but `awg` unavailable / status command fails / handshake never happened: Главная shows «Нет рукопожатия» (after 8 s grace) instead of «Подключено», no error toast loop → Task 2 parser tests for empty/garbage dump, Task 5 `handshakeHealth` tests.
- Text pasted into Добавить that is not a supported link/config: inline error under the input, nothing imported → Task 1 `detectImportKind('hello')` returns `'unknown'`, Task 6 checklist.
- Light theme: every screen readable (no dark-only colours hard-coded in components) → Task 3 rule: components use tokens only; Task 9 checklist covers both themes.

---

### Task 1: Test runner and import detection

**Files:**
- Modify: `package.json` (devDependency `vitest`, script `"test:ui": "vitest run"`)
- Create: `src/lib/importDetect.ts`, `src/lib/importDetect.test.ts`
- Modify: `src/App.tsx` (paste handler uses `detectImportKind`)

**Interfaces:**
- Produces: `type ImportKind = 'subscription' | 'proxyUri' | 'amneziaUri' | 'amneziaConfig' | 'json' | 'unknown'`; `detectImportKind(text: string): ImportKind`; `importByKind(kind, text, store)` is NOT added — callers switch on the kind and call existing store actions: subscription→`importSubscription`, proxyUri→`importProfile`, amneziaUri→`importAmneziaUri`, amneziaConfig→`importAmneziaConfig`, json→`importProfilesJson`.

- [ ] **Step 1: Write the failing tests** (`importDetect.test.ts`): `https://x/sub`→subscription; `vless://…`, `ss://…`, `hy2://…`, `hysteria2://…`→proxyUri (case-insensitive, leading spaces trimmed); `vpn://…`→amneziaUri; text containing `[Interface]` and `[Peer]`→amneziaConfig; text starting with `{` or `[` that parses as JSON→json; `[Interface]` alone (no Peer) →unknown; `hello`→unknown; `''`→unknown.
- [ ] **Step 2:** `npm run test:ui` → FAIL (module missing).
- [ ] **Step 3:** Implement `detectImportKind` in `src/lib/importDetect.ts`; replace the regex chain in `App.tsx` paste handler with it (same behaviour, plus amneziaConfig/json via the same function).
- [ ] **Step 4:** `npm run test:ui` → PASS; `npm run build` → success.
- [ ] **Step 5:** Commit `feat(ui): vitest and import kind detection`.

### Task 2: AmneziaWG live status (Rust + IPC)

**Files:**
- Create: `src-tauri/src/awg_status.rs` (parser + `fn read_status(state) -> AppResult<Option<AwgStatus>>`)
- Modify: `src-tauri/src/amnezia_manager_macos.rs` (root script loop writes `awg show "$IF" dump > "$STATUS"` every 2 s, `chmod 644`; add `status: dir.join("awg.status")` to `Files`, removed in `down()`)
- Modify: `src-tauri/src/commands.rs`, `src-tauri/src/lib.rs` (command `amnezia_status`), `src-tauri/src/models.rs` (`AwgStatus`)
- Modify: `src/lib/tauri.ts` (`amneziaStatus: () => tauriInvoke<AwgStatus | null>('amnezia_status')`), `src/types/index.ts`

**Interfaces:**
- Produces (Rust, serde camelCase): `pub struct AwgStatus { pub latest_handshake_at: Option<i64> /* unix seconds, None when 0 */, pub rx_bytes: u64, pub tx_bytes: u64, pub endpoint: Option<String> }`; `pub fn parse_dump(dump: &str) -> Option<AwgStatus>` (first peer line of `awg show <if> dump`: tab-separated `public-key preshared-key endpoint allowed-ips latest-handshake transfer-rx transfer-tx persistent-keepalive`; the first line is the interface line and is skipped; `endpoint == "(none)"` → None; `latest-handshake == 0` → None).
- Produces (TS): `interface AwgStatus { latestHandshakeAt: number | null; rxBytes: number; txBytes: number; endpoint: string | null }`.
- Source per platform: Windows runs `<amnezia_sidecar dir>/awg.exe show vailbox-awg dump` via `platform::command`; macOS reads the status file. Returns `Ok(None)` when no AWG session is active (`connection_status().state != Connected` or active profile engine ≠ Amneziawg) or the source is missing.

- [ ] **Step 1: Write failing Rust tests** in `awg_status.rs`: a two-line dump (interface + peer with `1.2.3.4:51820`, handshake `1794500000`, rx `1048576`, tx `2048`) → those values; peer with handshake `0` and endpoint `(none)` → `latest_handshake_at None`, `endpoint None`; empty string → `None`; garbage `"oops"` → `None`.
- [ ] **Step 2:** `npm run test` → FAIL.
- [ ] **Step 3:** Implement `parse_dump`, `read_status`, the command, macOS script change.
- [ ] **Step 4:** `npm run test` → PASS (all Rust lib tests).
- [ ] **Step 5:** Commit `feat(awg): live tunnel status command`.

### Task 3: Design system (stylesheet + primitives)

**Files:**
- Rewrite: `src/styles.css` (tokens, reset, base typography, and the classes for the primitives below — nothing else)
- Delete: `src/styles-mobile.css`; remove its import from `src/main.tsx`
- Create: `src/ui/Screen.tsx` (`<Screen title back? actions?>` — title row + scroll body), `src/ui/ListGroup.tsx` (`<ListGroup label?>` + `<Row title subtitle? value? chevron? onClick? trailing?>`), `src/ui/Switch.tsx` (`<Switch checked onChange label?>`), `src/ui/Segmented.tsx` (`<Segmented<T> value options={{value,label}[]} onChange>`), `src/ui/Sheet.tsx` (`<Sheet open onClose title? subtitle?>` bottom sheet, Esc and backdrop close, focus trap), `src/ui/Chip.tsx`, `src/ui/TabBar.tsx`, `src/ui/Button.tsx` (`variant: 'primary' | 'secondary' | 'ghost' | 'danger'`), `src/ui/index.ts`

**Interfaces:**
- Produces: the components above with exactly those props; class names prefixed `ui-` (e.g. `ui-row`, `ui-sheet`); components reference tokens only (`var(--…)`), never literal colours.

- [ ] **Step 1:** Write `src/styles.css` from scratch (tokens for light + dark from Global Constraints; light mirrors with bg `#f6f7f9`, surface `#ffffff`, text `#0d1117`, accent `#0c9f82`).
- [ ] **Step 2:** Implement the primitives.
- [ ] **Step 3:** `npm run build` → success (old screens may look broken at this point; that is expected until Task 9).
- [ ] **Step 4:** Commit `feat(ui): design system from scratch`.

### Task 4: Shell, routing, update banner

**Files:**
- Rewrite: `src/components/AppShell.tsx` → `src/ui/AppShell.tsx` (TabBar with 3 tabs; update banner on Главная only)
- Modify: `src/App.tsx` routes: `/` Home, `/servers` Servers, `/servers/profile/:id` ProfileEdit, `/settings` Settings, `/settings/exclusions`, `/settings/tun`, `/settings/journal`, `/settings/about`, `/settings/about/:doc` (`privacy|terms|third-party`)
- Create: `src/screens/*.tsx` placeholders exporting the screen components used by the routes (filled in Tasks 5–8)

**Interfaces:**
- Produces: route paths above; screens `HomeScreen`, `ServersScreen`, `ProfileEditScreen`, `SettingsScreen`, `ExclusionsScreen`, `TunScreen`, `JournalScreen`, `AboutScreen`, `LegalScreen`.

- [ ] **Step 1:** Implement shell + routes; tab active state uses `NavLink` (`end` for `/`); sub-routes keep their parent tab active.
- [ ] **Step 2:** `npm run build` → success; `npm run app` → three tabs switch, back arrows return.
- [ ] **Step 3:** Commit `feat(ui): three-tab shell and routes`.

### Task 5: Главная

**Files:**
- Create: `src/screens/HomeScreen.tsx`, `src/screens/home/PowerButton.tsx`, `src/screens/home/TunnelStatus.tsx`, `src/screens/home/ServerPicker.tsx`
- Create: `src/lib/handshake.ts` + `src/lib/handshake.test.ts`; `src/lib/profileGroups.ts` + `src/lib/profileGroups.test.ts`
- Modify: `src/store/useAppStore.ts` (`awgStatus: AwgStatus | null`, polled every 2 s while connected via an AWG profile, cleared on disconnect)

**Interfaces:**
- Consumes: `backend.amneziaStatus` (Task 2), `splitFlagFromName`, `CountryFlag`, ui primitives (Task 3).
- Produces: `handshakeHealth(latestHandshakeAt: number | null, connectedAt: number, now: number): 'pending' | 'healthy' | 'stale' | 'none'` — `pending` when null and `now - connectedAt < 8000`, `none` when null after that, `healthy` when `now - at*1000 <= 180000`, else `stale`; `formatAgo(seconds, lang)` → «12 с назад» / «3 мин назад»; `pickerGroups(profiles, subscriptions, sortMode, latencies): {key, label | null, profiles}[]` — subscription groups in subscription order then «Свои» (manual), `label` null when only one group, sorting by `sortMode` (`none|ping|name`) without moving the selected profile.

- [ ] **Step 1: Write failing tests:** `handshakeHealth(null, now-3000, now)`→pending; `(null, now-9000, now)`→none; `(now/1000-60, …)`→healthy; `(now/1000-400, …)`→stale; `pickerGroups([])`→`[]`; two subscriptions + one manual → three groups with labels in order; one subscription only → one group with `label: null`; ping sort puts lower `latencyMs` first and unknown last; long names are kept intact (no truncation in data).
- [ ] **Step 2:** `npm run test:ui` → FAIL.
- [ ] **Step 3:** Implement helpers, store polling, and the screen per spec «Главная» + «live tunnel status»: power button states, state text, timer, chips (server + ping; proxy-only Xray: HTTP/SOCKS addresses, tap copies), AWG block (handshake line coloured by health, ↓/↑ totals and rate computed from successive samples, endpoint), picker list, empty state.
- [ ] **Step 4:** `npm run test:ui` → PASS; `npm run app`: connect Xray and AWG profiles, check states and the 380px/long-name/empty checklist from Review Focus.
- [ ] **Step 5:** Commit `feat(ui): home screen with live tunnel status`.

### Task 6: Серверы, Добавить, profile actions

**Files:**
- Create: `src/screens/ServersScreen.tsx`, `src/screens/servers/SubscriptionCard.tsx` (replaces `src/features/profiles/SubscriptionStats.tsx`), `src/screens/servers/ProfileRow.tsx`, `src/screens/servers/ProfileSheet.tsx`, `src/screens/servers/AddSheet.tsx`, `src/screens/ProfileEditScreen.tsx` (hosts the existing `ProfileForm` / `AmneziaProfileForm`, restyled with ui primitives)

**Interfaces:**
- Consumes: `detectImportKind` (Task 1), `pickerGroups` (Task 5), store actions `refreshLatencies`, `refreshSubscription`, `deleteSubscription`, `deleteProfile`, `duplicateProfile`, `saveProfile`, `testProfileConnection`, `selectProfile`, `connect`, import actions.
- Produces: none for later tasks.

- [ ] **Step 1:** Implement per spec «Серверы» and «Добавить»: tool row (Пинг, Сортировка cycling none→ping→name persisted in `localStorage['veilbox.profileSort']`, Поиск), subscription cards (refresh icon, «⋯»: Обновить / Скопировать ссылку (subscription URL) / Удалить with confirm), profile rows with «⋯» sheet: Подключиться, Проверить, Подробнее и изменить (→ `/servers/profile/:id`), Дублировать, Удалить (confirm). No per-profile «Скопировать ссылку» (the app has no profile→URI export). AWG rows show tag «туннель» when `settings.connectionMode === 'proxyOnly'`.
- [ ] **Step 2:** AddSheet: one textarea; «Добавить» routes by `detectImportKind`; `unknown` shows inline «Не похоже на ссылку или конфиг» and imports nothing; buttons Из буфера (reads clipboard into the field), Файл .conf (file input → text → amneziaConfig), Вручную (→ `/servers/profile/new`).
- [ ] **Step 3:** `npm run build` → success; `npm run app`: add a subscription URL, a `vless://`, an AWG `.conf`, garbage text; edit, duplicate, delete a profile; refresh/delete a subscription.
- [ ] **Step 4:** Commit `feat(ui): servers screen, add sheet, profile actions`.

### Task 7: Настройки, Исключения, TUN

**Files:**
- Create: `src/screens/SettingsScreen.tsx`, `src/screens/ExclusionsScreen.tsx`, `src/screens/TunScreen.tsx`, `src/lib/splitPresets.ts` (presets moved verbatim out of `src/pages/SettingsPage.tsx`: LOCAL_NETWORK_*, STREAMING_DOMAINS, AI_DOMAINS, CODEX_DOMAINS, GEO_TUN_PRESETS + `applyPreset` merge logic)

**Interfaces:**
- Consumes: `saveSettings(patch: Partial<Settings>)`, `checkForUpdate`, `update`.

- [ ] **Step 1:** Implement per spec «Настройки», «Исключения» (segmented ↔ `splitTunnelMode` disabled/bypassListed/proxyListed; all current presets as one-shot add chips with today's per-mode visibility (incl. Codex, TUN geo presets, «Очистить»); tag lists with add/remove keeping today's validation messages; Программы only in TUN; proxy-only note), «TUN» (interface name, outbound adapter from `listNetworkInterfaces`, disable IPv6). Theme and Язык rows open a Sheet with the choices.
- [ ] **Step 2:** `npm run build`; `npm run app`: every field round-trips (change → restart app → value kept).
- [ ] **Step 3:** Commit `feat(ui): settings, exclusions, tun screens`.

### Task 8: Журнал, О программе, AWG proxy-only notice

**Files:**
- Create: `src/lib/logText.ts` + `src/lib/logText.test.ts`: `toRussianLog(message: string): string`, an ordered regex table for the backend messages found in `src-tauri/src/{xray_manager,amnezia_manager_windows,amnezia_manager_macos,lib}.rs` (e.g. `Connected via {name}` → «Подключено: {name}», `Disconnected and cleared system proxy.` → «Отключено», `Xray exited unexpectedly. Reconnecting in {n}s...` → «Соединение оборвалось, переподключение через {n} с»); unknown → unchanged. Tests: those three translated, an unknown line returned as is.
- Create: `src/screens/JournalScreen.tsx` (from the current `src/pages/LogsPage.tsx`: status pill, copy for support, filter, clear, debug-logging switch; hides `xray-stdout`/`xray-stderr` entries from the list), `src/screens/AboutScreen.tsx`, `src/screens/LegalScreen.tsx` (privacy / terms / third-party texts moved from `AboutPage.tsx`)
- Modify: `src/store/useAppStore.ts` `connect`: when `settings.connectionMode === 'proxyOnly'` and the profile engine is `amneziawg`, push toast «AmneziaWG работает только туннелем — подключено как туннель».

- [ ] **Step 1:** Implement the screens; О программе shows app/Xray versions, support link from `SUPPORT.md`, update button states (no geo date row). Журнал shows `toRussianLog(entry.message)` when the language is ru.
- [ ] **Step 2:** `npm run build`; `npm run app`: copy for support puts the header + lines in the clipboard; AWG in proxy-only shows the toast.
- [ ] **Step 3:** Commit `feat(ui): journal, about, legal; awg proxy-only notice`.

### Task 9: Remove the old UI

**Files:**
- Delete: `src/pages/*`, `src/components/{AppShell,Sidebar,Panel,StatusBadge,EmptyState,Field,Toggle,Button}.tsx` (if no longer imported), `src/components/ui/hero-shutter-text*`, `src/features/connection/*`, `src/features/logs/*`, `src/features/profiles/{Import*Dialog,ProfileListItem,SubscriptionStats}.tsx`; keep `CountryFlag`, `Modal` only if still used (else delete), `ToastViewport` restyled with tokens.
- Modify: `src/lib/i18n.ts` — drop keys no longer referenced.

- [ ] **Step 1:** Delete; fix imports.
- [ ] **Step 2:** `npm run build` (tsc with no unused-file references) → success; `npm run test:ui` and `npm run test` → PASS; `grep -r "dashboard-\|sidebar\|hero-" src` → no matches.
- [ ] **Step 3:** `npm run app` in dark and light theme: walk every screen at 380px and 420px width; check Review Focus list.
- [ ] **Step 4:** Commit `refactor(ui): remove old UI and stylesheet`; push; CI green.
