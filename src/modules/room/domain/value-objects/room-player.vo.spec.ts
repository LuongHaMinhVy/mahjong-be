import { RoomPlayer } from './room-player.vo.js';

describe('RoomPlayer', () => {
  it('should create a room player correctly', () => {
    const player = new RoomPlayer('user-1', 'Vy', 'avatar.png', 1000, false);
    expect(player.userId).toBe('user-1');
    expect(player.displayName).toBe('Vy');
    expect(player.avatar).toBe('avatar.png');
    expect(player.elo).toBe(1000);
    expect(player.isReady).toBe(false);
  });
});
