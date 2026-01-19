import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Settings {
  _id?: string;
  appName: string;
  appDescription: string;
  defaultNotificationTitle: string;
  defaultNotificationMessage: string;
  razorpayKeyId: string;
  razorpayKeySecret?: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  enableWhatsAppNotifications: boolean;
  enableFirebaseNotifications: boolean;
  metadata?: any;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface SettingsResponse {
  success: boolean;
  message?: string;
  data: Settings;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly apiUrl = `${environment.API_URL}/api/admin/settings`;

  constructor(private http: HttpClient) {}

  /**
   * Get current settings
   */
  getSettings(): Observable<Settings> {
    return this.http.get<SettingsResponse>(this.apiUrl).pipe(
      map(response => ({
        ...response.data,
        createdAt: response.data.createdAt ? new Date(response.data.createdAt) : undefined,
        updatedAt: response.data.updatedAt ? new Date(response.data.updatedAt) : undefined
      })),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<Settings>): Observable<Settings> {
    return this.http.put<SettingsResponse>(this.apiUrl, settings).pipe(
      map(response => ({
        ...response.data,
        createdAt: response.data.createdAt ? new Date(response.data.createdAt) : undefined,
        updatedAt: response.data.updatedAt ? new Date(response.data.updatedAt) : undefined
      })),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Reset settings to defaults
   */
  resetSettings(): Observable<Settings> {
    return this.http.post<SettingsResponse>(`${this.apiUrl}/reset`, {}).pipe(
      map(response => ({
        ...response.data,
        createdAt: response.data.createdAt ? new Date(response.data.createdAt) : undefined,
        updatedAt: response.data.updatedAt ? new Date(response.data.updatedAt) : undefined
      })),
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
      return { ...error, message: 'Settings not found.' };
    }
    
    if (error.status === 500) {
      return { ...error, message: 'Server error. Please try again later.' };
    }
    
    return { ...error, message: 'An unexpected error occurred. Please try again.' };
  }
}

