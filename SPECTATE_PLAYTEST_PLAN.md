# Spectate Playtest — Implementation Plan

**Date:** May 26, 2026  
**Source:** Vargas playtest feedback on `6q3g3y`  

---

## Root Causes (Diagnosed)

| Feedback | Root Cause |
|----------|-----------|
| 3 active instead of 4 | `auto-match.ts` script used `slice(0, 3)` and hardcoded spawn positions `y: i+1` instead of importing `getDefaultSpawnPositions` from the engine. The CLI's `buildTeamSetup` was already correct. |
| Only 2 of 3 on spawn spaces | My script placed cinderlings at y=1,2,3 but actual board spawn spaces (with 4 spawns over height=5) are at y=0,1,3,4. Two overlapped (y=1 and y=3), one missed. |
| 20 energy instead of 120 | `GAME_CONFIG.energy.starting = 20` in `server/config.ts`. Should be 120. |
| Jolting turn transitions | SpectateClient replaces full game state on index change — no animation layer. BattleCanvas is PixiJS and fully capable of tweening. |
| No per-turn action log | `turnLogs` (command results, damage, KOs) are captured by CLI but never uploaded or surfaced in spectate. |

---

## PR 1 — Fix: Game Balance + Auto-Match Script

**Branch:** `fix/spectate-game-balance`  
**Scope:** 2 files, ~20 lines  
**Goal:** Make simulated matches reflect real game rules.

### Changes

**`cinderling-check/server/config.ts`**
- `energy.starting: 20 → 120`

**`cinderling-check/scripts/auto-match.ts`**
- Delete custom `buildTeamSetup` implementation
- Import `getDefaultSpawnPositions` from `../server/board` and `GAME_CONFIG` from `../server/config`  
- Rewrite `buildTeamSetup` to mirror the CLI exactly: use `getDefaultSpawnPositions` for spawn positions, `slice(0, GAME_CONFIG.teams.activeSlots)` for active (= 4), rest to bench
- Import `calculateDamage` from `../server/archetypes` for correct attack damage values

### Acceptance
- `cinderling match create` → board shows 4 active cinderlings per side on the correct spawn spaces (y=0,1,3,4)
- Both teams start with 120⚡
- Re-run `bun scripts/auto-match.ts` and verify turn output shows 4 alive per team + energy ~120

---

## PR 2 — Feat: Per-Turn Action Log in Spectate

**Branch:** `feat/spectate-turn-log`  
**Scope:** 5 files  
**Goal:** Player clicks the turn counter → sees exactly what happened that turn (who moved where, attacks, damage, KOs).

### Data Flow

```
CLI match.turnLogs (already captured in auto-match.ts)
  → upload API (new: accept turnLogs field)
    → matchSnapshot.turnLogs column in DB
      → spectate API (return turnLogs with each snapshot)
        → SpectateClient (show log panel for current turn)
```

### Schema: `data/schema.ts`
Add nullable column:
```ts
turnLogs: json("turnLogs"),  // TurnLogEntry[], parallel to turnSnapshots
```

`TurnLogEntry` (stored per turn, parallel to turnSnapshots):
```ts
type TurnLogEntry = {
  turn: number;
  commandResults: Array<{
    cinderlingUuid: string;
    cinderlingName: string;
    teamId: 1 | 2;
    command: { type: string; direction?: string; attackIndex?: number };
    success: boolean;
    reason?: string;
    damageDealt?: number;
    targetKO?: boolean;
    energyGained?: number;
  }>;
  benchEntries: { team1: string[]; team2: string[] };  // names of cinderlings entering
  winResult: { winner: 1 | 2; condition: string } | null;
};
```

### Upload API: `src/app/api/matches/upload/route.ts`
- Accept `turnLogs?: TurnLogEntry[]` in POST body
- Store alongside `turnSnapshots`

### `cinderling-check/scripts/auto-match.ts`
- Include `match.turnLogs` in the upload body (already captured, just not sent)

### Spectate API: `src/app/api/spectate/[id]/route.ts`
- Return `turnLogs` from DB row in response

### `SpectateClient.tsx`
- Add state: `logOpen: boolean`
- The turn counter button (already clickable) → toggles `logOpen`
- When `logOpen`: render a bottom sheet/drawer showing `turnLogs[replayIndex - 1]` (the log for the turn that just resolved to reach this snapshot):
  - Each command result as a row: `[cinderling name] [team color] → [action] [direction] [✓/✗] [damage if attack] [KO!]`
  - Bench entries section if any
  - Win result if final turn
- Drawer slides up from bottom, ~280px tall, scrollable, dark theme matching the spectate UI
- Show "No log for initial state" when replayIndex = 0

### DB Migration
```sql
ALTER TABLE "matchSnapshot" ADD COLUMN IF NOT EXISTS "turnLogs" json;
```
Run via `scripts/db-push.ts` (programmatic push will handle new nullable column cleanly).

