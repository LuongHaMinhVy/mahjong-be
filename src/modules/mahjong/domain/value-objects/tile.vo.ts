export type TileSuit = 'man' | 'pin' | 'sou' | 'honor' | 'flower';
export type TileType = 'number' | 'wind' | 'dragon' | 'flower' | 'season';

export class Tile {
  private constructor(
    readonly suit: TileSuit,
    readonly value: number,
    readonly type: TileType,
    readonly id: string,
  ) {}

  static create(
    suit: TileSuit,
    value: number,
    type: TileType,
    id: string,
  ): Tile {
    return new Tile(suit, value, type, id);
  }

  equals(other: Tile): boolean {
    return this.suit === other.suit && this.value === other.value;
  }
}
