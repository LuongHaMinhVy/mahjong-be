import { jest } from '@jest/globals';
import { MatchmakingProcessor } from './matchmaking-processor.service.js';
import { type IMatchmakingRepository } from '../../domain/repositories/matchmaking.repository.js';
import { MatchmakingQueueEntry } from '../../domain/value-objects/queue-entry.vo.js';

describe('MatchmakingProcessor', () => {
  let processor: MatchmakingProcessor;
  let mockMatchmakingRepo: jest.Mocked<IMatchmakingRepository>;
  let mockLobbyGateway: any;

  beforeEach(() => {
    mockMatchmakingRepo = {
      getQueue: jest.fn(),
      removeFromQueue: jest.fn(),
      createTicket: jest.fn(),
    } as any;
    mockLobbyGateway = {
      broadcastMatchFound: jest.fn(),
    };
    processor = new MatchmakingProcessor(mockMatchmakingRepo, mockLobbyGateway);
  });

  it('should not match if fewer than 4 players', async () => {
    mockMatchmakingRepo.getQueue.mockResolvedValue([
      new MatchmakingQueueEntry('1', 1000, new Date()),
    ]);

    await processor.matchQueue('riichi');

    expect(mockMatchmakingRepo.createTicket).not.toHaveBeenCalled();
  });

  it('should match 4 players within overlapping ELO ranges', async () => {
    const baseTime = new Date();
    mockMatchmakingRepo.getQueue.mockResolvedValue([
      new MatchmakingQueueEntry('u1', 1000, baseTime),
      new MatchmakingQueueEntry('u2', 1020, baseTime),
      new MatchmakingQueueEntry('u3', 980, baseTime),
      new MatchmakingQueueEntry('u4', 1010, baseTime),
    ]);

    await processor.matchQueue('riichi');

    expect(mockMatchmakingRepo.createTicket).toHaveBeenCalled();
    expect(mockLobbyGateway.broadcastMatchFound).toHaveBeenCalled();
  });
});
