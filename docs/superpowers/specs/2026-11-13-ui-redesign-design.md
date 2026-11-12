# VeilBox UI redesign

Date: 2026-11-13. Status: agreed in conversation (mockups in
`.superpowers/brainstorm/…/content/structure.html`, `settings-v2.html`,
`details.html`).

## Intent

The current UI reads as generic "AI slop": giant display headings, everything
the same grey, explanatory text everywhere, technical logs in English, two
stacked style systems (`src/styles.css`, ~3000 lines, plus
`src/styles-mobile.css` overriding it). VeilBox is a VPN for the owner's
friends (Russian-speaking, not technical). The app should feel like the
current mobile VPN clients the owner likes — **Incy and Happ**: restrained,
dark-first, quiet, no decoration that does not carry meaning.

## Goals

- One clean design system written from scratch: a single stylesheet with theme
  tokens. The old `styles.css` and `styles-mobile.css` are deleted, together
  with every class only they used.
- Three tabs (bottom bar): **Главная**, **Серверы**, **Настройки**.
- Главная is for connecting only: power button, state, timer, current server,
  and a list to pick a server. No management controls on it.
- Серверы holds all management: add, subscriptions, ping, sort, search, per
  profile actions.
- Настройки is grouped and short; rare options sit behind "›" sub-screens.
  Журнал and О программе live inside Настройки.
- Russian copy is short, plain, and fits on one line where a control is
  narrow (segmented controls especially).

## Non-goals

- No change to the Rust side, IPC commands, the store's behaviour, or
  connection logic, except: the AmneziaWG / proxy-only notice and the
  AmneziaWG live status command (both described below).
- No new runtime dependencies (no Tailwind, Radix, shadcn, icon packs beyond
  the existing `lucide-react`).
- No phone build; the window stays a portrait desktop window (420×860, min
  380×640, see `src-tauri/tauri.conf.json` and `src-tauri/src/lib.rs`).

## Anti-goals (fail even if it works)

- A second style layer, utility-class soup, or leftover classes from the old
  CSS.
- Huge headings, gradients/glow for decoration, "eyebrow" labels, marketing
  copy, explanatory paragraphs under every block.
- English technical text shown to users (raw Xray lines, `HTTP proxy`,
  `Runtime log stream`).
- Losing an existing capability (see the inventory below).

## Constraints

- React 18 + react-router (HashRouter) + zustand store (`src/store/useAppStore.ts`)
  stay; Tauri 2.11 pinned. `lucide-react` for icons.
- Light and dark themes both supported (`settings.theme`: light / dark /
  system, applied via `data-theme` on `<html>` by `src/lib/theme.ts`). Dark is
  the reference look; light must be equally finished.
- Russian and English (`settings.language`, `src/lib/i18n.ts` + local `tx()`
  helpers); Russian is primary.
- Windows does not render flag emoji: flags come from `public/flags/*.svg`
  (`CountryFlag`), the emoji is stripped from labels (`splitFlagFromName`).

## Approaches

1. **Rewrite the UI layer with our own CSS (chosen).** New screen components
   and one small stylesheet with tokens; delete the old CSS. Full control, no
   new dependencies; a handful of primitives (sheet, switch, segmented control,
   list group) written by hand.
2. Component library (Radix/shadcn + Tailwind): ready sheets and switches, but
   adds a build-time style system and its recognisable default look — the
   thing the owner wants to get away from.
3. Restyle on top of the current CSS: how the current result happened
   (layers fighting each other). Rejected.

The owner picked 1 and asked explicitly: no double design system, CSS
rewritten from scratch.

## Visual language

- Dark reference palette (exact values are the builder's call, keep the
  feel of the mockups): background `#0d0e11`, surface `#15171b`, raised
  surface `#17191d`, hairline `#1f2227`/`#23262c`, text `#e9ecef`, secondary
  `#8b929b`, tertiary `#6f7680`, accent teal `#35d0a5`, warning amber,
  danger soft red. Light theme mirrors it.
- System font stack (`-apple-system, "Segoe UI", Inter, sans-serif`). Sizes:
  screen title 15–17px bold, body 13–14px, secondary 11–12px. No display
  type.
