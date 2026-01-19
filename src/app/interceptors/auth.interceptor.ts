import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip adding token for login endpoint
    if (req.url.includes('/api/admin/login')) {
      return next.handle(req);
    }

    // Add token to request using RxJS from() to convert Promise to Observable
    return from(this.authService.getToken()).pipe(
      switchMap(token => {
        let authReq = req;

        if (token) {
          authReq = req.clone({
            setHeaders: {
              Authorization: `Bearer ${token}`
            }
          });
        }

        return next.handle(authReq).pipe(
          catchError((error: HttpErrorResponse) => {
            // Handle 401 Unauthorized responses
            if (error.status === 401) {
              // Clear token and redirect to login
              this.authService.logout();
            }
            return throwError(() => error);
          })
        );
      })
    );
  }
}

