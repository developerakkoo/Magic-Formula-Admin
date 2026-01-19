import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController, ToastController, AlertController } from '@ionic/angular';
import { NotificationFormModalComponent } from './notification-form.modal';
import { NotificationDetailsModalComponent } from './notification-details.modal';
import { Notification, User } from './notifications.types';
import { NotificationService } from '../services/notification.service';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false
})
export class NotificationsPage implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  filteredNotifications: Notification[] = [];
  isLoading: boolean = false;
  searchQuery: string = '';
  filterStatus: 'all' | 'DRAFT' | 'SENT' = 'all';
  filterType: 'all' | 'INFO' | 'PROMOTION' | 'ALERT' = 'all';
  sortField: string = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  dateRange: { start: Date | null; end: Date | null } = { start: null, end: null };
  selectedNotifications: string[] = [];
  selectAll: boolean = false;
  socketConnected: boolean = true;
  private socketSimulationInterval: any;
  
  // Pagination state
  currentPage: number = 1;
  pageSize: number = 10;
  totalNotifications: number = 0;

  constructor(
    private router: Router,
    private modalController: ModalController,
    private toastController: ToastController,
    private alertController: AlertController,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadNotifications();
    // Socket simulation disabled - can be re-enabled with real WebSocket later
    // this.startSocketSimulation();
  }

  ngOnDestroy() {
    if (this.socketSimulationInterval) {
      clearInterval(this.socketSimulationInterval);
    }
  }

  loadNotifications() {
    this.isLoading = true;
    
    // Build query parameters
    const params: any = {
      page: this.currentPage,
      limit: this.pageSize,
      sortBy: this.sortField,
      order: this.sortDirection
    };

    if (this.searchQuery.trim()) {
      params.search = this.searchQuery.trim();
    }

    if (this.filterStatus !== 'all') {
      params.status = this.filterStatus;
    }

    if (this.dateRange.start) {
      params.startDate = new Date(this.dateRange.start).toISOString();
    }

    if (this.dateRange.end) {
      const endDate = new Date(this.dateRange.end);
      endDate.setHours(23, 59, 59, 999);
      params.endDate = endDate.toISOString();
    }

    this.notificationService.getNotifications(params).subscribe({
      next: (response) => {
        this.notifications = response.data;
        this.totalNotifications = response.total;
        
        // Apply client-side type filter if needed (backend doesn't support type filter)
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
        this.presentToast(error.message || 'Failed to load notifications', 'danger');
        console.error('Error loading notifications:', error);
      }
    });
  }

  applyFilters() {
    // Most filtering is done server-side, but we apply type filter client-side
    // since backend doesn't support type filtering
    let result = [...this.notifications];

    // Apply type filter (client-side only)
    if (this.filterType !== 'all') {
      result = result.filter(notification => notification.type === this.filterType);
    }

    this.filteredNotifications = result;
    this.updateSelectAllState();
  }

  onSearch() {
    this.currentPage = 1; // Reset to first page on new search
    this.loadNotifications();
  }

  onFilterChange() {
    this.currentPage = 1; // Reset to first page on filter change
    this.loadNotifications();
  }

  onSort(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'desc';
    }
    this.currentPage = 1; // Reset to first page on sort change
    this.loadNotifications();
  }

  onDateRangeChange() {
    this.currentPage = 1; // Reset to first page on date range change
    this.loadNotifications();
  }

  toggleSelectAll() {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.selectedNotifications = this.filteredNotifications.map(n => n._id || '');
    } else {
      this.selectedNotifications = [];
    }
  }

  toggleNotificationSelection(id: string) {
    const index = this.selectedNotifications.indexOf(id);
    if (index > -1) {
      this.selectedNotifications.splice(index, 1);
    } else {
      this.selectedNotifications.push(id);
    }
    this.updateSelectAllState();
  }

  updateSelectAllState() {
    this.selectAll = this.filteredNotifications.length > 0 &&
      this.filteredNotifications.every(n => this.selectedNotifications.includes(n._id || ''));
  }

  async bulkDelete() {
    if (this.selectedNotifications.length === 0) {
      return;
    }

    const count = this.selectedNotifications.length;
    const alert = await this.alertController.create({
      header: 'Confirm Bulk Delete',
      message: `Are you sure you want to delete ${count} notification(s)?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.notificationService.bulkDeleteNotifications(this.selectedNotifications).subscribe({
              next: (response) => {
                this.selectedNotifications = [];
                this.selectAll = false;
                this.loadNotifications(); // Reload from server
                this.presentToast(`${response.deletedCount} notification(s) deleted successfully`, 'success');
              },
              error: (error) => {
                this.presentToast(error.message || 'Failed to delete notifications', 'danger');
                console.error('Error deleting notifications:', error);
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  async deleteNotification(notification: Notification) {
    if (!notification._id) {
      this.presentToast('Invalid notification', 'danger');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete "${notification.title}"?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.notificationService.deleteNotification(notification._id!).subscribe({
              next: () => {
                this.loadNotifications(); // Reload from server
                this.presentToast('Notification deleted successfully', 'success');
              },
              error: (error) => {
                this.presentToast(error.message || 'Failed to delete notification', 'danger');
                console.error('Error deleting notification:', error);
              }
            });
          }
        }
      ]
    });

    await alert.present();
  }

  async addNotification() {
    // Navigate directly to user selection page for creating notification
    this.router.navigate(['/notifications/select-users'], {
      state: { isCreatingNotification: true }
    });
  }

  async editNotification(notification: Notification) {
    const modal = await this.modalController.create({
      component: NotificationFormModalComponent,
      componentProps: { notification }
    });

    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.success) {
        if (data.data.notification) {
          this.updateNotificationData(data.data.notification);
        }
      }
    });

    return await modal.present();
  }

  async viewNotificationDetails(notification: Notification) {
    const modal = await this.modalController.create({
      component: NotificationDetailsModalComponent,
      componentProps: { notification }
    });

    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.action === 'edit') {
        this.editNotification(notification);
      } else if (data.data && data.data.action === 'delete') {
        this.deleteNotification(notification);
      } else if (data.data && data.data.action === 'send' && notification.status === 'DRAFT') {
        // Send notification - modal already closed, so we can proceed
        this.sendNotification(notification);
      }
    });

    return await modal.present();
  }

  async sendNotification(notification: Notification) {
    if (!notification._id) {
      this.presentToast('Invalid notification', 'danger');
      return;
    }

    if (notification.status === 'SENT') {
      this.presentToast('Notification already sent', 'warning');
      return;
    }

    if (!notification.targetUsers || notification.targetUsers.length === 0) {
      this.presentToast('Please select users to send notification', 'warning');
      return;
    }

    // Determine sendTo type based on targetUsers
    let sendTo: 'ALL' | 'SUBSCRIBED' | 'CUSTOM' = 'CUSTOM';
    let userIds: string[] | undefined = notification.targetUsers;

    // Note: We're using CUSTOM for now. If you want to support ALL or SUBSCRIBED,
    // you'll need to add UI controls to select the sendTo option
    this.notificationService.sendNotificationToUsers({
      notificationId: notification._id,
      userIds: userIds,
      sendTo: sendTo
    }).subscribe({
      next: (response) => {
        // Reload notifications to get updated status
        this.loadNotifications();
        // Show success message
        this.presentToast(`Notification sent successfully to ${response.sentCount} user(s)`, 'success');
      },
      error: (error) => {
        this.presentToast(error.message || 'Failed to send notification', 'danger');
        console.error('Error sending notification:', error);
      }
    });
  }

  addNotificationData(notification: Notification) {
    // Extract only the fields needed for creation (backend doesn't accept _id, createdAt, etc.)
    const createData = {
      title: notification.title,
      message: notification.message,
      type: notification.type
    };

    this.notificationService.createNotification(createData).subscribe({
      next: (createdNotification) => {
        this.loadNotifications(); // Reload from server
        this.presentToast('Notification created successfully', 'success');
      },
      error: (error) => {
        this.presentToast(error.message || 'Failed to create notification', 'danger');
        console.error('Error creating notification:', error);
      }
    });
  }

  updateNotificationData(updatedNotification: Notification) {
    if (!updatedNotification._id) {
      this.presentToast('Invalid notification', 'danger');
      return;
    }

    // Extract only the fields that can be updated
    const updateData: Partial<Notification> = {
      title: updatedNotification.title,
      message: updatedNotification.message,
      type: updatedNotification.type,
      status: updatedNotification.status
    };

    this.notificationService.updateNotification(updatedNotification._id, updateData).subscribe({
      next: () => {
        this.loadNotifications(); // Reload from server
        this.presentToast('Notification updated successfully', 'success');
      },
      error: (error) => {
        this.presentToast(error.message || 'Failed to update notification', 'danger');
        console.error('Error updating notification:', error);
      }
    });
  }

  startSocketSimulation() {
    // Simulate Socket.IO connection
    this.socketConnected = true;

    // Simulate real-time updates every 8-12 seconds
    this.socketSimulationInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        // Randomly update notification status or add new notification
        if (Math.random() > 0.5 && this.notifications.length > 0) {
          // Update a draft notification to sent
          const draftNotifications = this.notifications.filter(n => n.status === 'DRAFT');
          if (draftNotifications.length > 0) {
            const randomNotif = draftNotifications[Math.floor(Math.random() * draftNotifications.length)];
            const index = this.notifications.findIndex(n => n._id === randomNotif._id);
            if (index > -1 && randomNotif.targetUsers && randomNotif.targetUsers.length > 0) {
              this.notifications[index].status = 'SENT';
              this.notifications[index].sentCount = randomNotif.targetUsers.length;
              this.notifications[index].updatedAt = new Date();
              this.applyFilters();
              this.presentToast(`Notification "${randomNotif.title}" was sent`, 'success');
            }
          }
        } else {
          // Add a new notification occasionally
          if (Math.random() > 0.8) {
            const newNotif = this.generateRandomNotification();
            this.notifications.unshift(newNotif);
            this.applyFilters();
            this.presentToast(`New notification: "${newNotif.title}"`, 'primary');
          }
        }
      }
    }, 8000 + Math.random() * 4000);
  }

  generateRandomNotification(): Notification {
    const types: ('INFO' | 'PROMOTION' | 'ALERT')[] = ['INFO', 'PROMOTION', 'ALERT'];
    const titles = [
      'System Update Available',
      'New Feature Released',
      'Maintenance Scheduled',
      'Special Offer',
      'Important Announcement'
    ];
    const messages = [
      'A new system update is now available. Please update your app.',
      'Check out our latest feature release with enhanced capabilities.',
      'Scheduled maintenance will occur tonight from 2 AM to 4 AM.',
      'Limited time offer: Get 50% off on premium plans.',
      'Important announcement regarding service changes.'
    ];

    const type = types[Math.floor(Math.random() * types.length)];
    const titleIndex = Math.floor(Math.random() * titles.length);

    return {
      _id: `notif_${Date.now()}_${Math.random()}`,
      title: titles[titleIndex],
      message: messages[titleIndex],
      type,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date()
    };
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
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getMaxDate(): string {
    return new Date().toISOString();
  }

  getMinEndDate(): string {
    return this.dateRange.start ? new Date(this.dateRange.start).toISOString() : '';
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color
    });
    toast.present();
  }

}
