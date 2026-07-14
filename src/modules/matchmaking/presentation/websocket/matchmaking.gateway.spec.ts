import { jest } from '@jest/globals';
import { MatchmakingGateway } from './matchmaking.gateway.js';

describe('MatchmakingGateway', () => {
  let gateway: MatchmakingGateway;
  let mockJoinUseCase: any;
  let mockLeaveUseCase: any;
  let mockRespondUseCase: any;
  let mockServer: any;

  beforeEach(() => {
    mockJoinUseCase = { execute: jest.fn() };
    mockLeaveUseCase = { execute: jest.fn() };
    mockRespondUseCase = { execute: jest.fn() };
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    gateway = new MatchmakingGateway(mockJoinUseCase, mockLeaveUseCase, mockRespondUseCase);
    gateway.server = mockServer;
  });

  it('should define gateway actions', () => {
    expect(gateway).toBeDefined();
  });
});
