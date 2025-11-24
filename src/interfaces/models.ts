export interface IVehicle {
    id: string;
    userId: string;
    licensePlate: string;
    brand: string;
    model: string;
    year: number;
    color: string;
    status: 'active' | 'deleted';
    createdAt: number;
    updatedAt: number;
}
export interface IUser {
    id: string;
    name: string;
    surname: string;
    email: string;
    phone?: string;
    avatar?: string | null;
    balance: number;
    isAdmin: boolean;
    isActive?: boolean;
    createdAt: number;
    updatedAt?: number;
    lastRecharge?: number;
}

export interface IUserProfile {
    id: string;
    name: string;
    surname: string;
    email: string;
    phone?: string;
    avatar?: string | null;
    balance: number;
}
export interface IPushToken {
    id: string;
    userId: string;
    token: string;
    updatedAt: number;
}

export interface INotification {
    id: string;
    userId: string;
    title: string;
    body: string;
    data?: Record<string, any>;
    read: boolean;
    createdAt: number;
}

export interface IPushMessage {
    to: string;
    sound: string;
    title: string;
    body: string;
    data?: Record<string, any>;
}