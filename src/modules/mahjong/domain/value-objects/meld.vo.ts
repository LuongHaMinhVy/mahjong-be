import type { Tile } from './tile.vo.js';

export type MeldType = 'chi' | 'pon' | 'kan' | 'closed-kan';

export class Meld {
  constructor(
    readonly type: MeldType,
    readonly tiles: Tile[],
    readonly isConcealed: boolean,
  ) {}
}