- Radius 12–14px on rows/cards, 18px on sheet tops. Grouped lists
  (iOS-style): rows inside one rounded group separated by hairlines.
- Section labels: small uppercase 11px tertiary text above a group.
- Motion only where it carries state: power button press/scale, connecting
  spinner ring, sheet slide-up. Respect `prefers-reduced-motion`.

## Structure and screens

Bottom tab bar (3 items, icon + label), active tab in accent. Top of each
screen: a compact title row (no big page header). Sub-screens (Исключения,
Дополнительно TUN, Журнал, О программе, profile details/edit) have a back
"‹" and no tab change.

### Главная

- Top row: "VeilBox" + current subscription name (secondary).
- Power button (~132–168px circle), accent ring when connected, amber
  spinner ring while connecting, danger tint on failure.
- State text (Отключено / Подключение… / Подключено / Ошибка) and timer.
- One line of chips under it: current server short name and protocol, ping;
  in **proxy-only** mode with an Xray profile: `HTTP 127.0.0.1:port` and
  `SOCKS 127.0.0.1:port`, each tappable to copy.
- "Сервер" list: all profiles for picking (grouped by subscription with a
  small label when there is more than one source; own profiles under "Свои").
  Row: flag, name (flag emoji stripped), protocol line, ping. The selected
  row is clearly marked (accent outline + tint + accent name). Tap selects;
  if connected, switching reconnects (current behaviour of `selectProfile`
  + connect). No delete/edit/refresh controls here.
- The list follows the sort mode chosen on Серверы; it never moves the
  selected profile to the top.
