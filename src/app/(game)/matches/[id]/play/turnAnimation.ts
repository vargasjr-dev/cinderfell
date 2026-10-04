/**
 * Turn animation — shared pure types and builder functions.
 *
 * Used by both SpectateClient (replay) and PlayPollingClient (live play).
 * No React dependencies — all pure data transformation.
 */

import type { CinderlingDisplay as CanvasCinderling, Overlays } from "./BattleCanvas";

// ─── Raw game-state types (wire format from server) ───────────────────────────

export type RawAttackDisplay = {
  key: string;
  name: string;
  damage: number;
  energyCost: number;
  range: number;
};

export type RawTeam = {
  id: 1 | 2;
  userId: string;
  name: string;
  energy: number;
  active: Array<{
    uuid: string;
    name: string;
    hp: number;
    maxHp: number;
    speed: number;
    attack: number;
    attacks?: RawAttackDisplay[];
    position: { x: number; y: number } | null;
    isKO: boolean;
    imageUrl?: string;
  }>;
  bench: unknown[];
  knocked: unknown[];
};

export type RawGameState = {
  turn: number;
  teams: RawTeam[];
  boardWidth: number;
  boardHeight: number;
  board: Array<{
    position: { x: number; y: number };
    type: string;
    occupationCounter?: number;
    harvestYield?: number;
  }>;
  result: { winner: 1 | 2; condition: string } | null;
};

// ─── Turn log types ───────────────────────────────────────────────────────────

export type Vec2 = { dx: number; dy: number };

export type RawCommandResult = {
  command: {
    type: "move" | "attack" | "harvest";
    cinderlingUuid: string;
    /** Game-space cardinal unit vector. */
    vec?: Vec2;
    attackIndex?: number;
  };
  success: boolean;
  reason?: string;
  energyDelta?: number;
  damageDealt?: number;
  targetKO?: boolean;
  targetUuid?: string;
  attackName?: string;
  powerEnergyDeltas?: Partial<Record<1 | 2, number>>;
  defenderPowerEffects?: Array<{
    type: "bonus_damage" | "heal";
    targetName: string;
    amount: number;
    powerName: string;
  }>;
  actorPowerEffects?: Array<{
    type: "bonus_damage" | "heal";
    targetName: string;
    targetUuid: string;
    amount: number;
    powerName: string;
  }>;
};

export type RawBenchEntry = {
  cinderlingUuid: string;
  cinderlingName: string;
  status: "entered" | "blocked";
};

export type RawTurnStartEvent = {
  casterUuid: string;
  casterName: string;
  team: 1 | 2;
  powerName: string;
  targetUuid: string;
  targetName: string;
  healAmount?: number;
  damageAmount?: number;
};

export type RawOccupationEvent = {
  x: number;
  y: number;
  counterBefore: number;
  counterAfter: number;
  tickingTeam: 1 | 2;
};

export type RawTurnLog = {
  turn: number;
  turnStartEvents?: RawTurnStartEvent[];
  commandResults: RawCommandResult[];
  benchEntries: { team1: RawBenchEntry[]; team2: RawBenchEntry[] };
  occupationEvents?: RawOccupationEvent[];
  winResult: { winner: 1 | 2; condition: string } | null;
};

// ─── Animation step type ──────────────────────────────────────────────────────

/**
 * Unified step: one command's full animation (preview arrow → tween → optional
 * recoil for attacks → optional impact label). The runner chains these
 * sequentially so the board shows P1→A1→P2→A2→... instead of all P then all A.
 */
export type UnifiedStep = {
  key: string;
  // Arrow(s) to accumulate before this step tweens
  previewOverlay: Overlays | null;
  previewMs: number;
  // Primary tween (move to new pos, or lunge toward target for attacks)
  tweenFrom: CanvasCinderling[];
  tweenTo: CanvasCinderling[];
  tweenMs: number;
  // Recoil tween (attacks only — snap attacker back to original pos)
  recoilTo?: CanvasCinderling[];
  recoilMs?: number;
  // Impact label after execute
  impactOverlay: Overlays | null;
  impactMs: number;
};

// ─── Utility functions ────────────────────────────────────────────────────────

