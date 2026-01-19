import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User } from '../notifications/notifications.types';

export interface UsersListResponse {
  success: boolean;
  count: number;
  page: number;
  totalPages: number;
  limit: number;
  users: User[];
}

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  isBlocked?: boolean;
  hasActivePlan?: boolean;
  planExpiryStart?: string;
  planExpiryEnd?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly apiUrl = `${environment.API_URL}/api/admin`;

  constructor(private http: HttpClient) {}

  /**
   * Get all users for admin operations (e.g., notification targeting)
   * @deprecated Use getUsersWithFilters instead for better performance
   */
  getAllUsers(): Observable<User[]> {
    return this.http.get<UsersListResponse>(`${this.apiUrl}/users`).pipe(
      map(response => {
        // Map backend user structure to frontend User interface
        return response.users.map(user => ({
          _id: user._id,
          fullName: user.fullName || '',
          email: user.email || '',
          mobile: user.mobile || ''
        }));
      }),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Get users with filters and pagination
   */
  getUsersWithFilters(filters: UserFilters): Observable<UsersListResponse> {
    const params: any = {};
    
    if (filters.page !== undefined) params.page = filters.page.toString();
    if (filters.limit !== undefined) params.limit = filters.limit.toString();
    if (filters.search) params.search = filters.search;
    if (filters.isBlocked !== undefined) params.isBlocked = filters.isBlocked.toString();
    if (filters.hasActivePlan !== undefined) params.hasActivePlan = filters.hasActivePlan.toString();
    if (filters.planExpiryStart) params.planExpiryStart = filters.planExpiryStart;
    if (filters.planExpiryEnd) params.planExpiryEnd = filters.planExpiryEnd;
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.order) params.order = filters.order;

    return this.http.get<UsersListResponse>(`${this.apiUrl}/users`, { params }).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
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
      return { ...error, message: 'Users not found.' };
    }
    
    if (error.status === 500) {
      return { ...error, message: 'Server error. Please try again later.' };
    }
    
    return { ...error, message: 'An unexpected error occurred. Please try again.' };
  }
}

