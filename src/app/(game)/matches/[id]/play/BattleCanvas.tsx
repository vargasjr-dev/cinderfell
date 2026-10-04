"use client";

import { useRef, useEffect, useCallback } from "react";
import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Assets,
  Texture,
  Rectangle,
} from "pixi.js";

export type CinderlingDisplay = {
  uuid: string;
  name: string;
  hp: number;
  maxHp: number;
  speed: number;
  attack: number;
  /** Fractional grid coordinates — supports sub-tile positions for smooth animation */
  x: number;
  y: number;
  isKO: boolean;
  teamId: 1 | 2;
  imageUrl?: string;
};

type BoardSpace = {
  x: number;
  y: number;
  type: string;
  occupationCounter?: number;
  harvestYield?: number;
};

// ─── Overlay types — rendered on top of the board for animation effects ───────

export type OverlayGhost = {
  /** Fractional grid position of the ghost piece */
  x: number;
  y: number;
  teamId: 1 | 2;
  alpha: number;
};

export type OverlayArrow = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: number;
  alpha: number;
};

export type OverlayLabel = {
  /** Grid position to anchor the label */
  x: number;
  y: number;
  text: string;
  color: number;
  alpha: number;
};

export type Overlays = {
  ghosts?: OverlayGhost[];
  arrows?: OverlayArrow[];
  labels?: OverlayLabel[];
};

/**
 * Tween: when `key` changes, BattleCanvas smoothly interpolates cinderling
 * positions from `from` → `to` over `duration` ms using its own Pixi ticker —
 * zero React state updates per frame, so no re-render flicker.
 */
export type TweenTarget = {
  /** Changing this value starts a new tween. */
  key: number | string;
  from: CinderlingDisplay[];
  to: CinderlingDisplay[];
  duration: number;
  onComplete?: () => void;
};

// ─── Props ────────────────────────────────────────────────────────────────────

export type PendingCommandDisplay = {
  cinderlingUuid: string;
  type: "move" | "attack" | "harvest";
  /** Cardinal unit vector in game space — orientation-agnostic */
  vec?: { dx: number; dy: number };
};

type Props = {
  boardWidth: number;
  boardHeight: number;
  spaces: BoardSpace[];
  cinderlings: CinderlingDisplay[];
  yourTeamId: 1 | 2;
  selectedCinderling: string | null;
  onSelectCinderling: (uuid: string | null) => void;
  commandedUuids: Set<string>;
  /** Pending commands — shown as faint badge overlays on each cinderling tile */
  pendingCommandDisplays?: PendingCommandDisplay[];
  overlays?: Overlays;
  /** When provided and key changes, animates cinderling positions internally via Pixi ticker. */
  tween?: TweenTarget;
  /** When true, all cinderlings (not just yours) fire pointertap — used in spectate/replay mode. */
  tapAllCinderlings?: boolean;
};

// ─── Colors ───────────────────────────────────────────────────────────────────

const COLORS = {
  bg: 0x0a0f1a,
  tile: 0x111b2e,
  tileBorder: 0x1e2d4a,
  occupation: 0x3d2800,
  occupationBorder: 0xb8860b,
  occupationStar: 0xffd700,
  harvestable: 0x0a1a10,
  harvestableBorder: 0x142e1a,
  spawn: 0x0f1628,
  spawnBorder: 0x2a3a5c,
  team1: 0x2563eb,
  team1Glow: 0x3b82f6,
  team1Light: 0x1e3a5f,
  team1Dark: 0x2563eb,
  team2: 0xdc2626,
  team2Glow: 0xef4444,
  team2Light: 0x5f1e1e,
  team2Dark: 0xdc2626,
  hpBarBg: 0x1f2937,
  hpBarGreen: 0x22c55e,
  hpBarYellow: 0xeab308,
  hpBarRed: 0xef4444,
  selected: 0xfbbf24,
  commanded: 0x22c55e,
};

function teamColor(teamId: 1 | 2) {
  return teamId === 1 ? COLORS.team1 : COLORS.team2;
}
function teamGlow(teamId: 1 | 2) {
  return teamId === 1 ? COLORS.team1Glow : COLORS.team2Glow;
}

