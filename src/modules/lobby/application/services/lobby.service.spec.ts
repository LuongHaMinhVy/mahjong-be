import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { LobbyService } from './lobby.service.js';

import { IRoomRepository } from '../../../room/domain/repositories/room.repository.js';

describe('LobbyService', () => {
  let service: LobbyService;
  let mockRedis: {
    sadd: jest.Mock;
    srem: jest.Mock;
    sismember: jest.Mock;
    scard: jest.Mock;
  };
  let mockRoomRepository: {
    findAllWaiting: jest.Mock;
  };

  beforeEach(async () => {
    mockRedis = {
      sadd: jest.fn(),
      srem: jest.fn(),
      sismember: jest.fn(),
      scard: jest.fn(),
    };
    mockRoomRepository = {
      findAllWaiting: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LobbyService,
        { provide: 'REDIS', useValue: mockRedis },
        { provide: IRoomRepository, useValue: mockRoomRepository },
      ],
    }).compile();

    service = module.get<LobbyService>(LobbyService);
  });

  it('should mark user online', async () => {
    await service.setUserOnline('user-1');
    expect(mockRedis.sadd).toHaveBeenCalledWith('mahjong:online', 'user-1');
  });

  it('should mark user offline', async () => {
    await service.setUserOffline('user-1');
    expect(mockRedis.srem).toHaveBeenCalledWith('mahjong:online', 'user-1');
  });

  it('should check if user is online', async () => {
    mockRedis.sismember.mockResolvedValue(1);
    const isOnline = await service.isUserOnline('user-1');
    expect(isOnline).toBe(true);
    expect(mockRedis.sismember).toHaveBeenCalledWith('mahjong:online', 'user-1');
  });

  it('should get online count', async () => {
    mockRedis.scard.mockResolvedValue(5);
    const count = await service.getOnlineCount();
    expect(count).toBe(5);
    expect(mockRedis.scard).toHaveBeenCalledWith('mahjong:online');
  });

  it('should filter rooms by ruleset', async () => {
    const mockRooms = [
      { id: 'room-1', name: 'R1', ruleset: 'riichi', status: 'waiting' },
      { id: 'room-2', name: 'R2', ruleset: 'chinese', status: 'waiting' },
    ];
    mockRoomRepository.findAllWaiting.mockResolvedValue(mockRooms);

    const riichiRooms = await service.getRoomsByRuleset('riichi');
    expect(riichiRooms).toHaveLength(1);
    expect(riichiRooms[0].id).toBe('room-1');
    expect(mockRoomRepository.findAllWaiting).toHaveBeenCalled();
  });
});