### Acceptance
- Upload a fresh match → confirm `turnLogs` stored in DB
- Spectate `→` to turn 3, click turn counter → drawer opens showing 3+ command rows
- Initial state (index 0) → "Start state — no actions yet"

---

## PR 3 — Feat: Animated Turn Transitions in Spectate

**Branch:** `feat/spectate-turn-animation`  
**Scope:** SpectateClient + BattleCanvas — ~200 lines  
**Goal:** Replace the instant state-swap with a three-phase animated sequence. PixiJS does the heavy lifting.

### Three-Phase Animation

```
User clicks → (Phase 1: Preview) → (Phase 2: Execute) → (Phase 3: Impact) → Idle
```

**Phase 1 — Preview** (500ms per command, sequential)  
Show what each cinderling *intends* to do, one by one in speed-priority order (from `turnLogs[i].commandResults`):
- Move: render a translucent ghost piece at the destination tile + directional arrow
- Attack: render a red targeting arc/highlight on the attack direction
- Harvest: render a green glow pulse on the current tile
- After all previewed: brief pause (300ms)

**Phase 2 — Execute** (400ms, simultaneous)  
All cinderlings animate to their new positions at once:
- Move commands: tween sprite from `oldPos` → `newPos` via PixiJS ticker (lerp, ~20 frames at 60fps)
- Failed moves: shake effect (rapid small oscillation in the blocked direction)
- New cinderlings entering from bench: fade in on spawn space

**Phase 3 — Impact** (300ms)  
After movement lands:
- Attack hits: flash damage number overlay (`-42` in red floating text, rises and fades)
- KO: target sprite fades out with a dissolve effect
- HP bars update with a smooth fill animation
- Energy delta indicators (`+3⚡`, `-15⚡`) briefly shown above each team HUD

### Implementation

**`BattleCanvas.tsx`** — add animation props:
```ts
type AnimationLayer = {
  ghosts: Array<{ uuid: string; x: number; y: number; teamId: 1 | 2 }>;  // Phase 1 ghost positions
  arrows: Array<{ uuid: string; direction: string }>;  // Phase 1 direction arrows
  tweens: Array<{ uuid: string; fromX: number; fromY: number; toX: number; toY: number }>;  // Phase 2
  damageNumbers: Array<{ x: number; y: number; value: number; teamId: 1 | 2 }>;  // Phase 3
};

// New optional prop:
animationLayer?: AnimationLayer;
```

Inside `draw()`, render ghost layer above normal cinderlings using semi-transparent sprites + arrow Graphics primitives. Tween sprites use PixiJS ticker for per-frame interpolation.

**`SpectateClient.tsx`** — animation state machine:
```ts
type AnimPhase = "idle" | "previewing" | "executing" | "impacting";
const [animPhase, setAnimPhase] = useState<AnimPhase>("idle");
const [previewIndex, setPreviewIndex] = useState(0);  // which command are we previewing
const [animLayer, setAnimLayer] = useState<AnimationLayer | null>(null);
```

Stepper `→` button:
- If `animPhase !== "idle"`: no-op (animation in progress)
- If no `turnLogs` for this step (old uploads): skip straight to state swap (current behavior)
- Otherwise: kick off the 3-phase sequence, update `replayIndex` only after Phase 3 completes

PixiJS ticker registration:
- Phase 2 tween: add `app.ticker.add(tweenFn)` where `tweenFn` lerps all sprites toward their target each frame. Remove ticker when all arrive (dist < 0.5px → snap to target).

**Key design decisions:**
- ← (back) button: always instant, no animation (going back shouldn't have a preview)
- Keyboard shortcuts: `→` / `ArrowRight` = advance, `Space` = advance, `←` / `ArrowLeft` = back
- If user clicks `→` during animation: queue the next turn to start immediately after current finishes
- Turn log button still clickable during idle phase only

### Acceptance
- Click `→` → preview arrows appear sequentially for each cinderling
- After ~2-3s total, cinderlings slide to new positions simultaneously
- Damage numbers flash and fade
- KO'd cinderlings fade out
- HP bars animate
- Going ← is instant
- Works cleanly for turns with 0 attacks (pure movement game)

---

## Execution Order

| Order | PR | Blocking? |
|-------|-----|-----------|
| 1 | `fix/spectate-game-balance` | Yes — must re-record matches before PRs 2-3 are useful |
| 2 | `feat/spectate-turn-log` | Partially — log UI depends on having good matches to watch |
| 3 | `feat/spectate-turn-animation` | No — can ship independently of PR 2 |

PRs 2 and 3 can be worked in parallel once PR 1 is merged and a new match is recorded.

---

## Out of Scope (This Plan)

- Real player AI (smarter energy/harvest logic) — separate improvement
- Web-based match creation with per-turn animation in live play — separate from spectate replay
- Mobile touch controls for the stepper
