// Tipos para autenticación

export interface RegisterData {
  name: string;
  surname: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UserData {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  avatar: string | null;
  balance: number;
  isAdmin: boolean;
  createdAt: any; // Firestore Timestamp
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: UserData;
  token?: string;
  refreshToken?: string;
  isAdmin?: boolean;
}

export interface DecodedToken {
  uid: string;
  email: string;
  isAdmin: boolean;
  iat: number;
  exp: number;
}