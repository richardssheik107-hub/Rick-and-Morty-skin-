# QA inventory

## User-visible claims

1. The home screen visibly matches the reference mood: one cropped pink-purple starry hero, Fiona portrait crop, signature/brand treatment, native Codex suggestion cards, polaroid, and skinned native composer.
2. The sidebar is blush glass rather than merely changing the accent color.
3. All real Codex controls remain interactive; the skin is not a screenshot overlay.
4. The skin survives route changes and renderer reloads while the injector daemon runs.
5. The official Store package and `app.asar` remain unchanged.
6. Restore removes the injected DOM/CSS and install/restore can be repeated.

## Functional checks

- Home feature card: click one card and confirm the real composer is populated or the normal action occurs.
- Project selector: click the real project chip under the "选择项目" label and confirm the native project menu opens.
- Sidebar: open a real task, then return to New Task.
- Composer: type text, verify caret/readability, then clear it without sending.
- Reload: use CDP `Page.reload`, wait, and confirm the injection marker returns.
- Restore/reapply cycle: remove live skin, verify marker absent, apply again, verify marker present.
- Update resilience: resolve the current `OpenAI.Codex` Appx location dynamically; never store a versioned WindowsApps path.

## Visual checks

- 1280x820 initial home: hero, four native cards, real project selector, and composer are all visible without horizontal scrolling.
- Narrower window: accept Codex's native responsive reduction to two or three suggestion cards; no essential control is covered and the polaroid may intentionally hide.
- Normal task: messages remain readable and composer does not overlap content.
- Inspect the sidebar, header, hero edges, card labels, composer controls, scrollbar, ribbon, and bottom-right decoration.
- Reject black/transparent sidebar artifacts, clipped cards, duplicated/disconnected project labels, rasterized native controls, weak contrast, or decorations intercepting clicks.

## Rick Portal theme

- Home, new chat, and new project: the character-free green portal hero is visible on the right over the full-screen cloud scene; native title/project controls remain readable on the left.
- Normal task: the cosmic portal work background replaces the home hero and remains behind readable messages, code, diffs, tool output, and the native composer.
- State transition: moving between home and a task updates `data-portal-mode` without a reload and never shows both images in one state.
- Shell: sidebar, header, suggestion cards, project selector, menus, dialogs, scrollbars, and composer use the dark teal/portal-green palette.
- Motion: status and star animation is subtle and is disabled by `prefers-reduced-motion`; suggestion cards render without transform or shadow animation.

## Exploratory checks

- Start when the debug port is occupied: fail with a clear message or use a caller-selected port.
- Start after Codex updates: package discovery and injection still work without patching installed files.