/** Extract cinderlings suitable for BattleCanvas from a RawGameState snapshot. */
export function snapshotToCinderlings(snap: RawGameState): CanvasCinderling[] {
  const result: CanvasCinderling[] = [];
  for (const t of snap.teams) {
    for (const v of t.active) {
      if (!v.position) continue;
      result.push({
        uuid: v.uuid,
        name: v.name,
        hp: v.hp,
        maxHp: v.maxHp,
        speed: v.speed,
        attack: v.attack,
        x: v.position.x,
        y: v.position.y,
        isKO: v.isKO,
        teamId: t.id as 1 | 2,
        imageUrl: v.imageUrl,
      });
    }
  }
  return result;
}

/**
 * Scan along an attack Vec2 in the pre-turn snapshot to find the actual
 * hit tile. Needed so the arrow draws to where the target actually was, not
 * just attacker + 1 tile (which is wrong for range-2+ attacks).
 */
export function findAttackTargetTile(
  cmd: RawCommandResult,
  attackerPos: { x: number; y: number },
  vec: Vec2,
  fromSnap: RawGameState,
): { x: number; y: number } {
  const offset = vec;
  let range = 1;
  for (const t of fromSnap.teams) {
    const v = t.active.find((av) => av.uuid === cmd.command.cinderlingUuid);
    if (v) {
      const atk = v.attacks?.[cmd.command.attackIndex ?? 0];
      if (atk) range = atk.range;
      break;
    }
  }
  const attackerTeamId = fromSnap.teams.find((t) =>
    t.active.some((v) => v.uuid === cmd.command.cinderlingUuid),
  )?.id;
  for (let d = 1; d <= range; d++) {
    const pos = {
      x: attackerPos.x + offset.dx * d,
      y: attackerPos.y + offset.dy * d,
    };
    if (
      pos.x < 0 ||
      pos.x >= fromSnap.boardWidth ||
      pos.y < 0 ||
      pos.y >= fromSnap.boardHeight
    )
      break;
    for (const t of fromSnap.teams) {
      if (t.id === attackerTeamId) continue;
      const hit = t.active.find(
        (v) => !v.isKO && v.position?.x === pos.x && v.position?.y === pos.y,
      );
      if (hit) return pos;
    }
  }
  return { x: attackerPos.x + vec.dx, y: attackerPos.y + vec.dy };
}

/** Build a uuid → {name, teamId} lookup from a RawGameState. */
export function buildCinderlingLookup(
  gs: RawGameState,
): Map<string, { name: string; teamId: 1 | 2 }> {
  const map = new Map<string, { name: string; teamId: 1 | 2 }>();
  for (const t of gs.teams) {
    for (const v of [
      ...t.active,
      ...(t.bench as Array<{ uuid: string; name: string }>),
      ...(t.knocked as Array<{ uuid: string; name: string }>),
    ]) {
      map.set(v.uuid, { name: v.name, teamId: t.id });
    }
  }
  return map;
}

/**
 * Build a unified step list for one turn.
 * Each entry covers preview + animation for a single command.
 * A final reconciliation step snaps to the true toSnap state.
 */
