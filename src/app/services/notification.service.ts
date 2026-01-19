import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Notification } from '../notifications/notifications.types';

export interface NotificationListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'DRAFT' | 'SENT';
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface NotificationListResponse {
  success: boolean;
  total: number;
  page: number;
  data: Notification[];
}

export interface NotificationResponse {
  success: boolean;
  message?: string;
  data: Notification;
}

export interface BulkDeleteResponse {
  success: boolean;
  deletedCount: number;
  message: string;
}

export interface SendNotificationRequest {
  notificationId: string;
  userIds?: string[];
  sendTo: 'ALL' | 'SUBSCRIBED' | 'CUSTOM';
}

export interface SendNotificationResponse {
  success: boolean;
  sentCount: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly apiUrl = `${environment.API_URL}/api/notifications`;

  constructor(private http: HttpClient) {}

  /**
   * Get all notifications with pagination and filters
   */
  getNotifications(params?: NotificationListParams): Observable<NotificationListResponse> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.status) httpParams = httpParams.set('status', params.status);
      if (params.startDate) httpParams = httpParams.set('startDate', params.startDate);
      if (params.endDate) httpParams = httpParams.set('endDate', params.endDate);
      if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
      if (params.order) httpParams = httpParams.set('order', params.order);
    }

    return this.http.get<NotificationListResponse>(this.apiUrl, { params: httpParams }).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Create a new notification
   */
  createNotification(notificationData: { title: string; message: string; type: 'INFO' | 'PROMOTION' | 'ALERT' }): Observable<Notification> {
    return this.http.post<NotificationResponse>(this.apiUrl, notificationData).pipe(
      map(response => response.data),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Update an existing notification
   */
  updateNotification(notificationId: string, notificationData: Partial<Notification>): Observable<Notification> {
    return this.http.put<NotificationResponse>(`${this.apiUrl}/${notificationId}`, notificationData).pipe(
      map(response => response.data),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Delete a single notification
   */
  deleteNotification(notificationId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${notificationId}`).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Bulk delete notifications
   */
  bulkDeleteNotifications(ids: string[]): Observable<BulkDeleteResponse> {
    return this.http.delete<BulkDeleteResponse>(`${this.apiUrl}/bulk-delete`, {
      body: { ids }
    }).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Send notification to users
   */
  sendNotificationToUsers(request: SendNotificationRequest): Observable<SendNotificationResponse> {
    return this.http.post<SendNotificationResponse>(`${this.apiUrl}/send-to-users`, request).pipe(
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
      return { ...error, message: 'Notification not found.' };
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