const loadingUrls = new Set<string>();
// Cache cropped textures so we don't recreate them every draw frame
const croppedTextureCache = new Map<string, Texture>();
// Sprites are 1408×1408 with ~25% whitespace padding on each side.
// Crop proportionally so the mon fills the tile regardless of source resolution.
const SPRITE_CROP_FRAC = 0.25;

// ─── Grid ↔ Screen coordinate helpers ────────────────────────────────────────

/**
 * Convert a (possibly fractional) grid position to canvas pixel center.
 * Supports sub-tile positions for smooth cinderling animation.
 */
function gridToScreen(
  gx: number,
  gy: number,
  tileSize: number,
  gap: number,
  isPortrait: boolean,
  bw: number,
  myTeam: 1 | 2,
): { centerX: number; centerY: number } {
  let col: number, row: number;
  if (isPortrait) {
    if (myTeam === 1) {
      col = gy;
      row = bw - 1 - gx;
    } else {
      col = gy;
      row = gx;
    }
  } else {
    col = gx;
    row = gy;
  }
  return {
    centerX: col * (tileSize + gap) + tileSize / 2,
    centerY: row * (tileSize + gap) + tileSize / 2,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

function lerpCinderlings(
  from: CinderlingDisplay[],
  to: CinderlingDisplay[],
  t: number,
): CinderlingDisplay[] {
  return from.map((fv) => {
    const tv = to.find((v) => v.uuid === fv.uuid);
    const toPos = tv ?? fv;
    return {
      ...fv,
      x: fv.x + (toPos.x - fv.x) * t,
      y: fv.y + (toPos.y - fv.y) * t,
      hp: t < 1 ? fv.hp : (tv?.hp ?? fv.hp),
    };
  });
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export default function BattleCanvas({
  boardWidth,
  boardHeight,
  spaces,
  cinderlings,
  yourTeamId,
  selectedCinderling,
  onSelectCinderling,
  commandedUuids,
  pendingCommandDisplays,
  overlays,
  tween,
  tapAllCinderlings,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  // Ref that overrides the `cinderlings` prop during an active tween.
  // Null = use the prop as-is. This is the key to avoiding React re-renders per frame.
  const displayVmsRef = useRef<CinderlingDisplay[] | null>(null);
  const activeTweenKeyRef = useRef<number | string | null>(null);

  const stateRef = useRef({
    boardWidth,
    boardHeight,
    spaces,
    cinderlings,
    yourTeamId,
    selectedCinderling,
    commandedUuids,
    pendingCommandDisplays: pendingCommandDisplays ?? [],
    overlays,
    tapAllCinderlings: false,
  });
  const drawRef = useRef<() => void>();

  stateRef.current = {
    boardWidth,
    boardHeight,
    spaces,
    cinderlings,
    yourTeamId,
    selectedCinderling,
    commandedUuids,
    pendingCommandDisplays: pendingCommandDisplays ?? [],
    overlays,
    tapAllCinderlings: tapAllCinderlings ?? false,
  };

  const draw = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const {
      boardWidth: bw,
      boardHeight: bh,
      spaces: sp,
      yourTeamId: myTeam,
      selectedCinderling: selVm,
      commandedUuids: cmdSet,
      pendingCommandDisplays: pendingCmds,
      overlays: ovl,
      tapAllCinderlings: tapAll,
    } = stateRef.current;
    // Use tween-interpolated positions when active; fall back to prop
    const vms = displayVmsRef.current ?? stateRef.current.cinderlings;

    app.stage.removeChildren();

    const screenW = app.screen.width;
    const screenH = app.screen.height;
    const isPortrait = window.innerHeight > window.innerWidth;

    const cols = isPortrait ? bh : bw;
    const rows = isPortrait ? bw : bh;

    const padding = 12;
    const gap = 3;
    const tileW = Math.floor((screenW - padding * 2 - gap * (cols - 1)) / cols);
    const tileH = Math.floor((screenH - padding * 2 - gap * (rows - 1)) / rows);
    // No hard cap — let the grid fill the available canvas area naturally
    const tileSize = Math.min(tileW, tileH);
    const cornerRadius = 6;

    const gridW = cols * tileSize + (cols - 1) * gap;
    const gridH = rows * tileSize + (rows - 1) * gap;
    const offsetX = (screenW - gridW) / 2;
    const offsetY = (screenH - gridH) / 2;

    const boardContainer = new Container();
    boardContainer.x = offsetX;
    boardContainer.y = offsetY;
    app.stage.addChild(boardContainer);

    const spaceMap = new Map<string, BoardSpace>();
    for (const s of sp) spaceMap.set(`${s.x},${s.y}`, s);

    // Map integer positions → cinderling (for tile coloring only)
    const vmIntMap = new Map<string, CinderlingDisplay>();
    for (const v of vms) {
      if (!v.isKO) vmIntMap.set(`${Math.round(v.x)},${Math.round(v.y)}`, v);
    }

    // Pre-load uncached textures
    for (const v of vms) {
      if (
        v.imageUrl &&
        !Assets.cache.has(v.imageUrl) &&
        !loadingUrls.has(v.imageUrl)
      ) {
        loadingUrls.add(v.imageUrl);
        Assets.load(v.imageUrl)
          .then(() => {
            drawRef.current?.();
          })
          .catch(() => {
            loadingUrls.delete(v.imageUrl!);
          });
      }
    }

    // ── Pass 1: Board tiles ────────────────────────────────────────────────
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let gx: number, gy: number;
        if (isPortrait) {
          if (myTeam === 1) {
            gx = rows - 1 - row;
            gy = col;
          } else {
            gx = row;
            gy = col;
          }
        } else {
          gx = col;
          gy = row;
        }

        const px = col * (tileSize + gap);
        const py = row * (tileSize + gap);

        const space = spaceMap.get(`${gx},${gy}`);
        const vm = vmIntMap.get(`${gx},${gy}`);
        const isOccupation = space?.type === "occupation";
        const isHarvestable = space?.type === "harvestable";
        const isSpawn = space?.type === "spawn";
        const isSelected = vm?.uuid === selVm;
        const isYours = vm ? vm.teamId === myTeam : false;
        const isCommanded = vm ? cmdSet.has(vm.uuid) : false;

        const tile = new Graphics();

        if (isSelected) {
          tile.roundRect(
            px - 2,
            py - 2,
            tileSize + 4,
            tileSize + 4,
            cornerRadius + 2,
          );
          tile.fill({ color: COLORS.selected, alpha: 0.6 });
        } else if (isCommanded && isYours) {
          tile.roundRect(
            px - 1,
            py - 1,
            tileSize + 2,
            tileSize + 2,
            cornerRadius + 1,
          );
          tile.fill({ color: COLORS.commanded, alpha: 0.3 });
        }

        const occCounter = space?.occupationCounter ?? 0;
        let fillColor = COLORS.tile;
        let borderColor = COLORS.tileBorder;
        if (isOccupation) {
          if (occCounter < 0) {
            fillColor = COLORS.team1Light;
            borderColor = COLORS.team1Dark;
          } else if (occCounter > 0) {
            fillColor = COLORS.team2Light;
            borderColor = COLORS.team2Dark;
          } else {
            fillColor = COLORS.occupation;
            borderColor = COLORS.occupationBorder;
          }
        } else if (isHarvestable) {
          fillColor = COLORS.harvestable;
          borderColor = COLORS.harvestableBorder;
        } else if (isSpawn) {
          fillColor = COLORS.spawn;
          borderColor = COLORS.spawnBorder;
        }
        if (vm) borderColor = teamColor(vm.teamId);

        tile.roundRect(px, py, tileSize, tileSize, cornerRadius);
        tile.fill(fillColor);
        tile.stroke({ color: borderColor, width: vm ? 2 : 1 });
        boardContainer.addChild(tile);

        if (vm && (isYours || tapAll)) {
          tile.eventMode = "static";
          tile.cursor = "pointer";
          const vuuid = vm.uuid;
          tile.on("pointertap", () => {
            onSelectCinderling(selVm === vuuid ? null : vuuid);
          });
        }

        // Static board markers (no vm)
        if (!vm && isOccupation) {
          const starColor =
            occCounter < 0
              ? COLORS.team1Glow
              : occCounter > 0
                ? COLORS.team2Glow
                : COLORS.occupationStar;
          const star = new Text({
            text: "⭐",
            style: new TextStyle({
              fontSize: Math.min(tileSize * 0.35, 20),
              fill: starColor,
              align: "center",
            }),
          });
          star.anchor.set(0.5);
          star.x = px + tileSize / 2;
          star.y = py + tileSize / 2;
          boardContainer.addChild(star);
        }
        if (!vm && isHarvestable) {
          const yield_ = space?.harvestYield ?? 1;
          const fernEmoji = yield_ >= 4 ? "🌳" : yield_ >= 3 ? "🪴" : yield_ >= 2 ? "🌿" : "🌱";
          const fernScale = yield_ >= 4 ? 0.38 : yield_ >= 3 ? 0.32 : yield_ >= 2 ? 0.26 : 0.2;
          const fernColor =
            yield_ >= 4 ? 0x1a6b32 : yield_ >= 3 ? 0x2d8c4a : yield_ >= 2 ? 0x1f7a3a : 0x1a5c2a;
          const leaf = new Text({
            text: fernEmoji,
            style: new TextStyle({
              fontSize: Math.min(
                tileSize * fernScale,
                yield_ >= 4 ? 22 : yield_ >= 3 ? 18 : yield_ >= 2 ? 14 : 11,
              ),
              fill: fernColor,
              align: "center",
            }),
          });
          leaf.anchor.set(0.5);
          leaf.x = px + tileSize / 2;
          leaf.y = py + tileSize / 2;
          boardContainer.addChild(leaf);
        }
      }
    }

    // ── Pass 2: Cinderling sprites at fractional positions ──────────────────
    for (const vm of vms) {
      if (vm.isKO) continue;
      const { centerX, centerY } = gridToScreen(
        vm.x,
        vm.y,
        tileSize,
        gap,
        isPortrait,
        bw,
        myTeam,
      );
      const avatarSize = tileSize * 0.88;

      if (vm.imageUrl && Assets.cache.has(vm.imageUrl)) {
          // Use a cropped texture (trim SPRITE_CROP px per side) so the mon
          // fills more of the tile rather than floating in whitespace.
          let tex = croppedTextureCache.get(vm.imageUrl);
          if (!tex) {
            const base: Texture = Assets.get(vm.imageUrl);
            const c = Math.round(base.width * SPRITE_CROP_FRAC);
            tex = new Texture({
              source: base.source,
              frame: new Rectangle(c, c, base.width - c * 2, base.height - c * 2),
            });
            croppedTextureCache.set(vm.imageUrl, tex);
          }
          const sprite = new Sprite(tex);
          sprite.width = avatarSize;
          sprite.height = avatarSize;
          sprite.anchor.set(0.5);
          sprite.x = centerX;
          sprite.y = centerY - 2;
          boardContainer.addChild(sprite);
        } else {
        const circle = new Graphics();
        circle.circle(centerX, centerY - 2, avatarSize / 2);
        circle.fill(teamGlow(vm.teamId));
        boardContainer.addChild(circle);
      }

      // HP bar
      const hpBarW = tileSize * 0.75;
      const hpBarH = 4;
      const hpBarX = centerX - hpBarW / 2;
      const hpBarY = centerY + tileSize / 2 - 8;
      const hpPercent = vm.maxHp > 0 ? vm.hp / vm.maxHp : 0;

      const hpBg = new Graphics();
      hpBg.roundRect(hpBarX, hpBarY, hpBarW, hpBarH, 2);
      hpBg.fill(COLORS.hpBarBg);
      boardContainer.addChild(hpBg);

      if (hpPercent > 0) {
        const hpColor =
          hpPercent > 0.5
            ? COLORS.hpBarGreen
            : hpPercent > 0.25
              ? COLORS.hpBarYellow
              : COLORS.hpBarRed;
        const hpFill = new Graphics();
        hpFill.roundRect(hpBarX, hpBarY, hpBarW * hpPercent, hpBarH, 2);
        hpFill.fill(hpColor);
        boardContainer.addChild(hpFill);
      }

      // Pending command badge — faint icon overlaid on the mon
      const pendingCmd = pendingCmds.find((c) => c.cinderlingUuid === vm.uuid);
      if (pendingCmd && vm.teamId === myTeam) {
        const typeIcon =
          pendingCmd.type === "move"
            ? "👟"
            : pendingCmd.type === "attack"
              ? "⚔️"
              : "🌱";
        // Convert game-space Vec2 to the screen arrow the player sees.
          // Portrait: Team1 col=gy row=bw-1-gx → game +x = screen up
          //           Team2 col=gy row=gx       → game +x = screen down
          // Landscape: game axes = screen axes.
          const vec = pendingCmd.vec;
          let dirArrow = "";
          if (vec) {
            const { dx, dy } = vec;
            if (!isPortrait) {
              dirArrow = dx === 1 ? " →" : dx === -1 ? " ←" : dy === 1 ? " ↓" : " ↑";
            } else if (myTeam === 1) {
              dirArrow = dx === 1 ? " ↑" : dx === -1 ? " ↓" : dy === 1 ? " →" : " ←";
            } else {
              dirArrow = dx === 1 ? " ↓" : dx === -1 ? " ↑" : dy === 1 ? " →" : " ←";
            }
          }
        const badgeFontSize = Math.min(tileSize * 0.3, 18);
        const badgeText = new Text({
          text: `${typeIcon}${dirArrow}`,
          style: new TextStyle({
            fontSize: badgeFontSize,
            fill: 0xffffff,
            align: "center",
            dropShadow: { color: 0x000000, blur: 4, alpha: 0.85, distance: 0 },
          }),
        });
        badgeText.anchor.set(0.5);
        badgeText.x = centerX;
        badgeText.y = centerY - 2;
        badgeText.alpha = 0.85;
        boardContainer.addChild(badgeText);
      }
    }

    // ── Pass 3: Overlays (ghosts, arrows, labels) ─────────────────────────
    if (ovl) {
      // Ghost pieces — translucent circles at preview target positions
      for (const g of ovl.ghosts ?? []) {
        const { centerX, centerY } = gridToScreen(
          g.x,
          g.y,
          tileSize,
          gap,
          isPortrait,
          bw,
          myTeam,
        );
        const ghost = new Graphics();
        ghost.circle(centerX, centerY - 2, tileSize * 0.28);
        ghost.fill({ color: teamGlow(g.teamId), alpha: g.alpha * 0.45 });
        ghost.stroke({
          color: teamGlow(g.teamId),
          width: 1.5,
          alpha: g.alpha * 0.7,
        });
        boardContainer.addChild(ghost);
      }

      // Direction arrows — line from source center to target center
      for (const a of ovl.arrows ?? []) {
        const from = gridToScreen(
          a.fromX,
          a.fromY,
          tileSize,
          gap,
          isPortrait,
          bw,
          myTeam,
        );
        const to = gridToScreen(
          a.toX,
          a.toY,
          tileSize,
          gap,
          isPortrait,
          bw,
          myTeam,
        );
        const dx = to.centerX - from.centerX;
        const dy = to.centerY - from.centerY;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) continue;
        const ux = dx / len,
          uy = dy / len;
        const startX = from.centerX + ux * tileSize * 0.3;
        const startY = from.centerY + uy * tileSize * 0.3;
        const endX = to.centerX - ux * tileSize * 0.25;
        const endY = to.centerY - uy * tileSize * 0.25;
        const arrowSize = tileSize * 0.14;
        const angle = Math.atan2(dy, dx);

        const arrow = new Graphics();
        arrow.moveTo(startX, startY);
        arrow.lineTo(endX, endY);
        arrow.stroke({ color: a.color, width: 2, alpha: a.alpha });
        // Arrowhead
        arrow.moveTo(endX, endY);
        arrow.lineTo(
          endX - arrowSize * Math.cos(angle - 0.5),
          endY - arrowSize * Math.sin(angle - 0.5),
        );
        arrow.moveTo(endX, endY);
        arrow.lineTo(
          endX - arrowSize * Math.cos(angle + 0.5),
          endY - arrowSize * Math.sin(angle + 0.5),
        );
        arrow.stroke({ color: a.color, width: 2, alpha: a.alpha });
        boardContainer.addChild(arrow);
      }

      // Floating labels — damage numbers, KO flashes, etc.
      for (const lbl of ovl.labels ?? []) {
        const { centerX, centerY } = gridToScreen(
          lbl.x,
          lbl.y,
          tileSize,
          gap,
          isPortrait,
          bw,
          myTeam,
        );
        const t = new Text({
          text: lbl.text,
          style: new TextStyle({
            fontSize: Math.min(tileSize * 0.3, 16),
            fill: lbl.color,
            fontWeight: "bold",
            dropShadow: { color: 0x000000, blur: 3, distance: 1, alpha: 0.8 },
          }),
        });
        t.anchor.set(0.5);
        t.x = centerX;
        t.y = centerY - tileSize * 0.55;
        t.alpha = lbl.alpha;
        boardContainer.addChild(t);
      }
    }
  }, [onSelectCinderling]);

  drawRef.current = draw;

  // Keep drawRef current whenever draw changes — without triggering Pixi re-init
  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  // Pixi app: created once on mount, never recreated due to draw/prop changes.
  // All drawing goes through drawRef so the app stays alive for the full component lifetime.
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let destroyed = false;
    (async () => {
      const app = new Application();
      await app.init({
        background: COLORS.bg,
        resizeTo: container,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (destroyed) {
        app.destroy(true);
        return;
      }
      container.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;
      drawRef.current?.();
    })();
    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: don't redraw via React when a tween ticker is running.
  // When cinderlings prop changes (replayIndex advances after full animation), clear
  // the committed displayVmsRef so the new snapshot takes over.
  useEffect(() => {
    if (activeTweenKeyRef.current !== null) return; // ticker running — skip
    displayVmsRef.current = null; // release committed positions; use fresh prop
    draw();
  }, [
    boardWidth,
    boardHeight,
    spaces,
    cinderlings,
    yourTeamId,
    selectedCinderling,
    commandedUuids,
    draw,
  ]);

  // Overlays can change during tween (Phase 1 previews) — always redraw for those
  useEffect(() => {
    draw();
  }, [overlays, draw]);

  // Tween: when key changes, run the animation inside the Pixi ticker
  useEffect(() => {
    if (!tween || tween.key === activeTweenKeyRef.current) return;
    const app = appRef.current;
    if (!app) return;

    activeTweenKeyRef.current = tween.key;
    const { from, to, duration, onComplete } = tween;
    const startTime = performance.now();

    const ticker = () => {
      const raw = Math.min((performance.now() - startTime) / duration, 1);
      const t = easeInOut(raw);
      displayVmsRef.current = lerpCinderlings(from, to, t);
      drawRef.current?.();
      if (raw >= 1) {
        app.ticker.remove(ticker);
        // Keep displayVmsRef at final position — don't revert to the React prop
        // (which is still fromSnap during multi-step animations). The prop guard
        // below clears it only when cinderlings actually advances to the next snapshot.
        displayVmsRef.current = lerpCinderlings(from, to, 1);
        activeTweenKeyRef.current = null;
        onComplete?.();
      }
    };
    app.ticker.add(ticker);
    return () => {
      // Guard: app may already be destroyed (e.g. component unmounted on win screen)
      if (appRef.current) {
        app.ticker.remove(ticker);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tween?.key]);

  useEffect(() => {
    const onResize = () => {
      appRef.current?.resize();
      draw();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
