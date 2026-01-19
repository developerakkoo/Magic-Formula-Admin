import { Component, OnInit } from '@angular/core';
import { ModalController, ToastController, LoadingController, AlertController } from '@ionic/angular';
import { UsersService, User } from './users.service';
import { UserFormModalComponent } from './user-form.modal';
import { BulkUploadModalComponent } from './bulk-upload.modal';
import { UserDetailsModalComponent } from './user-details.modal';

@Component({
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  standalone: false
})
export class UsersPage implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  searchQuery: string = '';
  sortField: string = 'createdAt';
  sortDirection: 'asc' | 'desc' = 'desc';
  filterStatus: 'all' | 'live' | 'subscribed' | 'unsubscribed' = 'all';
  isLoading: boolean = false;
  selectedUsers: string[] = [];
  showDeviceConflicts: boolean = false;
  deviceConflictUsers: User[] = [];

  constructor(
    private modalController: ModalController,
    private usersService: UsersService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadUsers();
  }

  ionViewWillEnter() {
    this.loadUsers();
  }

  async loadUsers() {
    this.isLoading = true;
    try {
      const response = await this.usersService.getAllUsers({
        filter: this.filterStatus,
        sort: this.sortField,
        order: this.sortDirection
      }).toPromise();
      
      if (response && response.users) {
        this.users = response.users;
      } else if (Array.isArray(response)) {
        this.users = response;
      } else {
        this.users = [];
      }

      // Fetch device conflicts and mark users with conflicts
      try {
        const deviceConflicts = await this.usersService.getDeviceConflicts().toPromise();
        if (deviceConflicts && deviceConflicts.success && deviceConflicts.data) {
          const conflictUserIds = new Set();
          deviceConflicts.data.forEach((conflict: any) => {
            if (conflict.users && Array.isArray(conflict.users)) {
              conflict.users.forEach((user: any) => {
                conflictUserIds.add(user._id);
              });
            }
          });

          // Mark users with device conflicts
          this.users = this.users.map(user => ({
            ...user,
            isDeviceBlocked: conflictUserIds.has(user._id)
          }));
        }
      } catch (conflictError) {
        console.error('Error loading device conflicts:', conflictError);
        // Continue without marking conflicts if there's an error
      }

      this.applyFilters();
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to load users. Please try again.';
      this.presentToast(errorMessage, 'danger');
      console.error('Error loading users:', error);
      this.users = [];
      this.applyFilters();
    } finally {
      this.isLoading = false;
    }
  }

  applyFilters() {
    let result = [...this.users];

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(user => 
        (user.fullName?.toLowerCase().includes(query)) ||
        (user.email?.toLowerCase().includes(query)) ||
        (user.mobile?.includes(query))
      );
    }

    // Apply status filter
    if (this.filterStatus !== 'all') {
      const now = new Date();
      result = result.filter(user => {
        switch (this.filterStatus) {
          case 'subscribed':
            if (!user.activePlan || !user.planExpiry) return false;
            const expiryDate = user.planExpiry instanceof Date ? user.planExpiry : new Date(user.planExpiry);
            return expiryDate > now;
          case 'unsubscribed':
            if (!user.activePlan || !user.planExpiry) return true;
            const expiryDate2 = user.planExpiry instanceof Date ? user.planExpiry : new Date(user.planExpiry);
            return expiryDate2 <= now;
          case 'live':
            // Live users are active and not blocked
            return !user.isBlocked && user.activePlan && user.planExpiry;
          default:
            return true;
        }
      });
    }

    // Apply device conflicts filter
    if (this.showDeviceConflicts) {
      result = result.filter(user => user.isDeviceBlocked === true);
      this.deviceConflictUsers = result;
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (this.sortField) {
        case 'name':
          aVal = a.fullName || '';
          bVal = b.fullName || '';
          break;
        case 'email':
          aVal = a.email || '';
          bVal = b.email || '';
          break;
        case 'status':
          aVal = a.isBlocked ? 'blocked' : (a.activePlan ? 'subscribed' : 'unsubscribed');
          bVal = b.isBlocked ? 'blocked' : (b.activePlan ? 'subscribed' : 'unsubscribed');
          break;
        case 'createdAt':
        default:
          const aDate = a.createdAt instanceof Date ? a.createdAt : (a.createdAt ? new Date(a.createdAt) : null);
          const bDate = b.createdAt instanceof Date ? b.createdAt : (b.createdAt ? new Date(b.createdAt) : null);
          aVal = aDate ? aDate.getTime() : 0;
          bVal = bDate ? bDate.getTime() : 0;
          break;
      }

      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    this.filteredUsers = result;
  }

  onSearch() {
    this.applyFilters();
  }

  onFilterChange() {
    this.applyFilters();
  }

  onSort(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  toggleUserSelection(userId: string) {
    const index = this.selectedUsers.indexOf(userId);
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
    } else {
      this.selectedUsers.push(userId);
    }
  }

  selectAll() {
    if (this.selectedUsers.length === this.filteredUsers.length) {
      this.selectedUsers = [];
    } else {
      this.selectedUsers = this.filteredUsers.map(u => u._id!).filter(id => id);
    }
  }

  clearSelection() {
    this.selectedUsers = [];
  }

  isSelected(userId: string): boolean {
    return this.selectedUsers.includes(userId);
  }

  async addUser() {
    const modal = await this.modalController.create({
      component: UserFormModalComponent,
      componentProps: {}
    });

    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.success) {
        this.loadUsers();
      }
    });

    return await modal.present();
  }

  async editUser(user: User) {
    const modal = await this.modalController.create({
      component: UserFormModalComponent,
      componentProps: { user }
    });

    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.success) {
        this.loadUsers();
      }
    });

    return await modal.present();
  }

  async viewUserDetails(user: User) {
    const modal = await this.modalController.create({
      component: UserDetailsModalComponent,
      componentProps: { user }
    });

    modal.onDidDismiss().then((data) => {
      if (data.data && data.data.refresh) {
        this.loadUsers();
      }
    });

    return await modal.present();
  }

  async deleteUser(user: User) {
    if (!user._id) {
      this.presentToast('Invalid user', 'danger');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Are you sure you want to delete ${user.fullName || user.email || user.mobile}? This action cannot be undone.`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Deleting user...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              await this.usersService.deleteUser(user._id!).toPromise();
              loading.dismiss();
              this.presentToast('User deleted successfully', 'success');
              this.loadUsers();
            } catch (error: any) {
              loading.dismiss();
              const errorMessage = error?.message || 'Failed to delete user. Please try again.';
              this.presentToast(errorMessage, 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async blockUser(user: User) {
    if (!user._id) {
      this.presentToast('Invalid user', 'danger');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Blocking user...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await this.usersService.blockUser(user._id!).toPromise();
      loading.dismiss();
      this.presentToast('User blocked successfully', 'success');
      this.loadUsers();
    } catch (error: any) {
      loading.dismiss();
      const errorMessage = error?.message || 'Failed to block user. Please try again.';
      this.presentToast(errorMessage, 'danger');
    }
  }

  async unblockUser(user: User) {
    if (!user._id) {
      this.presentToast('Invalid user', 'danger');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Unblocking user...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      await this.usersService.unblockUser(user._id!).toPromise();
      loading.dismiss();
      this.presentToast('User unblocked successfully', 'success');
      this.loadUsers();
    } catch (error: any) {
      loading.dismiss();
      const errorMessage = error?.message || 'Failed to unblock user. Please try again.';
      this.presentToast(errorMessage, 'danger');
    }
  }

  async bulkBlockUsers() {
    if (this.selectedUsers.length === 0) {
      this.presentToast('Please select users to block', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirm Block',
      message: `Block ${this.selectedUsers.length} selected user(s)?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Block',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Blocking users...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              const results: PromiseSettledResult<unknown>[] = await Promise.allSettled(
                this.selectedUsers.map(id => this.usersService.blockUser(id).toPromise())
              );
              
              const successful = results.filter((r): r is PromiseFulfilledResult<unknown> => r.status === 'fulfilled').length;
              const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').length;
              
              loading.dismiss();
              
              if (successful > 0) {
                this.presentToast(`${successful} user(s) blocked successfully`, 'success');
              }
              if (failed > 0) {
                this.presentToast(`Failed to block ${failed} user(s)`, 'warning');
              }
              
              this.clearSelection();
              this.loadUsers();
            } catch (error: any) {
              loading.dismiss();
              const errorMessage = error?.message || 'Failed to block users. Please try again.';
              this.presentToast(errorMessage, 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async bulkUnblockUsers() {
    if (this.selectedUsers.length === 0) {
      this.presentToast('Please select users to unblock', 'warning');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Unblocking users...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const results: PromiseSettledResult<unknown>[] = await Promise.allSettled(
        this.selectedUsers.map(id => this.usersService.unblockUser(id).toPromise())
      );
      
      const successful = results.filter((r): r is PromiseFulfilledResult<unknown> => r.status === 'fulfilled').length;
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').length;
      
      loading.dismiss();
      
      if (successful > 0) {
        this.presentToast(`${successful} user(s) unblocked successfully`, 'success');
      }
      if (failed > 0) {
        this.presentToast(`Failed to unblock ${failed} user(s)`, 'warning');
      }
      
      this.clearSelection();
      this.loadUsers();
    } catch (error: any) {
      loading.dismiss();
      const errorMessage = error?.message || 'Failed to unblock users. Please try again.';
      this.presentToast(errorMessage, 'danger');
    }
  }

  async bulkDeleteUsers() {
    if (this.selectedUsers.length === 0) {
      this.presentToast('Please select users to delete', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Confirm Delete',
      message: `Delete ${this.selectedUsers.length} selected user(s)? This action cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Deleting users...',
              spinner: 'crescent'
            });
            await loading.present();

            try {
              const results: PromiseSettledResult<unknown>[] = await Promise.allSettled(
                this.selectedUsers.map(id => this.usersService.deleteUser(id).toPromise())
              );
              
              const successful = results.filter((r): r is PromiseFulfilledResult<unknown> => r.status === 'fulfilled').length;
              const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').length;
              
              loading.dismiss();
              
              if (successful > 0) {
                this.presentToast(`${successful} user(s) deleted successfully`, 'success');
              }
              if (failed > 0) {
                this.presentToast(`Failed to delete ${failed} user(s)`, 'warning');
              }
              
              this.clearSelection();
              this.loadUsers();
            } catch (error: any) {
              loading.dismiss();
              const errorMessage = error?.message || 'Failed to delete users. Please try again.';
              this.presentToast(errorMessage, 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async openBulkUpload(type: 'subscriptions' | 'users') {
    const modal = await this.modalController.create({
      component: BulkUploadModalComponent,
      componentProps: { uploadType: type }
    });

    modal.onDidDismiss().then((data) => {
      if (data.data && (data.data.success || data.data.refresh)) {
        this.loadUsers();
      }
    });

    return await modal.present();
  }

  async exportUsers() {
    const loading = await this.loadingController.create({
      message: 'Exporting users...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const blob = await this.usersService.exportUsers().toPromise();
      if (blob && blob.size > 0) {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `users-export-${new Date().getTime()}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        loading.dismiss();
        this.presentToast('Users exported successfully', 'success');
      } else {
        loading.dismiss();
        this.presentToast('Failed to export users - no data received', 'danger');
      }
    } catch (error: any) {
      loading.dismiss();
      const errorMessage = error?.message || 'Failed to export users. Please try again.';
      this.presentToast(errorMessage, 'danger');
    }
  }

  async toggleDeviceConflicts() {
    this.showDeviceConflicts = !this.showDeviceConflicts;
    
    if (this.showDeviceConflicts) {
      // Load device conflicts when toggled on
      await this.loadDeviceConflicts();
    } else {
      // Clear device conflicts when toggled off
      this.deviceConflictUsers = [];
      this.applyFilters();
    }
  }

  async loadDeviceConflicts() {
    try {
      const response = await this.usersService.getDeviceConflicts().toPromise();
      
      if (response && response.success && response.data) {
        // Flatten the conflicts array to get all users with conflicts
        const allConflictUsers: any[] = [];
        response.data.forEach((conflict: any) => {
          if (conflict.users && Array.isArray(conflict.users)) {
            conflict.users.forEach((user: any) => {
              allConflictUsers.push({
                ...user,
                conflictType: conflict.conflictType,
                deviceId: conflict.deviceId
              });
            });
          }
        });
        
        this.deviceConflictUsers = allConflictUsers.map(user => this.mapConflictUser(user));
      } else {
        this.deviceConflictUsers = [];
      }
    } catch (error: any) {
      console.error('Error loading device conflicts:', error);
      this.deviceConflictUsers = [];
      const errorMessage = error?.message || 'Failed to load device conflicts.';
      this.presentToast(errorMessage, 'warning');
    }
  }

  private mapConflictUser(user: any): User {
    return {
      _id: user._id,
      mobile: user.mobile || '',
      fullName: user.fullName || '',
      email: user.email || '',
      deviceId: user.deviceId,
      lastDeviceLogin: user.lastDeviceLogin ? new Date(user.lastDeviceLogin) : undefined,
      isBlocked: user.isBlocked || false,
      activePlan: user.activePlan,
      planExpiry: user.planExpiry ? new Date(user.planExpiry) : undefined,
      createdAt: user.createdAt ? new Date(user.createdAt) : undefined,
      updatedAt: user.updatedAt ? new Date(user.updatedAt) : undefined
    };
  }

  async allowNewDevice(userId: string) {
    const loading = await this.loadingController.create({
      message: 'Allowing new device...'
    });
    await loading.present();

    try {
      await this.usersService.allowNewDevice(userId).toPromise();
      this.presentToast('New device access granted', 'success');
      this.loadUsers();
    } catch (error) {
      this.presentToast('Failed to allow new device', 'danger');
    } finally {
      await loading.dismiss();
    }
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color
    });
    toast.present();
  }

  getStatusBadge(user: User): { text: string; color: string } {
    if (user.isBlocked) {
      return { text: 'Blocked', color: 'danger' };
    }
    if (user.isDeviceBlocked) {
      return { text: 'Device Blocked', color: 'warning' };
    }
    if (this.isPlanActive(user)) {
      return { text: 'Subscribed', color: 'success' };
    }
    return { text: 'Unsubscribed', color: 'medium' };
  }

  isPlanActive(user: User): boolean {
    if (!user.activePlan || !user.planExpiry) {
      return false;
    }
    const expiryDate = user.planExpiry instanceof Date ? user.planExpiry : new Date(user.planExpiry);
    return expiryDate > new Date();
  }
}
