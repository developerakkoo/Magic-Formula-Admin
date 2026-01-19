export interface Notification {
  _id?: string;
  title: string;
  message: string;
  type: 'INFO' | 'PROMOTION' | 'ALERT';
  status: 'DRAFT' | 'SENT';
  createdBy?: string;
  targetUsers?: string[];
  sentCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface User {
  _id: string;
  fullName?: string;
  email?: string;
  mobile?: string;
  isBlocked?: boolean;
  hasActivePlan?: boolean;
  planExpiry?: Date;
  createdAt?: Date;
}

