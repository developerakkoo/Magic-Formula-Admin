import { Component } from '@angular/core';
import { MenuController } from '@ionic/angular';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  public appPages = [
    { title: 'Dashboard', url: '/folder/Dashboard', icon: 'analytics' },
    { title: 'Users', url: '/users', icon: 'person' },
    { title: 'Subscriptions', url: '/subscriptions', icon: 'card' },
    { title: 'Notifications', url: '/notifications', icon: 'notifications' },
    { title: 'Security Logs', url: '/logs', icon: 'reader' },
    { title: 'Settings', url: '/settings', icon: 'settings' },
  ];
  constructor(private menuController: MenuController) {
  }
}
