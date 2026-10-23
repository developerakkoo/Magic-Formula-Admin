import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SubscriptionService } from '../services/subscription.service';

export interface User {
  _id?: string;
  mobile: string;
  fullName?: string;
  email?: string;
  whatsapp?: string;
  profilePic?: string;
  firebaseToken?: string;
  isBlocked: boolean;
  activePlan?: string;
  planExpiry?: Date | string;
  deviceId?: string;
  lastDeviceLogin?: Date | string;
  lastActivity?: Date | string; // Last activity timestamp for live user tracking
  deviceChangeRequested?: boolean;
  deviceChangeRequestedAt?: Date | string;
  loginAttempts?: number;
  isDeviceBlocked?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  /** Admin GET/PATCH only: whether the account has a bcrypt password (plaintext never returned). */
  passwordSet?: boolean;
  /** Derived from active UserSubscription when listing users. */
  hasActivePlan?: boolean;
  registrationStatus?: 'pending' | 'approved' | 'rejected';
  registrationSubmittedAt?: Date | string;
  registrationReviewedAt?: Date | string;
  rejectionReason?: string;
}

export type UserListStatus = 'all' | 'blocked' | 'subscribed' | 'unsubscribed' | 'live' | 'pending' | 'rejected';

export interface UserListParams {
  search?: string;
  status?: UserListStatus;
  sortBy?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface UsersResponse {
  success?: boolean;
  count: number;
  page?: number;
  totalPages?: number;
  limit?: number | null;
  users: User[];
}

export interface UserResponse {
  success: boolean;
  message?: string;
  data: User;
}

/** Body for POST /api/admin/users (single create). Password is required; never returned on GET. */
export interface AdminCreateUserRequest {
  fullName?: string;
  email: string;
  mobile: string;
  whatsapp?: string;
  password: string;
}

/** Body for PATCH /api/admin/users/:id. Include `password` only to set a new password (write-only). */
export interface AdminUpdateUserRequest {
  fullName?: string;
  email?: string;
  whatsapp?: string;
  profilePic?: string;
  firebaseToken?: string;
  password?: string;
}

/** Response from POST /api/admin/bulk-create-users (see ADMIN_BULK_WATI_API.md) */
export interface BulkCreateUsersResponse {
  message: string;
  summary: { totalRows: number; created: number; skipped: number; failed: number };
  created: Array<{ rowNumber: number; userId?: string; email?: string; whatsapp?: string; resetLink?: string; whatsappSent?: boolean }>;
  skipped: Array<{ rowNumber: number; email?: string; reason: string }>;
  failed: Array<{ rowNumber: number; reason?: string; email?: string; whatsapp?: string }>;
}

/** Response from POST /api/admin/bulk-subscription (see ADMIN_BULK_WATI_API.md) */
export interface BulkSubscriptionResponse {
  message: string;
  summary: { totalRows: number; successCount: number; failedCount: number };
  success: Array<{ rowNumber: number; userId?: string; email?: string; mobile?: string; planCode: string; planName?: string; startDate?: string; expiryDate?: string }>;
  failed: Array<{ rowNumber: number; email?: string; mobile?: string; planCode?: string; reason: string }>;
}

/** Response from POST /api/admin/bulk-remove-subscription (see ADMIN_BULK_WATI_API.md) */
export interface BulkRemoveSubscriptionResponse {
  message: string;
  summary: { totalRows: number; successCount: number; failedCount: number };
  success: Array<{ rowNumber: number; userId?: string; email?: string; mobile?: string; removedSubscriptionId?: string; planId?: string }>;
  failed: Array<{ rowNumber: number; email?: string; mobile?: string; reason: string }>;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private apiUrl = `${environment.API_URL}/api/admin`;
  private subscriptionApiUrl = `${environment.API_URL}/api/subscriptions`;

  constructor(
    private http: HttpClient,
    private subscriptionService: SubscriptionService
  ) {}

  /**
   * Get all users with optional search, status filter, and sort (GET /api/admin/users).
   */
  getAllUsers(params?: UserListParams): Observable<UsersResponse> {
    let httpParams = new HttpParams();
    if (params?.search?.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }
    if (params?.status && params.status !== 'all') {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.sortBy) {
      httpParams = httpParams.set('sortBy', params.sortBy);
    }
    if (params?.order) {
      httpParams = httpParams.set('order', params.order);
    }
    if (params?.page !== undefined) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }

