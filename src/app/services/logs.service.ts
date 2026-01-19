import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Log {
  _id: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  module: string;
  message: string;
  userId?: {
    _id: string;
    fullName?: string;
    email?: string;
    mobile?: string;
  };
  adminId?: {
    _id: string;
    email?: string;
  };
  metadata?: any;
  ipAddress?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface LogsListParams {
  page?: number;
  limit?: number;
  type?: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  module?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface LogsListResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: Log[];
}

export interface LogResponse {
  success: boolean;
  message?: string;
  data: Log;
}

export interface BulkDeleteResponse {
  success: boolean;
  deletedCount: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class LogsService {
  private readonly apiUrl = `${environment.API_URL}/api/admin/logs`;

  constructor(private http: HttpClient) {}

  /**
   * Get all logs with pagination and filters
   */
  getLogs(params?: LogsListParams): Observable<LogsListResponse> {
    let httpParams = new HttpParams();
    
    if (params) {
      if (params.page) httpParams = httpParams.set('page', params.page.toString());
      if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
      if (params.type) httpParams = httpParams.set('type', params.type);
      if (params.module) httpParams = httpParams.set('module', params.module);
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.startDate) httpParams = httpParams.set('startDate', params.startDate);
      if (params.endDate) httpParams = httpParams.set('endDate', params.endDate);
      if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
      if (params.order) httpParams = httpParams.set('order', params.order);
    }

    return this.http.get<LogsListResponse>(this.apiUrl, { params: httpParams }).pipe(
      map(response => ({
        ...response,
        data: response.data.map(log => ({
          ...log,
          createdAt: new Date(log.createdAt),
          updatedAt: new Date(log.updatedAt)
        }))
      })),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Get log by ID
   */
  getLogById(id: string): Observable<Log> {
    return this.http.get<LogResponse>(`${this.apiUrl}/${id}`).pipe(
      map(response => ({
        ...response.data,
        createdAt: new Date(response.data.createdAt),
        updatedAt: new Date(response.data.updatedAt)
      })),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Delete a single log
   */
  deleteLog(logId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${logId}`).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Bulk delete logs
   */
  bulkDeleteLogs(ids: string[]): Observable<BulkDeleteResponse> {
    return this.http.delete<BulkDeleteResponse>(`${this.apiUrl}/bulk-delete`, {
      body: { ids }
    }).pipe(
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Clear all logs
   */
  clearAllLogs(): Observable<BulkDeleteResponse> {
    return this.http.delete<BulkDeleteResponse>(`${this.apiUrl}/clear/all`).pipe(
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
      return { ...error, message: 'Log not found.' };
    }
    
    if (error.status === 500) {
      return { ...error, message: 'Server error. Please try again later.' };
    }
    
    return { ...error, message: 'An unexpected error occurred. Please try again.' };
  }
}

