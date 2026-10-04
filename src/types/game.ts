import {
  BATTERY_SPACE_ID,
  BLANK_SPACE_ID,
  QUEUE_SPACE_ID,
  VOID_SPACE_ID,
} from "../enums/spaces";

export interface CinderlingStats {
  speed: number;
  health: number;
  attack: number;
  energy: number;
  name: string;
  uuid: string;
  attacks: Attack[];
  /** Short flavor text */
  flavor?: string;
  /** Avatar image URL */
  imageUrl?: string;
  /** Special power ID — references the power registry */
  specialPowerId?: string;
}

export interface Attack {
  /** References the canonical key in ATTACK_TEMPLATES */
  key: string;
  name: string;
  damage: number;
  energyCost: number;
  range: number;
}

type SpaceBase = { x: number; y: number };
export type VoidSpace = SpaceBase & { type: typeof VOID_SPACE_ID };
export type BlankSpace = SpaceBase & { type: typeof BLANK_SPACE_ID };
export type BatterySpace = SpaceBase & {
  type: typeof BATTERY_SPACE_ID;
  isPrimary: boolean;
};
export type QueueSpace = SpaceBase & {
  type: typeof QUEUE_SPACE_ID;
  isPrimary: boolean;
  index: number;
};
export type Space = QueueSpace | BatterySpace | BlankSpace | VoidSpace;

export interface Board {
  width: number;
  height: number;
  spaces: Space[];
  primaryDock: Set<number>;
  secondaryDock: Set<number>;
  id: string;
}
