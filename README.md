# BaseBallatro

A browser-based MVP vertical slice for **BaseBallatro**, a baseball pinball score-combo roguelike inspired by Balatro.

## Play

Open `index.html` in a browser, choose power and direction, and press **Hit Ball**. The ball travels through the field, lands in a result hole, advances runners, scores points, and tries to reach the target before three outs or before balls run out.

## MVP Features

- Physical ball movement through a baseball pinball field.
- Five result holes: OUT, SINGLE, DOUBLE, TRIPLE, HR.
- Simplified runner advancement and run scoring.
- Target-score win condition.
- Passive card system with one card: **Slugger** (`HR x3`).
- Safe image loading with fallback card rendering for `/assets/cards` assets.
