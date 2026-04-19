import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Notification, User } from './notifications.types';

@Component({
  selector: 'app-notification-details',
  templateUrl: './notification-details.modal.html',
  styleUrls: ['./notification-details.modal.scss'],
  standalone: false
})
export class NotificationDetailsModalComponent implements OnInit {
  @Input() notification!: Notification;
  mockUsers: User[] = [];
  targetUsersList: User[] = [];

  constructor(private modalController: ModalController) {
    this.loadMockUsers();
  }

  ngOnInit() {
    if (this.notification.targetUsers && this.notification.targetUsers.length > 0) {
      this.targetUsersList = this.mockUsers.filter(user =>
        this.notification.targetUsers!.includes(user._id)
      );
    }
  }

  loadMockUsers() {
    this.mockUsers = [
      { _id: 'user1', fullName: 'John Doe', email: 'john@example.com', mobile: '+1234567890' },
      { _id: 'user2', fullName: 'Jane Smith', email: 'jane@example.com', mobile: '+1234567891' },
      { _id: 'user3', fullName: 'Bob Johnson', email: 'bob@example.com', mobile: '+1234567892' },
      { _id: 'user4', fullName: 'Alice Williams', email: 'alice@example.com', mobile: '+1234567893' },
      { _id: 'user5', fullName: 'Charlie Brown', email: 'charlie@example.com', mobile: '+1234567894' },
      { _id: 'user6', fullName: 'Diana Prince', email: 'diana@example.com', mobile: '+1234567895' },
      { _id: 'user7', fullName: 'Edward Norton', email: 'edward@example.com', mobile: '+1234567896' },
      { _id: 'user8', fullName: 'Fiona Apple', email: 'fiona@example.com', mobile: '+1234567897' },
      { _id: 'user9', fullName: 'George Lucas', email: 'george@example.com', mobile: '+1234567898' },
      { _id: 'user10', fullName: 'Helen Keller', email: 'helen@example.com', mobile: '+1234567899' }
    ];
  }

  getTypeBadgeColor(type: string): string {
    switch (type) {
      case 'INFO':
        return 'primary';
      case 'PROMOTION':
        return 'success';
      case 'ALERT':
        return 'danger';
      default:
        return 'medium';
    }
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  edit() {
    this.modalController.dismiss({ action: 'edit' });
  }

  delete() {
    this.modalController.dismiss({ action: 'delete' });
  }

  send() {
    this.modalController.dismiss({ action: 'send' });
  }

  resend() {
    this.modalController.dismiss({ action: 'resend' });
  }

  close() {
    this.modalController.dismiss();
  }
}

