import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface UserAnalytics {
  totalUsers: number;
  liveUsers: number;
  subscribedUsers: number;
  blockedUsers: number;
  unsubscribedUsers: number;
}

export interface PlanWiseEarning {
  _id: string;
  planTitle: string;
  totalAmount: number;
  purchaseCount: number;
}

export interface EarningsAnalytics {
  todayEarnings: number;
  monthlyEarnings: number;
  totalEarnings: number;
  planWiseEarnings: PlanWiseEarning[];
}

export interface BestsellerPlan {
  _id: string;
  planTitle: string;
  durationInMonths: number;
  price: number;
  purchaseCount: number;
}

export interface BestsellerPlansResponse {
  bestsellerPlan: BestsellerPlan | null;
  topPlans: BestsellerPlan[];
}

export interface SubscriptionAnalytics {
  totalSubscribedUsers: number;
  planWise: Array<{
    _id: string;
    count: number;
  }>;
}

export interface AnalyticsResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly apiUrl = `${environment.API_URL}/api/admin`;
  private readonly subscriptionApiUrl = `${environment.API_URL}/api/subscriptions`;

  constructor(private http: HttpClient) {}

  /**
   * Get user analytics (total users, live users, subscribed/unsubscribed counts)
   */
  getUserAnalytics(): Observable<UserAnalytics> {
    return this.http.get<AnalyticsResponse<UserAnalytics>>(`${this.apiUrl}/users-analytics`).pipe(
      map(response => response.data),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Get earnings analytics with optional date filtering
   */
  getEarningsAnalytics(startDate?: string, endDate?: string): Observable<EarningsAnalytics> {
    let httpParams = new HttpParams();
    if (startDate) {
      httpParams = httpParams.set('startDate', startDate);
    }
    if (endDate) {
      httpParams = httpParams.set('endDate', endDate);
    }

    return this.http.get<AnalyticsResponse<EarningsAnalytics>>(`${this.apiUrl}/earnings`, { params: httpParams }).pipe(
      map(response => response.data),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Get bestseller plans analytics
   */
  getBestsellerPlans(startDate?: string, endDate?: string): Observable<BestsellerPlansResponse> {
    let httpParams = new HttpParams();
    if (startDate) {
      httpParams = httpParams.set('startDate', startDate);
    }
    if (endDate) {
      httpParams = httpParams.set('endDate', endDate);
    }

    return this.http.get<AnalyticsResponse<BestsellerPlansResponse>>(`${this.apiUrl}/bestseller-plans`, { params: httpParams }).pipe(
      map(response => response.data),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Get subscription analytics
   */
  getSubscriptionAnalytics(startDate?: string, endDate?: string): Observable<SubscriptionAnalytics> {
    let httpParams = new HttpParams();
    if (startDate) {
      httpParams = httpParams.set('startDate', startDate);
    }
    if (endDate) {
      httpParams = httpParams.set('endDate', endDate);
    }

    return this.http.get<AnalyticsResponse<SubscriptionAnalytics>>(`${this.subscriptionApiUrl}/admin/analytics`, { params: httpParams }).pipe(
      map(response => response.data),
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
      return { ...error, message: 'Analytics data not found.' };
    }
    
    if (error.status === 500) {
      return { ...error, message: 'Server error. Please try again later.' };
    }
    
    return { ...error, message: 'An unexpected error occurred. Please try again.' };
  }
}

