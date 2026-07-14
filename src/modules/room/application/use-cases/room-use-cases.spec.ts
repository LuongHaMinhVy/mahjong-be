import { CreateRoomUseCase } from './create-room.use-case.js';
import { JoinRoomUseCase } from './join-room.use-case.js';
import { LeaveRoomUseCase } from './leave-room.use-case.js';
import { ToggleReadyUseCase } from './toggle-ready.use-case.js';
import { StartGameUseCase } from './start-game.use-case.js';
import { type Room } from '../../domain/entities/room.entity.js';
import { RoomPlayer } from '../../domain/value-objects/room-player.vo.js';
import { type IRoomRepository } from '../../domain/repositories/room.repository.js';
import { type IUserRepository } from '../../../auth/domain/user.repository.js';
import { User } from '../../../auth/domain/user.entity.js';
import { Email } from '../../../auth/domain/value-objects/email.vo.js';
import { Password } from '../../../auth/domain/value-objects/password.vo.js';

class MockRoomRepository implements IRoomRepository {
  public rooms = new Map<string, Room>();

  async save(room: Room): Promise<void> {
    this.rooms.set(room.id, room);
  }

  async findById(id: string): Promise<Room | null> {
    return this.rooms.get(id) || null;
  }

  async delete(id: string): Promise<void> {
    this.rooms.delete(id);
  }

  async findAllWaiting(): Promise<Room[]> {
    return Array.from(this.rooms.values()).filter(
      (r) => r.status === 'waiting',
    );
  }
}

class MockUserRepository implements IUserRepository {
  public users = new Map<string, User>();

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return null;
  }
}