    return this.http.get<UsersResponse>(`${this.apiUrl}/users`, { params: httpParams }).pipe(
      map(response => ({
        ...response,
        users: response.users.map(user => this.mapUserDates(user))
      })),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Get user by ID
   */
  getUserById(id: string): Observable<User> {
    return this.http.get<UserResponse>(`${this.apiUrl}/users/${id}`).pipe(
      map(response => this.mapUserDates(response.data)),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Create new user
   */
  createUser(userData: AdminCreateUserRequest): Observable<User> {
    return this.http.post<UserResponse>(`${this.apiUrl}/users`, userData).pipe(
      map(response => this.mapUserDates(response.data)),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Update user
   */
  updateUser(id: string, userData: AdminUpdateUserRequest): Observable<User> {
    return this.http.patch<UserResponse>(`${this.apiUrl}/users/${id}`, userData).pipe(
      map(response => this.mapUserDates(response.data)),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Delete user
   */
  deleteUser(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${id}`).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Block user
   */
  blockUser(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/block/${id}`, {}).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Unblock user
   */
  unblockUser(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/unblock/${id}`, {}).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  approveRegistration(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/${id}/approve`, {}).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  rejectRegistration(id: string, reason?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/${id}/reject`, { reason }).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Reset user device (allows user to login from a new device)
   */
  resetUserDevice(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/reset-device/${id}`, {}).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Assign subscription plan to user
   */
  assignSubscription(userId: string, planId: string): Observable<any> {
    return this.http.post(`${this.subscriptionApiUrl}/admin/assign`, {
      userId,
      planId
    }).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Export users to Excel
   */
  exportUsers(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export-users`, {
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Bulk upload subscriptions (Excel: Email, Mobile, Plan Code). See ADMIN_BULK_WATI_API.md.
   */
  bulkUploadSubscriptions(file: File): Observable<BulkSubscriptionResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<BulkSubscriptionResponse>(`${this.apiUrl}/bulk-subscription`, formData).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Bulk remove active subscriptions (Excel: Email and/or Mobile). See ADMIN_BULK_WATI_API.md.
   */
  bulkRemoveSubscriptions(file: File): Observable<BulkRemoveSubscriptionResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<BulkRemoveSubscriptionResponse>(`${this.apiUrl}/bulk-remove-subscription`, formData).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Bulk create users (Excel: Full Name, Email, WhatsApp, Password). Sends WATI template per user. See ADMIN_BULK_WATI_API.md.
   */
  bulkCreateUsers(file: File): Observable<BulkCreateUsersResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<BulkCreateUsersResponse>(`${this.apiUrl}/bulk-create-users`, formData).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Get device conflicts
   */
  getDeviceConflicts(): Observable<any> {
    return this.http.get(`${this.apiUrl}/users/device-conflicts`).pipe(
      map(response => {
        // Handle both direct response and wrapped response
        if (response && (response as any).success !== undefined) {
          return response;
        }
        return { success: true, data: response };
      }),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Allow new device for user
   */
  allowNewDevice(userId: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/users/${userId}/allow-device`, {}).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  private normalizeRegistrationStatus(
    status?: string
  ): 'pending' | 'approved' | 'rejected' {
    const normalized = String(status || 'approved').trim().toLowerCase()
    if (normalized === 'pending' || normalized === 'rejected') {
      return normalized
    }
    return 'approved'
  }

  /**
   * Map date strings to Date objects and construct profile picture URL
   */
  private mapUserDates(user: any): User {
    const baseUrl = environment.API_URL;
    const profilePicUrl = user.profilePic 
      ? `${baseUrl}/api/users/${user._id}` 
      : undefined;

    return {
      ...user,
      profilePic: profilePicUrl,
      registrationStatus: this.normalizeRegistrationStatus(user.registrationStatus),
      planExpiry: user.planExpiry ? new Date(user.planExpiry) : undefined,
      createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : undefined,
      lastDeviceLogin: user.lastDeviceLogin ? new Date(user.lastDeviceLogin) : undefined,
      lastActivity: user.lastActivity ? new Date(user.lastActivity) : undefined
    };
  }

  /**
   * Handle HTTP errors and return user-friendly messages
   */
  private handleError(error: any): any {
    if (error.error?.message) {
      return { ...error, message: error.error.message };
    }
    
    if (error.status === 0) {
      return { ...error, message: 'Network error. Please check your connection and try again.' };
    }
    
    if (error.status === 404) {
      return { ...error, message: 'User not found.' };
    }
    
    if (error.status === 409) {
      return { ...error, message: error.error?.message || 'User already exists.' };
    }
    
    if (error.status === 400) {
      return { ...error, message: error.error?.message || 'Invalid request. Please check your input.' };
    }
    
    if (error.status === 500) {
      return { ...error, message: 'Server error. Please try again later.' };
    }
    
    return { ...error, message: 'An unexpected error occurred. Please try again.' };
  }
}