export function buildUnifiedSteps(
  sortedCmds: RawCommandResult[],
  fromSnap: RawGameState,
  toSnap: RawGameState,
  lookup: Map<string, { name: string; teamId: 1 | 2 }>,
  turnStartEvents: RawTurnStartEvent[] = [],
  rawLog?: Pick<RawTurnLog, "occupationEvents">,
): UnifiedStep[] {
  const steps: UnifiedStep[] = [];

  const workingPos = new Map<string, { x: number; y: number }>();
  const workingHp = new Map<string, number>();
  const workingKo = new Set<string>();
  const baseVms = snapshotToCinderlings(fromSnap);
  baseVms.forEach((v) => {
    workingPos.set(v.uuid, { x: v.x, y: v.y });
    workingHp.set(v.uuid, v.hp);
    if (v.isKO) workingKo.add(v.uuid);
  });

  function snapshot(): CanvasCinderling[] {
    return baseVms
      .filter((v) => !workingKo.has(v.uuid))
      .map((v) => {
        const pos = workingPos.get(v.uuid);
        const hp = workingHp.get(v.uuid) ?? v.hp;
        return pos ? { ...v, x: pos.x, y: pos.y, hp } : { ...v, hp };
      });
  }

  let stepIdx = 0;

  // ── Turn-start passive events (heals & burn damage) ───────────────────────
  if (turnStartEvents.length > 0) {
    const preSnap = snapshot();
    const labels: {
      x: number;
      y: number;
      text: string;
      color: number;
      alpha: number;
    }[] = [];
    for (const e of turnStartEvents) {
      const pos = (() => {
        for (const t of fromSnap.teams) {
          const v = t.active.find((av) => av.uuid === e.targetUuid);
          if (v?.position) return v.position as { x: number; y: number };
        }
        return null;
      })();
      if (pos) {
        if (e.damageAmount) {
          workingHp.set(
            e.targetUuid,
            Math.max(0, (workingHp.get(e.targetUuid) ?? 0) - e.damageAmount),
          );
          labels.push({
            x: pos.x,
            y: pos.y - 0.5,
            text: `-${e.damageAmount} 🔥`,
            color: 0xf97316,
            alpha: 1,
          });
        } else if (e.healAmount) {
          workingHp.set(
            e.targetUuid,
            Math.min(
              fromSnap.teams
                .flatMap((t) => t.active)
                .find((v) => v.uuid === e.targetUuid)?.maxHp ?? Infinity,
              (workingHp.get(e.targetUuid) ?? 0) + e.healAmount,
            ),
          );
          labels.push({
            x: pos.x,
            y: pos.y - 0.5,
            text: `+${e.healAmount} 💧`,
            color: 0x4ade80,
            alpha: 1,
          });
        }
      }
    }
    const afterSnap = snapshot();
    steps.push({
      key: `ts-${stepIdx++}`,
      previewOverlay: {},
      previewMs: 0,
      tweenFrom: preSnap,
      tweenTo: afterSnap,
      tweenMs: 350,
      impactOverlay: labels.length > 0 ? { labels } : null,
      impactMs: 600,
    });
  }

  for (const cmd of sortedCmds) {
    // Failed attacks — preview + fizzle label
      if (!cmd.success && cmd.command.type === "attack") {
        const uuid = cmd.command.cinderlingUuid;
        const cur = workingPos.get(uuid);
        const offset = cmd.command.vec;
        if (cur && offset) {
          const tx = cur.x + offset.dx;
          const ty = cur.y + offset.dy;
        const from = snapshot();
        steps.push({
          key: String(stepIdx++),
          previewOverlay: {
            arrows: [{ fromX: cur.x, fromY: cur.y, toX: tx, toY: ty, color: 0xff6b6b, alpha: 0.4 }],
          },
          previewMs: 300,
          tweenFrom: from,
          tweenTo: from,
          tweenMs: 40,
          impactOverlay: {
            labels: [{ x: tx, y: ty, text: "✗ No energy", color: 0x6b7280, alpha: 1 }],
          },
          impactMs: 350,
        });
      }
      continue;
    }

    // Failed harvests — preview + blocked label
      if (!cmd.success && cmd.command.type === "harvest") {
        const uuid = cmd.command.cinderlingUuid;
        const cur = workingPos.get(uuid);
        const offset = cmd.command.vec;
      if (cur && offset) {
        const tx = cur.x + offset.dx;
        const ty = cur.y + offset.dy;
        const from = snapshot();
        steps.push({
          key: String(stepIdx++),
          previewOverlay: {
            arrows: [{ fromX: cur.x, fromY: cur.y, toX: tx, toY: ty, color: 0x4ade80, alpha: 0.6 }],
          },
          previewMs: 300,
          tweenFrom: from,
          tweenTo: from,
          tweenMs: 40,
          impactOverlay: {
            labels: [{ x: tx, y: ty, text: "✗", color: 0x6b7280, alpha: 1 }],
          },
          impactMs: 300,
        });
      }
      continue;
    }

    // Failed moves — preview arrow + bump-and-return tween + "Blocked" label
      if (!cmd.success && cmd.command.type === "move") {
        const uuid = cmd.command.cinderlingUuid;
        const cur = workingPos.get(uuid);
        const offset = cmd.command.vec;
      if (cur && offset) {
        const tx = cur.x + offset.dx;
        const ty = cur.y + offset.dy;
        const from = snapshot();
        // Nudge 35% toward target
        workingPos.set(uuid, { x: cur.x + offset.dx * 0.35, y: cur.y + offset.dy * 0.35 });
        const nudged = snapshot();
        // Restore original position
        workingPos.set(uuid, { x: cur.x, y: cur.y });
        const restored = snapshot();
        steps.push({
          key: String(stepIdx++),
          previewOverlay: {
            arrows: [{ fromX: cur.x, fromY: cur.y, toX: tx, toY: ty, color: 0xfbbf24, alpha: 0.45 }],
          },
          previewMs: 250,
          tweenFrom: from,
          tweenTo: nudged,
          tweenMs: 120,
          impactOverlay: {
            labels: [{ x: tx, y: ty, text: "✗ Blocked", color: 0x9ca3af, alpha: 1 }],
          },
          impactMs: 0,
        });
        // Bounce back
        steps.push({
          key: String(stepIdx++),
          previewOverlay: null,
          previewMs: 0,
          tweenFrom: nudged,
          tweenTo: restored,
          tweenMs: 100,
          impactOverlay: {
            labels: [{ x: tx, y: ty, text: "✗ Blocked", color: 0x9ca3af, alpha: 1 }],
          },
          impactMs: 250,
        });
      }
      continue;
    }

    if (!cmd.success) continue;

    const uuid = cmd.command.cinderlingUuid;
    const info = lookup.get(uuid);
    const teamId = info?.teamId ?? 1;
    const teamColor = teamId === 1 ? 0x3b82f6 : 0xef4444;
    const cur = workingPos.get(uuid);
    if (!cur) continue;

    const offset = cmd.command.vec;

    if (cmd.command.type === "move" && offset) {
      const from = snapshot();
      workingPos.set(uuid, { x: cur.x + offset.dx, y: cur.y + offset.dy });
      const to = snapshot();

      steps.push({
        key: String(stepIdx++),
        previewOverlay: {
          ghosts: [{ x: cur.x + offset.dx, y: cur.y + offset.dy, teamId, alpha: 1 }],
          arrows: [{ fromX: cur.x, fromY: cur.y, toX: cur.x + offset.dx, toY: cur.y + offset.dy, color: teamColor, alpha: 0.85 }],
        },
        previewMs: 300,
        tweenFrom: from,
        tweenTo: to,
        tweenMs: 260,
        impactOverlay: null,
        impactMs: 0,
      });
    } else if (cmd.command.type === "attack" && offset) {
      const targetTile = findAttackTargetTile(cmd, cur, offset, fromSnap);

      // Resolve attack key + name
      let attackKey = "strike";
      let attackName = cmd.attackName ?? "Attack";
      for (const t of fromSnap.teams) {
        const v = t.active.find((av) => av.uuid === uuid);
        if (v) {
          const atk = v.attacks?.[cmd.command.attackIndex ?? 0];
          if (atk) {
            attackKey = atk.key;
            attackName = atk.name;
          }
          break;
        }
      }

      const isRanged = ["lob", "snipe", "chip"].includes(attackKey);
      const arrowColor =
        attackKey === "lob" ? 0xa78bfa
          : attackKey === "snipe" ? 0x38bdf8
          : attackKey === "chip" ? 0x94a3b8
          : attackKey === "nuke" ? 0xf97316
          : attackKey === "slam" ? 0xef4444
          : attackKey === "poke" ? 0xfbbf24
          : 0xff6b6b;

      const from = snapshot();

      // Apply damage to target HP at impact moment
      if (cmd.damageDealt && cmd.damageDealt > 0) {
        const attackerTeamId = fromSnap.teams.find((t) =>
          t.active.some((v) => v.uuid === uuid),
        )?.id;
        for (const t of fromSnap.teams) {
          if (t.id === attackerTeamId) continue;
          const hit = t.active.find(
            (v) => !v.isKO && v.position?.x === targetTile.x && v.position?.y === targetTile.y,
          );
          if (hit) {
            workingHp.set(hit.uuid, Math.max(0, (workingHp.get(hit.uuid) ?? hit.hp) - cmd.damageDealt));
            if (cmd.targetKO) workingKo.add(hit.uuid);
            break;
          }
        }
      }

      let lunged = from;
      let back = from;
      let tweenMs = 60;
      let recoilMs = 0;
      if (!isRanged) {
        workingPos.set(uuid, { x: cur.x + offset.dx * 0.35, y: cur.y + offset.dy * 0.35 });
        lunged = snapshot();
        workingPos.set(uuid, cur);
        back = snapshot();
        tweenMs = 110;
        recoilMs = 80;
      }

      let impactOverlay: Overlays | null = null;
      if ((cmd.damageDealt && cmd.damageDealt > 0) || cmd.targetKO) {
        impactOverlay = {
          labels: [{
            x: targetTile.x,
            y: targetTile.y,
            text: cmd.targetKO ? "💀 KO!" : `-${cmd.damageDealt}`,
            color: cmd.targetKO ? 0xff4444 : 0xfbbf24,
            alpha: 1,
          }],
        };
      }

      steps.push({
        key: String(stepIdx++),
        previewOverlay: {
          arrows: [{ fromX: cur.x, fromY: cur.y, toX: targetTile.x, toY: targetTile.y, color: arrowColor, alpha: 0.9 }],
          labels: [{ x: cur.x, y: cur.y, text: attackName, color: arrowColor, alpha: 1 }],
        },
        previewMs: isRanged ? 400 : 300,
        tweenFrom: from,
        tweenTo: lunged,
        tweenMs,
        recoilTo: back,
        recoilMs,
        impactOverlay,
        impactMs: 400,
      });
    } else if (cmd.command.type === "harvest" && offset) {
      const tx = cur.x + offset.dx;
      const ty = cur.y + offset.dy;
      const from = snapshot();
      const energyLabel = cmd.energyDelta && cmd.energyDelta > 0 ? `+${cmd.energyDelta}⚡` : "+⚡";

      // Collect actor-power heal labels (e.g. Sproutail Regrowth Tail +3 HP)
      const impactLabels: Array<{ x: number; y: number; text: string; color: number; alpha: number }> = [
        { x: tx, y: ty, text: energyLabel, color: 0x4ade80, alpha: 1 },
      ];
      if (cmd.actorPowerEffects) {
        for (const e of cmd.actorPowerEffects) {
          if (e.type === "heal") {
            impactLabels.push({ x: cur.x, y: cur.y, text: `+${e.amount} 💚`, color: 0x86efac, alpha: 1 });
          } else if (e.type === "bonus_damage") {
            impactLabels.push({ x: cur.x, y: cur.y, text: `-${e.amount} 💥`, color: 0xf87171, alpha: 1 });
          }
        }
      }

      steps.push({
        key: String(stepIdx++),
        previewOverlay: {
          arrows: [{ fromX: cur.x, fromY: cur.y, toX: tx, toY: ty, color: 0x4ade80, alpha: 0.8 }],
        },
        previewMs: 300,
        tweenFrom: from,
        tweenTo: from,
        tweenMs: 60,
        impactOverlay: { labels: impactLabels },
        impactMs: 400,
      });
    }
  }

  // Final reconciliation — snaps to true toSnap state
  steps.push({
    key: "final",
    previewOverlay: {},
    previewMs: 0,
    tweenFrom: snapshot(),
    tweenTo: snapshotToCinderlings(toSnap),
    tweenMs: 80,
    impactOverlay: null,
    impactMs: 0,
  });

  // Occupation event steps — one label flash per changed point
  const occEvents = rawLog?.occupationEvents ?? [];
  if (occEvents.length > 0) {
    const finalPos = snapshotToCinderlings(toSnap);
    const THRESHOLD = 2; // matches GAME_CONFIG.occupation.ticksToControl
    const occLabels = occEvents.map((e) => {
      const owned = Math.abs(e.counterAfter) >= THRESHOLD;
      const teamColor = e.tickingTeam === 1 ? 0x3b82f6 : 0xef4444;
      const text = owned ? "⭐ Captured!" : `⭐ +1`;
      return { x: e.x, y: e.y, text, color: teamColor, alpha: 1 };
    });
    steps.push({
      key: "occ-events",
      previewOverlay: { labels: occLabels },
      previewMs: 700,
      tweenFrom: finalPos,
      tweenTo: finalPos,
      tweenMs: 0,
      impactOverlay: null,
      impactMs: 0,
    });
  }

  return steps;
}
