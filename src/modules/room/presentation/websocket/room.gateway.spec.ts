import { jest } from '@jest/globals';
import { RoomGateway } from './room.gateway.js';
import { type CreateRoomUseCase } from '../../application/use-cases/create-room.use-case.js';
import { type JoinRoomUseCase } from '../../application/use-cases/join-room.use-case.js';
import { type LeaveRoomUseCase } from '../../application/use-cases/leave-room.use-case.js';
import { type ToggleReadyUseCase } from '../../application/use-cases/toggle-ready.use-case.js';
import { type StartGameUseCase } from '../../application/use-cases/start-game.use-case.js';
import { type LobbyService } from '../../application/services/lobby.service.js';
import { Room } from '../../domain/entities/room.entity.js';
import { RoomPlayer } from '../../domain/value-objects/room-player.vo.js';
import { type IRoomRepository } from '../../domain/repositories/room.repository.js';

describe('RoomGateway', () => {
  let gateway: RoomGateway;
  let mockLobbyService: jest.Mocked<LobbyService>;
  let mockCreateRoomUseCase: jest.Mocked<CreateRoomUseCase>;
  let mockJoinRoomUseCase: jest.Mocked<JoinRoomUseCase>;
  let mockLeaveRoomUseCase: jest.Mocked<LeaveRoomUseCase>;
  let mockToggleReadyUseCase: jest.Mocked<ToggleReadyUseCase>;
  let mockStartGameUseCase: jest.Mocked<StartGameUseCase>;
  let mockRoomRepository: jest.Mocked<IRoomRepository>;

  let mockSocket: any;
  let mockServer: any;

  beforeEach(() => {
    mockLobbyService = {
      setUserOnline: jest.fn(),
      setUserOffline: jest.fn(),
      joinQueue: jest.fn(),
      leaveQueue: jest.fn(),
    } as any;

    mockCreateRoomUseCase = { execute: jest.fn() } as any;
    mockJoinRoomUseCase = { execute: jest.fn() } as any;
    mockLeaveRoomUseCase = { execute: jest.fn() } as any;
    mockToggleReadyUseCase = { execute: jest.fn() } as any;
    mockStartGameUseCase = { execute: jest.fn() } as any;
    mockRoomRepository = {
      findById: jest.fn(),
    } as any;

    mockSocket = {
      id: 'socket-1',
      user: { sub: 'user-1' },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
    };

    mockServer = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    };

    gateway = new RoomGateway(
      mockLobbyService,
      mockCreateRoomUseCase,
      mockJoinRoomUseCase,
      mockLeaveRoomUseCase,
      mockToggleReadyUseCase,
      mockStartGameUseCase,
      mockRoomRepository,
    );
    gateway.server = mockServer;
  });

  describe('handleConnection / handleDisconnect', () => {
    it('should log connection and disconnect events', () => {
      gateway.handleConnection(mockSocket);
      gateway.handleDisconnect(mockSocket);
    });
  });

  describe('room:create', () => {
    it('should create room and join user to it', async () => {
      const room = new Room('r-1', 'My Room', 'user-1', 'riichi', 'waiting', [
        new RoomPlayer('user-1', 'Vy', null, 1000, false),
      ]);
      mockCreateRoomUseCase.execute.mockResolvedValue(room);

      await gateway.handleCreateRoom(mockSocket, {
        name: 'My Room',
        ruleset: 'riichi',
      });

      expect(mockCreateRoomUseCase.execute).toHaveBeenCalledWith({
        hostId: 'user-1',
        name: 'My Room',
        ruleset: 'riichi',
      });
      expect(mockSocket.join).toHaveBeenCalledWith('r-1');
      expect(mockServer.to).toHaveBeenCalledWith('r-1');
    });

    it('should emit error when room creation fails', async () => {
      mockCreateRoomUseCase.execute.mockRejectedValue(
        new Error('Failed to create'),
      );

      await gateway.handleCreateRoom(mockSocket, {
        name: 'My Room',
        ruleset: 'riichi',
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('error', 'Failed to create');
    });
  });

  describe('room:join', () => {
    it('should join user to room', async () => {
      const room = new Room('r-1', 'My Room', 'user-2', 'riichi', 'waiting', [
        new RoomPlayer('user-2', 'Host', null, 1000, false),
        new RoomPlayer('user-1', 'Vy', null, 1000, false),
      ]);
      mockJoinRoomUseCase.execute.mockResolvedValue(room);

      await gateway.handleJoinRoom(mockSocket, { roomId: 'r-1' });

      expect(mockJoinRoomUseCase.execute).toHaveBeenCalledWith({
        userId: 'user-1',
        roomId: 'r-1',
      });
      expect(mockSocket.join).toHaveBeenCalledWith('r-1');
      expect(mockServer.to).toHaveBeenCalledWith('r-1');
    });
  });

  describe('lobby:join_queue', () => {
    it('should handle joining queue and broadcast match_found if match starts', async () => {
      const room = new Room(
        'r-123',
        'Matchmaking Room',
        'user-1',
        'riichi',
        'waiting',
        [
          new RoomPlayer('user-1', 'Host', null, 1000, false),
          new RoomPlayer('user-2', 'P2', null, 1000, false),
          new RoomPlayer('user-3', 'P3', null, 1000, false),
          new RoomPlayer('user-4', 'P4', null, 1000, false),
        ],
      );
      mockLobbyService.joinQueue.mockResolvedValue(room);

      await gateway.handleJoinQueue(mockSocket);

      expect(mockLobbyService.joinQueue).toHaveBeenCalledWith('user-1');
      expect(mockServer.to).toHaveBeenCalledWith('r-123');
    });
  });
});
