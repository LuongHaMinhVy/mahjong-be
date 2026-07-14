import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { LobbyGateway } from './lobby.gateway.js';
import { LobbyService } from '../../application/services/lobby.service.js';
import { JwtTokenService } from '../../../auth/infrastructure/token/jwt-token.service.js';

describe('LobbyGateway', () => {
  let gateway: LobbyGateway;
  let mockLobbyService: {
    setUserOnline: jest.Mock;
    setUserOffline: jest.Mock;
    getRoomsByRuleset: jest.Mock;
  };
  let mockJwtTokenService: {
    verifyAccessToken: jest.Mock;
  };
  let mockSocket: any;
  let mockServer: any;

  beforeEach(async () => {
    mockLobbyService = {
      setUserOnline: jest.fn(),
      setUserOffline: jest.fn(),
      getRoomsByRuleset: jest.fn(),
    };

    mockJwtTokenService = {
      verifyAccessToken: jest.fn(),
    };

    mockSocket = {
      id: 'socket-1',
      user: { sub: 'user-1' },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      handshake: {
        auth: { token: 'valid-token' },
      },
    };

    mockServer = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LobbyGateway,
        { provide: LobbyService, useValue: mockLobbyService },
        { provide: JwtTokenService, useValue: mockJwtTokenService },
      ],
    }).compile();

    gateway = module.get<LobbyGateway>(LobbyGateway);
    gateway.server = mockServer;
  });

  describe('handleConnection / handleDisconnect', () => {
    it('should set user online on valid connection', async () => {
      mockJwtTokenService.verifyAccessToken.mockResolvedValue({ sub: 'user-1' } as any);
      await gateway.handleConnection(mockSocket);
      expect(mockLobbyService.setUserOnline).toHaveBeenCalledWith('user-1');
    });

    it('should disconnect if token is missing', async () => {
      mockSocket.handshake.auth = {};
      await gateway.handleConnection(mockSocket);
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should set user offline on disconnect', async () => {
      await gateway.handleDisconnect(mockSocket);
      expect(mockLobbyService.setUserOffline).toHaveBeenCalledWith('user-1');
    });
  });

  describe('lobby:subscribe', () => {
    it('should join user to ruleset room and emit rooms list', async () => {
      const mockRooms = [
        { id: '1', name: 'R1', hostId: 'h1', ruleset: 'riichi', status: 'waiting', players: [] },
      ];
      mockLobbyService.getRoomsByRuleset.mockResolvedValue(mockRooms);

      await gateway.handleSubscribe(mockSocket, { ruleset: 'riichi' });

      expect(mockSocket.join).toHaveBeenCalledWith('lobby:ruleset:riichi');
      expect(mockSocket.emit).toHaveBeenCalledWith('lobby:rooms', expect.any(Array));
    });
  });

  describe('lobby:unsubscribe', () => {
    it('should remove user from ruleset room', async () => {
      await gateway.handleUnsubscribe(mockSocket, { ruleset: 'riichi' });
      expect(mockSocket.leave).toHaveBeenCalledWith('lobby:ruleset:riichi');
    });
  });

  describe('broadcastRooms', () => {
    it('should emit rooms to all users in the ruleset room', async () => {
      const mockRooms = [];
      mockLobbyService.getRoomsByRuleset.mockResolvedValue(mockRooms);

      await gateway.broadcastRooms('riichi');

      expect(mockServer.to).toHaveBeenCalledWith('lobby:ruleset:riichi');
    });
  });
});
