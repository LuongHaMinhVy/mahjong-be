import { Tile } from './tile.vo.js';

describe('Tile Value Object', () => {
  it('should create a valid tile and verify equality', () => {
    const tile1 = Tile.create('man', 1, 'number', 'man-1-a');
    const tile2 = Tile.create('man', 1, 'number', 'man-1-b');
    const tile3 = Tile.create('pin', 1, 'number', 'pin-1-a');

    expect(tile1.equals(tile2)).toBe(true);
    expect(tile1.equals(tile3)).toBe(false);
    expect(tile1.suit).toBe('man');
    expect(tile1.value).toBe(1);
    expect(tile1.type).toBe('number');
    expect(tile1.id).toBe('man-1-a');
  });
});