describe('Room Use Cases', () => {
  let roomRepo: MockRoomRepository;
  let userRepo: MockUserRepository;

  let createRoomUseCase: CreateRoomUseCase;
  let joinRoomUseCase: JoinRoomUseCase;
  let leaveRoomUseCase: LeaveRoomUseCase;
  let toggleReadyUseCase: ToggleReadyUseCase;
  let startGameUseCase: StartGameUseCase;

  beforeEach(() => {
    roomRepo = new MockRoomRepository();
    userRepo = new MockUserRepository();

    createRoomUseCase = new CreateRoomUseCase(roomRepo, userRepo);
    joinRoomUseCase = new JoinRoomUseCase(roomRepo, userRepo);
    leaveRoomUseCase = new LeaveRoomUseCase(roomRepo);
    toggleReadyUseCase = new ToggleReadyUseCase(roomRepo);
    startGameUseCase = new StartGameUseCase(roomRepo);

    // Setup some mock users
    const mockUser1 = new User({
      id: 'user-1',
      email: new Email('test1@test.com'),
      password: Password.create('password123'),
      displayName: 'Vy',
      avatar: 'avatar1.png',
      elo: 1000,
    });
    const mockUser2 = new User({
      id: 'user-2',
      email: new Email('test2@test.com'),
      password: Password.create('password123'),
      displayName: 'Minh',
      avatar: 'avatar2.png',
      elo: 1100,
    });
    userRepo.users.set('user-1', mockUser1);
    userRepo.users.set('user-2', mockUser2);
  });

  describe('CreateRoomUseCase', () => {
    it('should create a room and set the host as the first player', async () => {
      const room = await createRoomUseCase.execute({
        hostId: 'user-1',
        name: 'My Custom Room',
        ruleset: 'riichi',
      });

      expect(room.id).toBeDefined();
      expect(room.name).toBe('My Custom Room');
      expect(room.hostId).toBe('user-1');
      expect(room.players.length).toBe(1);
      expect(room.players[0].userId).toBe('user-1');
      expect(room.players[0].displayName).toBe('Vy');
      expect(room.players[0].elo).toBe(1000);
      expect(room.players[0].isReady).toBe(false);
    });
  });

  describe('JoinRoomUseCase', () => {
    it('should allow a player to join a room', async () => {
      const room = await createRoomUseCase.execute({
        hostId: 'user-1',
        name: 'My Room',
        ruleset: 'riichi',
      });

      const updatedRoom = await joinRoomUseCase.execute({
        userId: 'user-2',
        roomId: room.id,
      });

      expect(updatedRoom.players.length).toBe(2);
      expect(updatedRoom.players[1].userId).toBe('user-2');
      expect(updatedRoom.players[1].displayName).toBe('Minh');
      expect(updatedRoom.players[1].elo).toBe(1100);
    });
  });

  describe('LeaveRoomUseCase', () => {
    it('should allow a player to leave a room, and delete the room if empty', async () => {
      const room = await createRoomUseCase.execute({
        hostId: 'user-1',
        name: 'My Room',
        ruleset: 'riichi',
      });

      const result = await leaveRoomUseCase.execute({
        userId: 'user-1',
        roomId: room.id,
      });

      expect(result.closed).toBe(true);
      expect(await roomRepo.findById(room.id)).toBeNull();
    });

    it('should promote a new host if host leaves and other players remain', async () => {
      const room = await createRoomUseCase.execute({
        hostId: 'user-1',
        name: 'My Room',
        ruleset: 'riichi',
      });

      await joinRoomUseCase.execute({
        userId: 'user-2',
        roomId: room.id,
      });

      const result = await leaveRoomUseCase.execute({
        userId: 'user-1',
        roomId: room.id,
      });

      expect(result.closed).toBe(false);
      expect(result.newHostId).toBe('user-2');

      const savedRoom = await roomRepo.findById(room.id);
      expect(savedRoom?.hostId).toBe('user-2');
      expect(savedRoom?.players.length).toBe(1);
    });
  });

  describe('ToggleReadyUseCase', () => {
    it('should toggle ready status of a player', async () => {
      const room = await createRoomUseCase.execute({
        hostId: 'user-1',
        name: 'My Room',
        ruleset: 'riichi',
      });

      await joinRoomUseCase.execute({
        userId: 'user-2',
        roomId: room.id,
      });

      const updated = await toggleReadyUseCase.execute({
        userId: 'user-2',
        roomId: room.id,
        isReady: true,
      });

      expect(updated.players.find((p) => p.userId === 'user-2')?.isReady).toBe(
        true,
      );
    });
  });

  describe('StartGameUseCase', () => {
    it('should start game if host calls and everyone else is ready and room has 4 players', async () => {
      // Mock other players
      userRepo.users.set(
        'u3',
        new User({
          id: 'u3',
          email: new Email('t3@t.com'),
          password: Password.create('password123'),
          displayName: 'P3',
          elo: 1000,
        }),
      );
      userRepo.users.set(
        'u4',
        new User({
          id: 'u4',
          email: new Email('t4@t.com'),
          password: Password.create('password123'),
          displayName: 'P4',
          elo: 1000,
        }),
      );

      const room = await createRoomUseCase.execute({
        hostId: 'user-1',
        name: 'R',
        ruleset: 'riichi',
      });
      await joinRoomUseCase.execute({ userId: 'user-2', roomId: room.id });
      await joinRoomUseCase.execute({ userId: 'u3', roomId: room.id });
      await joinRoomUseCase.execute({ userId: 'u4', roomId: room.id });

      await toggleReadyUseCase.execute({
        userId: 'user-2',
        roomId: room.id,
        isReady: true,
      });
      await toggleReadyUseCase.execute({
        userId: 'u3',
        roomId: room.id,
        isReady: true,
      });
      await toggleReadyUseCase.execute({
        userId: 'u4',
        roomId: room.id,
        isReady: true,
      });

      const started = await startGameUseCase.execute({
        hostId: 'user-1',
        roomId: room.id,
      });
      expect(started.status).toBe('playing');
    });

    it('should throw if non-host tries to start', async () => {
      const room = await createRoomUseCase.execute({
        hostId: 'user-1',
        name: 'R',
        ruleset: 'riichi',
      });
      await expect(
        startGameUseCase.execute({ hostId: 'user-2', roomId: room.id }),
      ).rejects.toThrow();
    });
  });
});
