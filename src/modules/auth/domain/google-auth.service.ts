export interface GoogleUserPayload {
  email: string;
  displayName: string;
  avatar: string | null;
}

export abstract class IGoogleAuthService {
  abstract verifyToken(idToken: string): Promise<GoogleUserPayload>;
}
