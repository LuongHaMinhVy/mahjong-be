import { randomUUID } from 'crypto';
import { type Email } from './value-objects/email.vo.js';
import { type Password } from './value-objects/password.vo.js';
import { DomainException } from '../../../shared/exceptions/domain.exception.js';

export interface UserProps {
  id?: string;
  email: Email;
  password: Password;
  displayName: string;
  avatar?: string | null;
  elo?: number;
  isEmailVerified?: boolean;
  role?: string;
  bannedUntil?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  private readonly _id: string;
  private readonly _email: Email;
  private readonly _password: Password;
  private _displayName: string;
  private _avatar: string | null;
  private _elo: number;
  private _isEmailVerified: boolean;
  private _role: string;
  private _bannedUntil: Date | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: UserProps) {
    this._id = props.id || randomUUID();
    this._email = props.email;
    this._password = props.password;
    this._displayName = props.displayName;
    this._avatar = props.avatar || null;
    this._elo = props.elo ?? 1000;
    this._isEmailVerified = props.isEmailVerified ?? false;
    this._role = props.role || 'USER';
    this._bannedUntil = props.bannedUntil || null;
    this._createdAt = props.createdAt || new Date();
    this._updatedAt = props.updatedAt || new Date();
  }

  get id(): string {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get password(): Password {
    return this._password;
  }

  get displayName(): string {
    return this._displayName;
  }

  get avatar(): string | null {
    return this._avatar;
  }

  get elo(): number {
    return this._elo;
  }

  get isEmailVerified(): boolean {
    return this._isEmailVerified;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get role(): string {
    return this._role;
  }

  get bannedUntil(): Date | null {
    return this._bannedUntil;
  }

  public verifyEmail(): void {
    this._isEmailVerified = true;
    this.touch();
  }

  public updateDisplayName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Display name cannot be empty',
      );
    }
    this._displayName = name.trim();
    this.touch();
  }

  public updateAvatar(url: string | null): void {
    this._avatar = url;
    this.touch();
  }

  public updateElo(newElo: number): void {
    this._elo = newElo;
    this.touch();
  }

  public verifyPassword(plainText: string): boolean {
    return this._password.compare(plainText);
  }

  public isBanned(): boolean {
    return this._bannedUntil ? this._bannedUntil > new Date() : false;
  }

  public ban(until: Date | null): void {
    this._bannedUntil = until;
    this.touch();
  }

  public updateRole(role: string): void {
    this._role = role;
    this.touch();
  }

  private touch(): void {
    this._updatedAt = new Date();
  }
}
