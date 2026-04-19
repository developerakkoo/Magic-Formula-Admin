import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Plan {
  _id?: string;
  title: string;
  code?: string;
  description: string[];
  durationInMonths: 1 | 3 | 6 | 12;
  actualPrice: number;
  discountedPrice: number;
  showOfferBadge: boolean;
  offerText?: string;
  offerStartAt?: Date | string;
  offerEndAt?: Date | string;
  isActive: boolean;
  isStarterOffer?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface PlanResponse {
  success: boolean;
  message?: string;
  data: Plan;
}

export interface PlansResponse {
  success: boolean;
  data: Plan[];
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private readonly apiUrl = `${environment.API_URL}/api/subscriptions`;

  constructor(private http: HttpClient) {}

  /**
   * Get all plans (admin view - includes active and inactive)
   */
  getAllPlans(): Observable<Plan[]> {
    return this.http.get<PlansResponse>(`${this.apiUrl}/admin/plans`).pipe(
      map(response => response.data),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Create a new subscription plan
   */
  createPlan(planData: Partial<Plan>): Observable<Plan> {
    return this.http.post<PlanResponse>(`${this.apiUrl}/admin/plans`, planData).pipe(
      map(response => response.data),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Update an existing subscription plan
   */
  updatePlan(planId: string, planData: Partial<Plan>): Observable<Plan> {
    return this.http.put<PlanResponse>(`${this.apiUrl}/admin/plans/${planId}`, planData).pipe(
      map(response => response.data),
      catchError(error => {
        return throwError(() => this.handleError(error));
      })
    );
  }

  /**
   * Delete a plan (soft delete - sets isActive to false)
   */
  deletePlan(planId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/plans/${planId}`).pipe(
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
      return { ...error, message: 'Plan not found.' };
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