- Update available: a slim banner at the top of Главная ("Доступна версия X
  · Обновить").

### Серверы

- Title row with "＋ Добавить".
- Tool row: Пинг (all), Сортировка (cycles none → ping → name, remembered —
  existing `veilbox.profileSort` localStorage key), Поиск (expands an input).
- Per subscription: a card with name, refresh icon, "⋯" menu (Обновить,
  Скопировать ссылку, Удалить); traffic as "5.7 из 1000 GB" with a thin usage
  bar when `total` is known; expiry "до 02.09.2036" / "истекла"; last refresh
  time. Collapsible. Then its profiles.
- Own (manual) profiles under "Свои профили".
- Profile row: flag, name, protocol line, ping, "⋯". "⋯" opens a bottom sheet:
  Подключиться, Проверить (Xray only; AWG shows the structural check it has
  today), Подробнее и изменить, Дублировать, Удалить. No per-profile
  «Скопировать ссылку»: the app cannot turn a profile back into a link.
  *(builder-check call)*
- Balancing toggle moves to Настройки (it is a setting, not a list action).

### Добавить (bottom sheet)

One input that accepts anything: subscription URL, `vless://`, `ss://`,
`hy2://`, `vpn://` (Amnezia), raw AmneziaWG `.conf`, Xray/Clash JSON. Type is
detected and routed to the existing store actions (`importSubscription`,
`importProfile`, `importAmneziaUri`, `importAmneziaConfig`,
`importProfilesJson`). Secondary buttons: Из буфера, Файл .conf, JSON (paste
area), Вручную (opens the existing full profile form, restyled). Replaces the
four separate import dialogs and the create menu.

### Настройки

Groups (mockup `settings-v2.html`):

- **Режим**: segmented control Система / TUN / Прокси, one hint line under
  it describing the selected mode. TUN shows a "Дополнительно ›" row
  (interface name, outbound adapter, disable IPv6).
- **Подключение**: Исключения › (value shows the current mode, e.g. "Кроме
  списка"), Балансировка (switch, one-line hint), Переподключаться (switch).
- **Приложение**: Тема › (Системная/Тёмная/Светлая), Язык ›, Запускать с
  системой, Сворачивать в трей.
- **Помощь**: Журнал › ("для поддержки"), О программе › (version, "есть
  обновление" when available).
- Debug logging: a switch inside Журнал (it only matters for support).

### Исключения (sub-screen)

- Segmented: **Выкл / Кроме списка / Только список** (maps to
  `splitTunnelMode` disabled / bypassListed / proxyListed), hint line.
- Quick presets stay one-shot "add" chips as today (not switches), all of
  them: Локальные сети, Стриминг, AI-сервисы, Codex (Только список), the TUN
  geo presets (incl. `geoip:ru` only for Кроме списка), plus «Очистить»; same
  per-mode visibility as today. *(builder-check call)*
- Lists as tags with "＋": Сайты (domains), IP, Программы (TUN only, says
  so). Same validation as today.
- In proxy-only mode the screen states that exclusions do not apply.

### Журнал (sub-screen)

- Status pill: "Ошибок нет" / "Ошибок: N".
- Primary button "Скопировать для поддержки" (header with app/Xray version,
  platform, mode, status + all log lines; already implemented in the new
  `LogsPage.tsx`).
- Events newest first with time, Russian text (known backend messages are
  translated by a frontend rule table; unknown lines are shown as they are,
  the journal is for support) *(builder-check call)*, warnings amber, errors red;
  "Только проблемы" filter; clear (icon). Raw Xray stdout/stderr lines are
  not listed (they still go into the copy).
- Debug logging switch.

### О программе (sub-screen)

App icon, "VeilBox X.Y.Z", update state and button (check / update /
installing), then a group: Xray version, Поддержка (link from `SUPPORT.md`;
no geo date row — the backend does not expose it) *(builder-check call)*,
Конфиденциальность ›, Условия ›, Сторонние компоненты › (existing texts from
`AboutPage.tsx`, each on its own sub-screen instead of one long page).

### Главная: live tunnel status for AmneziaWG

When connected through an AmneziaWG profile, Главная shows that the tunnel
actually works, not just "Подключено":

- "Рукопожатие: 12 с назад" — accent when the last handshake is recent
  (WireGuard re-handshakes every ~2 min, so ≤ 3 min = healthy), amber when
  older, red "Нет рукопожатия" when none happened yet (after a grace period
  of a few seconds the hero shows "Нет связи с сервером" instead of a green
  "Подключено").
- Traffic since connect: "↓ 120 MB  ↑ 8 MB" and current rate.
- Endpoint (server IP:port) in the details.

Source: `awg show <iface> dump` (latest-handshake, rx, tx, endpoint),
polled every ~2 s while connected. This needs backend support:

- Windows: the app already runs elevated for AWG; call the bundled
  `awg.exe show <tunnel> dump` (tunnel = service name `VeilBoxAwg`).
- macOS: `awg` needs root; the existing root script
  (`amnezia_manager_macos.rs`) writes `awg show "$IF" dump` into a
  user-readable status file every ~2 s while it runs; the app reads the file.
- New IPC command (e.g. `amnezia_status`) returning
  `{ latestHandshakeAt, rxBytes, txBytes, endpoint }` or null when not an AWG
  session. Xray sessions keep the simple state (no stats in this iteration).

### AmneziaWG in proxy-only mode

AmneziaWG is always a system tunnel; it cannot be a local proxy. In
proxy-only mode AWG rows show a small "туннель" tag; connecting an AWG
profile in this mode shows a frontend-only toast, no Rust change ("AmneziaWG работает только туннелем —
подключено как туннель") and the hero shows the tunnel state, not proxy
addresses.

## Capability inventory (must survive)

Connect/disconnect, auto reconnect, profile select, ping all, sort, search,
balancing, subscriptions (import, refresh, delete, auto-refresh, traffic /
expiry / title from headers), own profiles (create, edit, duplicate, delete),
imports (URI, JSON, AmneziaWG config and `vpn://`), test connection, all
settings fields in `Settings` (`src/types/index.ts`), presets, theme,
language, autostart, tray, debug logging, logs copy/clear, updates (check,
install, banner), toasts, profile details modal content, legal/privacy/terms/
third-party texts, Ctrl+V paste-to-import on the window (`App.tsx`).

## Left to the builder

- Exact component split and file layout under `src/` (suggested:
  `src/ui/` primitives — Sheet, Switch, Segmented, ListGroup, Row, Chip —
  and `src/screens/`), naming, tokens' exact values.
- Whether the profile form keeps its fields as-is (restyled) or is split into
  basic/advanced; behaviour must not change.
- Removing dead components (`Sidebar`, `Panel`, `HeroShutterText`, old
  dialogs, `ProfilesPage` if unused) and old CSS classes.
- Empty states (no profiles: Главная shows one line + "Добавить сервер"
  button leading to the add sheet).
