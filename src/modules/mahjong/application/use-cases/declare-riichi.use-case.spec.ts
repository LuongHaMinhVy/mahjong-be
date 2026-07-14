import { jest } from '@jest/globals';
import { DeclareRiichiUseCase } from './declare-riichi.use-case.js';
import { GameState } from '../../domain/entities/game-state.entity.js';
import { Tile } from '../../domain/value-objects/tile.vo.js';
import { Meld } from '../../domain/value-objects/meld.vo.js';
import { DomainException } from '../../../../shared/exceptions/domain.exception.js';

describe('DeclareRiichiUseCase', () => {
  let useCase: DeclareRiichiUseCase;
  let mockGameStateRepository: any;

  beforeEach(() => {
    mockGameStateRepository = {
      findById: jest.fn(),
      save: jest.fn(),
    };
    useCase = new DeclareRiichiUseCase(mockGameStateRepository);
  });

  it('should throw NOT_FOUND if game does not exist', async () => {
    mockGameStateRepository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ gameId: 'g1', playerId: 'p1', tileId: 't1' }),
    ).rejects.toThrow(new DomainException('NOT_FOUND', 'Game not found.'));
  });

  it('should throw VALIDATION_ERROR if ruleset is not riichi', async () => {
    // 14 tiles
    const hand = [
      Tile.create('pin', 2, 'number', 'p2'),
      Tile.create('pin', 3, 'number', 'p3'),
      Tile.create('pin', 4, 'number', 'p4'),
      Tile.create('pin', 5, 'number', 'p5'),
      Tile.create('pin', 6, 'number', 'p6'),
      Tile.create('pin', 7, 'number', 'p7'),
      Tile.create('sou', 2, 'number', 's2'),
      Tile.create('sou', 3, 'number', 's3'),
      Tile.create('sou', 4, 'number', 's4'),
      Tile.create('man', 2, 'number', 'm2_1'),
      Tile.create('man', 2, 'number', 'm2_2'),
      Tile.create('man', 2, 'number', 'm2_3'),
      Tile.create('pin', 8, 'number', 'p8'),
      Tile.create('pin', 8, 'number', 'discard_tile'),
    ];

    const state = new GameState(
      'g1',
      'room1',
      'chinese',
      'playing',
      [],
      0,
      [
        {
          userId: 'p1',
          hand,
          melds: [],
          discards: [],
          score: 10000,
          isRiichi: false,
        },
      ],
    );

    mockGameStateRepository.findById.mockResolvedValue(state);

    await expect(
      useCase.execute({ gameId: 'g1', playerId: 'p1', tileId: 'discard_tile' }),
    ).rejects.toThrow(
      new DomainException('VALIDATION_ERROR', 'Riichi can only be declared in Riichi ruleset.'),
    );
  });

  it('should throw VALIDATION_ERROR if player has open melds', async () => {
    // 11 tiles in hand + 1 open meld (3 tiles) = 14 tiles
    const hand = [
      Tile.create('pin', 2, 'number', 'p2'),
      Tile.create('pin', 3, 'number', 'p3'),
      Tile.create('pin', 4, 'number', 'p4'),
      Tile.create('pin', 5, 'number', 'p5'),
      Tile.create('pin', 6, 'number', 'p6'),
      Tile.create('pin', 7, 'number', 'p7'),
      Tile.create('sou', 2, 'number', 's2'),
      Tile.create('sou', 3, 'number', 's3'),
      Tile.create('sou', 4, 'number', 's4'),
      Tile.create('pin', 8, 'number', 'p8'),
      Tile.create('pin', 8, 'number', 'discard_tile'),
    ];

    const openMeld = new Meld(
      'chi',
      [
        Tile.create('man', 2, 'number', 'm2'),
        Tile.create('man', 3, 'number', 'm3'),
        Tile.create('man', 4, 'number', 'm4'),
      ],
      false, // isConcealed = false means it is open
    );

    const state = new GameState(
      'g1',
      'room1',
      'riichi',
      'playing',
      [],
      0,
      [
        {
          userId: 'p1',
          hand,
          melds: [openMeld],
          discards: [],
          score: 25000,
          isRiichi: false,
        },
      ],
    );

    mockGameStateRepository.findById.mockResolvedValue(state);

    await expect(
      useCase.execute({ gameId: 'g1', playerId: 'p1', tileId: 'discard_tile' }),
    ).rejects.toThrow(
      new DomainException('VALIDATION_ERROR', 'Cannot declare Riichi with an open hand.'),
    );
  });

  it('should throw VALIDATION_ERROR if player score < 1000', async () => {
    const hand = [
      Tile.create('pin', 2, 'number', 'p2'),
      Tile.create('pin', 3, 'number', 'p3'),
      Tile.create('pin', 4, 'number', 'p4'),
      Tile.create('pin', 5, 'number', 'p5'),
      Tile.create('pin', 6, 'number', 'p6'),
      Tile.create('pin', 7, 'number', 'p7'),
      Tile.create('sou', 2, 'number', 's2'),
      Tile.create('sou', 3, 'number', 's3'),
      Tile.create('sou', 4, 'number', 's4'),
      Tile.create('man', 2, 'number', 'm2_1'),
      Tile.create('man', 2, 'number', 'm2_2'),
      Tile.create('man', 2, 'number', 'm2_3'),
      Tile.create('pin', 8, 'number', 'p8'),
      Tile.create('pin', 8, 'number', 'discard_tile'),
    ];

    const state = new GameState(
      'g1',
      'room1',
      'riichi',
      'playing',
      [],
      0,
      [
        {
          userId: 'p1',
          hand,
          melds: [],
          discards: [],
          score: 500,
          isRiichi: false,
        },
      ],
    );

    mockGameStateRepository.findById.mockResolvedValue(state);

    await expect(
      useCase.execute({ gameId: 'g1', playerId: 'p1', tileId: 'discard_tile' }),
    ).rejects.toThrow(
      new DomainException('VALIDATION_ERROR', 'Not enough points to declare Riichi.'),
    );
  });

  it('should declare Riichi, deduct 1000 points, discard tile, and record actions when all conditions met', async () => {
    const hand = [
      Tile.create('pin', 2, 'number', 'p2'),
      Tile.create('pin', 3, 'number', 'p3'),
      Tile.create('pin', 4, 'number', 'p4'),
      Tile.create('pin', 5, 'number', 'p5'),
      Tile.create('pin', 6, 'number', 'p6'),
      Tile.create('pin', 7, 'number', 'p7'),
      Tile.create('sou', 2, 'number', 's2'),
      Tile.create('sou', 3, 'number', 's3'),
      Tile.create('sou', 4, 'number', 's4'),
      Tile.create('man', 2, 'number', 'm2_1'),
      Tile.create('man', 2, 'number', 'm2_2'),
      Tile.create('man', 2, 'number', 'm2_3'),
      Tile.create('pin', 8, 'number', 'p8'),
      Tile.create('pin', 8, 'number', 'discard_tile'),
    ];

    // Dummy players to satisfy 4-player engine checks
    const players = [
      {
        userId: 'p1',
        hand,
        melds: [],
        discards: [],
        score: 25000,
        isRiichi: false,
      },
      {
        userId: 'p2',
        hand: [],
        melds: [],
        discards: [],
        score: 25000,
        isRiichi: false,
      },
      {
        userId: 'p3',
        hand: [],
        melds: [],
        discards: [],
        score: 25000,
        isRiichi: false,
      },
      {
        userId: 'p4',
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

    mockGameStateRepository.findById.mockResolvedValue(state);

    await useCase.execute({ gameId: 'g1', playerId: 'p1', tileId: 'discard_tile' });

    expect(players[0].score).toBe(24000);
    expect(players[0].isRiichi).toBe(true);
    expect(players[0].hand.some(t => t.id === 'discard_tile')).toBe(false);
    
    // Actions verification: index 0 = riichi, index 1 = discard
    expect(state.actions).toHaveLength(2);
    expect(state.actions[0].type).toBe('riichi');
    expect(state.actions[1].type).toBe('discard');

    expect(mockGameStateRepository.save).toHaveBeenCalledWith(state);
  });
});
