// types/auth.ts
export interface AuthCheckResponse {
  authenticated: boolean;
  fid?: string;
}

export interface SignInResponse {
  success: boolean;
  sessionId: string;
  fid: string;
  message: string;
}