import { Component, OnInit } from '@angular/core';
import { MenuController } from '@ionic/angular';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  public appPages = [
    { title: 'Dashboard', url: '/folder/Dashboard', icon: 'analytics' },
    { title: 'Users', url: '/users', icon: 'person' },
    { title: 'Subscriptions', url: '/subscriptions', icon: 'card' },
    { title: 'Notifications', url: '/notifications', icon: 'notifications' },
    { title: 'Security Logs', url: '/logs', icon: 'reader' },
    { title: 'Settings', url: '/settings', icon: 'settings' },
  ];

  constructor(
    private menuController: MenuController,
    private router: Router,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    // Check authentication status on app initialization
    await this.checkAuthOnStart();

    // Listen to route changes to enable/disable menu
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(async (event: any) => {
      const isAuthenticated = await this.authService.isAuthenticated();
      if (event.url === '/login') {
        this.menuController.enable(false);
      } else if (isAuthenticated) {
        this.menuController.enable(true);
      }
    });
  }

  private async checkAuthOnStart() {
    const currentUrl = this.router.url;
    
    // Don't redirect if already on login page
    if (currentUrl === '/login' || currentUrl === '/') {
      return;
    }

    const isAuthenticated = await this.authService.isAuthenticated();
    if (!isAuthenticated) {
      this.router.navigate(['/login']);
    } else {
      this.menuController.enable(true);
    }
  }

  async onLogout() {
    await this.authService.logout();
  }
}
