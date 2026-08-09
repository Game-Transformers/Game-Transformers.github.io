# Game Transformers — landing page redesign

This pass intentionally changes the product hierarchy rather than only restyling the original export.

## Positioning now used

1. Human game direction establishes mode, lure, goals, constraints, and principal characters.
2. A stateful LLM orchestration layer expands the world and maintains the run.
3. Players change the state through decisions and interaction.
4. MAD / DSM decision and interaction support methods structure the decision space and consequences.
5. Media is generated from the current game state.
6. BCI is an optional provider behind an input-adapter boundary, not a product dependency.

## CTA labels

- `Run a Game With Us`
- `Join the Early-Bird Waitlist`

## Integration TODOs

- Replace `hello@example.com` with the actual partner contact or form endpoint.
- Connect the waitlist form to the real signup endpoint.
- If desired, replace the CSS-only orchestration visual with live telemetry later; the layout does not depend on it.

The page is standalone: `index.html`, `styles.css`, and `app.js`; no external framework or font dependency is required.
