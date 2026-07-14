import { jest } from '@jest/globals';
import { RespondToMatchUseCase } from './respond-to-match.use-case.js';
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { MatchTicket } from '../../domain/entities/match-ticket.entity.js';

describe('RespondToMatchUseCase', () => {
  let useCase: RespondToMatchUseCase;
  let mockMatchmakingRepo: jest.Mocked<IMatchmakingRepository>;
  let mockCreateRoomUseCase: any;
  let mockJoinRoomUseCase: any;
  let mockToggleReadyUseCase: any;
  let mockStartGameUseCase: any;

  beforeEach(() => {
    mockMatchmakingRepo = {
      getTicket: jest.fn(),
      saveTicket: jest.fn(),
      deleteTicket: jest.fn(),
      addToQueue: jest.fn(),
      getJoinedAt: jest.fn(),
    } as any;

    mockCreateRoomUseCase = { execute: jest.fn() };
    mockJoinRoomUseCase = { execute: jest.fn() };
    mockToggleReadyUseCase = { execute: jest.fn() };
    mockStartGameUseCase = { execute: jest.fn() };

    useCase = new RespondToMatchUseCase(
      mockMatchmakingRepo,
      mockCreateRoomUseCase,
      mockJoinRoomUseCase,
      mockToggleReadyUseCase,
      mockStartGameUseCase,
    );
  });

  it('should decline match and requeue other players', async () => {
    const ticket = new MatchTicket(
      't1',
      'riichi',
      ['u1', 'u2', 'u3', 'u4'],
      ['u1'],
      new Date(),
    );
    mockMatchmakingRepo.getTicket.mockResolvedValue(ticket);
    mockMatchmakingRepo.getJoinedAt.mockResolvedValue(
      new Date('2026-07-14T00:00:00Z'),
    );

    const result = await useCase.execute({
      userId: 'u2',
      ticketId: 't1',
      accept: false,
    });

    expect(result.status).toBe('cancelled');
    expect(mockMatchmakingRepo.deleteTicket).toHaveBeenCalledWith('t1');
    expect(mockMatchmakingRepo.addToQueue).toHaveBeenCalledTimes(3); // Requeue u1, u3, u4 (since u2 declined)
  });

  it('should accept and save updated ticket if not fully accepted yet', async () => {
    const ticket = new MatchTicket(
      't1',
      'riichi',
      ['u1', 'u2', 'u3', 'u4'],
      ['u1'],
      new Date(),
    );
    mockMatchmakingRepo.getTicket.mockResolvedValue(ticket);

    const result = await useCase.execute({
      userId: 'u2',
      ticketId: 't1',
      accept: true,
    });

    expect(result.status).toBe('accepted');
    expect(mockMatchmakingRepo.saveTicket).toHaveBeenCalled();
  });

  it('should delete ticket, create room, toggle ready and start game if fully accepted', async () => {
    const ticket = new MatchTicket(
      't1',
      'riichi',
      ['u1', 'u2', 'u3', 'u4'],
      ['u1', 'u2', 'u3'],
      new Date(),
    );
    mockMatchmakingRepo.getTicket.mockResolvedValue(ticket);
    mockCreateRoomUseCase.execute.mockResolvedValue({ id: 'room-1' });

    const result = await useCase.execute({
      userId: 'u4',
      ticketId: 't1',
      accept: true,
    });

    expect(result.status).toBe('completed');
    expect(result.roomId).toBe('room-1');
    expect(mockMatchmakingRepo.deleteTicket).toHaveBeenCalledWith('t1');
    expect(mockCreateRoomUseCase.execute).toHaveBeenCalled();
    expect(mockJoinRoomUseCase.execute).toHaveBeenCalledTimes(3);
    expect(mockToggleReadyUseCase.execute).toHaveBeenCalledTimes(3);
    expect(mockStartGameUseCase.execute).toHaveBeenCalled();
  });
});
