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
  loginAttempts?: number;
  isDeviceBlocked?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface UsersResponse {
  count: number;
  users: User[];
}

export interface UserResponse {
  success: boolean;
  message?: string;
  data: User;
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
   * Get all users
   */
  getAllUsers(params?: { filter?: string; sort?: string; order?: string }): Observable<UsersResponse> {
    let httpParams = new HttpParams();
    if (params?.filter) {
      httpParams = httpParams.set('filter', params.filter);
    }
    if (params?.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }
    if (params?.order) {
      httpParams = httpParams.set('order', params.order);
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
  createUser(userData: Partial<User>): Observable<User> {
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
  updateUser(id: string, userData: Partial<User>): Observable<User> {
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
   * Bulk upload subscriptions
   */
  bulkUploadSubscriptions(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/bulk-subscription`, formData).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Bulk create users
   */
  bulkCreateUsers(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/bulk-create-users`, formData).pipe(
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
      planExpiry: user.planExpiry ? new Date(user.planExpiry) : undefined,
      createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : undefined,
      lastDeviceLogin: user.lastDeviceLogin ? new Date(user.lastDeviceLogin) : undefined
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

