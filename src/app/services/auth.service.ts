import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Data } from './data';

export interface Admin {
  id: string;
  email: string;
  role: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  admin: Admin;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly TOKEN_KEY = 'admin_token';
  private readonly ADMIN_KEY = 'admin_data';
  private authState$ = new BehaviorSubject<boolean>(false);

  constructor(
    private http: HttpClient,
    private router: Router,
    private data: Data
  ) {
    this.checkAuthState();
  }

  /**
   * Login admin with email and password
   */
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${environment.API_URL}/api/admin/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        this.setToken(response.token);
        this.setAdmin(response.admin);
        this.authState$.next(true);
      }),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Logout admin and clear stored data
   */
  async logout(): Promise<void> {
    await this.data.removeKey(this.TOKEN_KEY);
    await this.data.removeKey(this.ADMIN_KEY);
    this.authState$.next(false);
    this.router.navigate(['/login']);
  }

  /**
   * Check if admin is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  /**
   * Get stored token
   */
  async getToken(): Promise<string | null> {
    return await this.data.get(this.TOKEN_KEY);
  }

  /**
   * Get stored admin data
   */
  async getAdmin(): Promise<Admin | null> {
    return await this.data.get(this.ADMIN_KEY);
  }

  /**
   * Set token in storage
   */
  private async setToken(token: string): Promise<void> {
    await this.data.set(this.TOKEN_KEY, token);
  }

  /**
   * Set admin data in storage
   */
  private async setAdmin(admin: Admin): Promise<void> {
    await this.data.set(this.ADMIN_KEY, admin);
  }

  /**
   * Check authentication state on service initialization
   */
  private async checkAuthState(): Promise<void> {
    const isAuth = await this.isAuthenticated();
    this.authState$.next(isAuth);
  }

  /**
   * Get authentication state observable
   */
  getAuthState(): BehaviorSubject<boolean> {
    return this.authState$;
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
    
    if (error.status === 401) {
      return { ...error, message: 'Invalid email or password.' };
    }
    
    if (error.status === 500) {
      return { ...error, message: 'Server error. Please try again later.' };
    }
    
    return { ...error, message: 'An unexpected error occurred. Please try again.' };
  }
}

