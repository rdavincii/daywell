# Motion notes (added in the animation pass)

Tokens live at the top of `src/styles.css`: `--ease-out`, `--ease-in-out`, `--ease-drawer`, `--dur-press` (140ms), `--dur-fast` (160ms), `--dur-base` (240ms). Reuse them; do not add new curves.

Helpers in `src/motion.ts`:
- `usePresence(value, ms)` keeps a sheet/toast mounted for its exit after the parent sets state to null.
- `useSettledValue(key, target)` makes bars and the ring animate from the last value you saw when a screen remounts.
- `FreshIds` marks just-added records so their rows open up and fade in.

Rules followed: transform/opacity first; no `transition: all`; no `ease-in`; no `scale(0)`; transitions (not keyframes) for anything that can fire twice quickly; reduced motion keeps fades and drops movement.

Deliberately NOT animated: tab switching (used tens of times a day), the keyboard, charts and weight data (data you read should not move for style).

`tests/motion-css.test.ts` lints the stylesheet for these rules. `src/motion.test.tsx` covers the behaviour.
