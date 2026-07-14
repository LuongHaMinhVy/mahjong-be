import { Room } from './room.entity.js';
import { RoomPlayer } from '../value-objects/room-player.vo.js';

describe('Room Entity', () => {
  it('should support adding and removing players', () => {
    const room = new Room('r-1', 'My Room', 'user-1', 'riichi', 'waiting', [
      new RoomPlayer('user-1', 'Vy', null, 1000, false)
    ]);

    const player2 = new RoomPlayer('user-2', 'Player 2', null, 1000, false);
    room.addPlayer(player2);
    expect(room.players.length).toBe(2);

    room.removePlayer('user-2');
    expect(room.players.length).toBe(1);
  });

  it('should assign a new host if host leaves', () => {
    const room = new Room('r-1', 'My Room', 'user-1', 'riichi', 'waiting', [
      new RoomPlayer('user-1', 'Vy', null, 1000, false),
      new RoomPlayer('user-2', 'Player 2', null, 1000, false)
    ]);

    room.removePlayer('user-1');
    expect(room.hostId).toBe('user-2');
  });

  it('should only start when all players except host are ready and there are 4 players', () => {
    const players = [
      new RoomPlayer('u1', 'P1', null, 1000, false),
      new RoomPlayer('u2', 'P2', null, 1000, true),
      new RoomPlayer('u3', 'P3', null, 1000, true),
      new RoomPlayer('u4', 'P4', null, 1000, true)
    ];
    const room = new Room('r-1', 'My Room', 'u1', 'riichi', 'waiting', players);
    expect(room.canStart()).toBe(true);

    room.toggleReady('u2', false);
    expect(room.canStart()).toBe(false);
  });
});
