/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
import { jest } from '@jest/globals';
import { StartGameUseCase } from './start-game.use-case.js';
import { DrawTileUseCase } from './draw-tile.use-case.js';
import { DiscardTileUseCase } from './discard-tile.use-case.js';
import { ClaimMeldUseCase } from './claim-meld.use-case.js';
import { DeclareWinUseCase } from './declare-win.use-case.js';
import { type IGameStateRepository } from '../../domain/repositories/game-state.repository.js';
import { type IGameResultRepository } from '../../domain/repositories/game-result.repository.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { GameState } from '../../domain/entities/game-state.entity.js';
import { Tile } from '../../domain/value-objects/tile.vo.js';
import { Meld } from '../../domain/value-objects/meld.vo.js';
import { User } from '../../../auth/domain/user.entity.js';
import { Email } from '../../../auth/domain/value-objects/email.vo.js';
import { Password } from '../../../auth/domain/value-objects/password.vo.js';

describe('Mahjong Use Cases', () => {
  let mockGameStateRepo: jest.Mocked<IGameStateRepository>;
  let mockGameResultRepo: jest.Mocked<IGameResultRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;

  let startGameUseCase: StartGameUseCase;
  let drawTileUseCase: DrawTileUseCase;
  let discardTileUseCase: DiscardTileUseCase;
  let claimMeldUseCase: ClaimMeldUseCase;
  let declareWinUseCase: DeclareWinUseCase;

  beforeEach(() => {
    mockGameStateRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    mockGameResultRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findByPlayerId: jest.fn(),
    };

    mockUserRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
    };

    startGameUseCase = new StartGameUseCase(mockGameStateRepo);
    drawTileUseCase = new DrawTileUseCase(mockGameStateRepo);
    discardTileUseCase = new DiscardTileUseCase(mockGameStateRepo);
    claimMeldUseCase = new ClaimMeldUseCase(mockGameStateRepo);
    declareWinUseCase = new DeclareWinUseCase(
      mockGameStateRepo,
      mockGameResultRepo,
      mockUserRepo,
    );
  });

  describe('StartGameUseCase', () => {
    it('should initialize and save a new game state', async () => {
      const playerIds = ['u1', 'u2', 'u3', 'u4'];
      const state = await startGameUseCase.execute({
        roomId: 'room1',
        playerIds,
        rulesetName: 'riichi',
      });

      expect(state).toBeInstanceOf(GameState);
      expect(state.players).toHaveLength(4);
      expect(state.rulesetName).toBe('riichi');
      expect(mockGameStateRepo.save).toHaveBeenCalledWith(state);
    });

    it('should fail if there are not exactly 4 players', async () => {
      await expect(
        startGameUseCase.execute({
          roomId: 'room1',
          playerIds: ['u1', 'u2'],
          rulesetName: 'riichi',
        }),
      ).rejects.toThrow('Mahjong requires exactly 4 players.');
    });
  });

  describe('DrawTileUseCase', () => {
    it('should draw a tile for active player and save state', async () => {
      const wall = [Tile.create('man', 1, 'number', 't1')];
      const players = [
        {
          userId: 'u1',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
        {
          userId: 'u2',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
        {
          userId: 'u3',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
        {
          userId: 'u4',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
      ];
      const state = new GameState(
        'g1',
        'room1',
        'riichi',
        'playing',
        wall,
        0,
        players,
      );
      mockGameStateRepo.findById.mockResolvedValue(state);

      const drawnTile = await drawTileUseCase.execute({ gameId: 'g1' });

      expect(drawnTile).toEqual(Tile.create('man', 1, 'number', 't1'));
      expect(state.players[0].hand).toHaveLength(1);
      expect(mockGameStateRepo.save).toHaveBeenCalledWith(state);
    });
  });

  describe('DiscardTileUseCase', () => {
    it('should discard a tile for current player and advance turn', async () => {
      const tile = Tile.create('man', 1, 'number', 't1');
      const players = [
        {
          userId: 'u1',
          hand: [tile],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
        {
          userId: 'u2',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
        {
          userId: 'u3',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
        {
          userId: 'u4',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
      ];
      const state = new GameState(
        'g1',
        'room1',
        'riichi',
        'playing',
        [],
        0,
        players,
      );
      mockGameStateRepo.findById.mockResolvedValue(state);

      await discardTileUseCase.execute({
        gameId: 'g1',
        playerId: 'u1',
        tileId: 't1',
      });

      expect(state.players[0].hand).toHaveLength(0);
      expect(state.players[0].discards).toHaveLength(1);
      expect(state.currentTurn).toBe(1);
      expect(mockGameStateRepo.save).toHaveBeenCalledWith(state);
    });
  });

  describe('ClaimMeldUseCase', () => {
    it('should claim a meld and update current turn to claimer', async () => {
      const handTile1 = Tile.create('man', 2, 'number', 'h1');
      const handTile2 = Tile.create('man', 3, 'number', 'h2');
      const claimedTile = Tile.create('man', 1, 'number', 'c1');

      const players = [
        {
          userId: 'u1',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
        {
          userId: 'u2',
          hand: [handTile1, handTile2],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
        {
          userId: 'u3',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
        {
          userId: 'u4',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
      ];
      const state = new GameState(
        'g1',
        'room1',
        'riichi',
        'playing',
        [],
        0,
        players,
      );
      mockGameStateRepo.findById.mockResolvedValue(state);

      await claimMeldUseCase.execute({
        gameId: 'g1',
        playerId: 'u2',
        meldType: 'chi',
        claimedTile,
        handTilesToUse: [handTile1, handTile2],
      });

      expect(state.players[1].melds).toHaveLength(1);
      expect(state.players[1].melds[0]).toBeInstanceOf(Meld);
      expect(state.currentTurn).toBe(1);
      expect(mockGameStateRepo.save).toHaveBeenCalledWith(state);
    });
  });

  describe('DeclareWinUseCase', () => {
    it('should declare win, calculate score, update ELOs, delete game, and save result', async () => {
      // 14 tiles standard shape (Tanyao)
      const hand = [
        Tile.create('man', 2, 'number', '1'),
        Tile.create('man', 3, 'number', '2'),
        Tile.create('man', 4, 'number', '3'),
        Tile.create('man', 5, 'number', '4'),
        Tile.create('man', 6, 'number', '5'),
        Tile.create('man', 7, 'number', '6'),
        Tile.create('pin', 3, 'number', '7'),
        Tile.create('pin', 4, 'number', '8'),
        Tile.create('pin', 5, 'number', '9'),
        Tile.create('sou', 6, 'number', '10'),
        Tile.create('sou', 7, 'number', '11'),
        Tile.create('sou', 8, 'number', '12'),
        Tile.create('pin', 8, 'number', '13'),
        Tile.create('pin', 8, 'number', '14'),
      ];

      const players = [
        {
          userId: 'u1',
          hand,
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
        {
          userId: 'u2',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
        {
          userId: 'u3',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
        {
          userId: 'u4',
          hand: [],
          melds: [],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
      ];

      const state = new GameState(
        'g1',
        'room1',
        'riichi',
        'playing',
        [],
        0,
        players,
      );
      mockGameStateRepo.findById.mockResolvedValue(state);

      const u1 = new User({
        email: new Email('u1@test.com'),
        displayName: 'U1',
        password: Password.fromHash('mockhash'),
        elo: 1000,
        id: 'u1',
      });
      const u2 = new User({
        email: new Email('u2@test.com'),
        displayName: 'U2',
        password: Password.fromHash('mockhash'),
        elo: 1000,
        id: 'u2',
      });
      const u3 = new User({
        email: new Email('u3@test.com'),
        displayName: 'U3',
        password: Password.fromHash('mockhash'),
        elo: 1000,
        id: 'u3',
      });
      const u4 = new User({
        email: new Email('u4@test.com'),
        displayName: 'U4',
        password: Password.fromHash('mockhash'),
        elo: 1000,
        id: 'u4',
      });

      mockUserRepo.findById.mockImplementation((id: string) => {
        if (id === 'u1') return Promise.resolve(u1);
        if (id === 'u2') return Promise.resolve(u2);
        if (id === 'u3') return Promise.resolve(u3);
        if (id === 'u4') return Promise.resolve(u4);
        return Promise.resolve(null);
      });

      mockUserRepo.save.mockImplementation((user: User) =>
        Promise.resolve(user),
      );

      const result = await declareWinUseCase.execute({
        gameId: 'g1',
        playerId: 'u1',
        isSelfDraw: true,
      });

      expect(result).not.toBeNull();
      expect(result.winnerId).toBe('u1');
      expect(state.phase).toBe('finished');
      expect(mockGameResultRepo.save).toHaveBeenCalled();
      expect(mockGameStateRepo.delete).toHaveBeenCalledWith('g1');

      // ELO updates should have been processed
      expect(mockUserRepo.save).toHaveBeenCalledTimes(4);
      expect(u1.elo).toBeGreaterThan(1000);
      expect(u2.elo).toBeLessThan(1000);
    });
  });
});
