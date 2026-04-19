import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastController, LoadingController, ModalController } from '@ionic/angular';
import { UserService, UserFilters } from '../services/user.service';
import { NotificationService } from '../services/notification.service';
import { User } from './notifications.types';
import { DatePickerModalComponent } from './date-picker.modal';

@Component({
  selector: 'app-user-selection',
  templateUrl: './user-selection.page.html',
  styleUrls: ['./user-selection.page.scss'],
  standalone: false
})
export class UserSelectionPage implements OnInit {
  users: User[] = [];
  selectedUsers: User[] = [];
  filteredUsers: User[] = [];
  
  // Filters
  filters: UserFilters = {
    page: 1,
    limit: 50,
    search: '',
    isBlocked: undefined,
    hasActivePlan: undefined,
    planExpiryStart: undefined,
    planExpiryEnd: undefined,
    sortBy: 'createdAt',
    order: 'desc'
  };

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalCount = 0;
  limit = 50;

  // UI State
  isLoading = false;
  searchQuery = '';
  showFilters = true;

  // Notification form properties
  notificationForm!: FormGroup;
  isCreatingNotification = false;
  isSending = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private formBuilder: FormBuilder,
    private userService: UserService,
    private notificationService: NotificationService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private modalController: ModalController
  ) {}

  ngOnInit() {
    // Get selected users and notification data from route state
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || window.history.state || {};
    if (state.selectedUsers) {
      this.selectedUsers = state.selectedUsers;
    }
    // Store notification data for returning
    this.notificationData = state.notificationData;
    this.isEditMode = state.isEditMode || false;
    this.notificationId = state.notificationId;
    
    // Check if we're creating a new notification or sending an existing draft
    this.isCreatingNotification = state.isCreatingNotification || false;
    this.isSendingDraft = !!state.isSendingDraft && !!state.notificationId;

    // Initialize notification form if creating or sending draft
    if (this.isCreatingNotification || this.isSendingDraft) {
      this.initializeNotificationForm();
      if (this.isSendingDraft && state.notificationData) {
        this.notificationForm.patchValue(state.notificationData);
        this.notificationForm.disable(); // View only when sending draft
      }
    }

    this.loadUsers();
  }

  isSendingDraft = false;

  notificationData: any = null;
  isEditMode = false;
  notificationId?: string;

  async loadUsers() {
    this.isLoading = true;
    
    try {
      const response = await this.userService.getUsersWithFilters(this.filters).toPromise();
      
      if (response) {
        this.users = response.users;
        this.filteredUsers = [...this.users];
        this.currentPage = response.page;
        this.totalPages = response.totalPages;
        this.totalCount = response.count;
        this.limit = response.limit;

        // Restore selection state
        this.restoreSelection();
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      this.presentToast(error.message || 'Failed to load users', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  restoreSelection() {
    // Keep all selected users; refresh their data if they appear on current page
    this.selectedUsers = this.selectedUsers.map(selected => {
      const inPage = this.users.find(u => u._id === selected._id);
      return inPage ?? selected;
    });
  }

  onSearch() {
    this.filters.search = this.searchQuery;
    this.filters.page = 1;
    this.currentPage = 1;
    this.loadUsers();
  }

  onFilterChange() {
    this.filters.page = 1;
    this.currentPage = 1;
    this.loadUsers();
  }

  toggleUserSelection(user: User) {
    const index = this.selectedUsers.findIndex(u => u._id === user._id);
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
    } else {
      this.selectedUsers.push(user);
    }
  }

  isUserSelected(userId: string): boolean {
    return this.selectedUsers.some(u => u._id === userId);
  }

  selectAllFiltered() {
    const newSelections = this.users.filter(user => 
      !this.selectedUsers.some(selected => selected._id === user._id)
    );
    this.selectedUsers = [...this.selectedUsers, ...newSelections];
  }

  selectAll() {
    // Load all pages and select all users
    // For now, select all filtered users
    this.selectAllFiltered();
  }

  clearAll() {
    this.selectedUsers = [];
  }

  removeUser(user: User) {
    const index = this.selectedUsers.findIndex(u => u._id === user._id);
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
    }
  }

  onPageChange(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.filters.page = page;
      this.currentPage = page;
      this.loadUsers();
    }
  }

  initializeNotificationForm() {
    this.notificationForm = this.formBuilder.group({
      title: ['', [Validators.required, Validators.maxLength(200)]],
      message: ['', [Validators.required, Validators.maxLength(1000)]],
      type: ['INFO', Validators.required]
    });
  }

  async saveAsDraft() {
    if (this.notificationForm.invalid) {
      this.markFormGroupTouched(this.notificationForm);
      this.presentToast('Please fill title and message to save as draft', 'warning');
      return;
    }

    this.isSending = true;
    const loading = await this.loadingController.create({
      message: 'Saving draft...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const notificationData = {
        title: this.notificationForm.value.title,
        message: this.notificationForm.value.message,
        type: this.notificationForm.value.type
      };
      await this.notificationService.createNotification(notificationData).toPromise();
      await loading.dismiss();
      this.isSending = false;
      this.presentToast('Draft saved successfully', 'success');
      this.router.navigate(['/notifications']);
    } catch (error: any) {
      await loading.dismiss();
      this.isSending = false;
      this.presentToast(error?.message || 'Failed to save draft', 'danger');
      console.error('Error saving draft:', error);
    }
  }

  async createAndSendNotification() {
    // Sending an existing draft: only need users and notificationId
    if (this.isSendingDraft && this.notificationId) {
      if (this.selectedUsers.length === 0) {
        this.presentToast('Please select at least one user', 'warning');
        return;
      }
      this.isSending = true;
      const loading = await this.loadingController.create({
        message: 'Sending notification...',
        spinner: 'crescent'
      });
      await loading.present();
      try {
        const userIds = this.selectedUsers.map(u => u._id);
        const sendResponse = await this.notificationService.sendNotificationToUsers({
          notificationId: this.notificationId,
          userIds,
          sendTo: 'CUSTOM'
        }).toPromise();
        await loading.dismiss();
        this.isSending = false;
        this.presentToast(`Notification sent successfully to ${sendResponse?.sentCount || 0} user(s)`, 'success');
        this.router.navigate(['/notifications']);
      } catch (error: any) {
        await loading.dismiss();
        this.isSending = false;
        this.presentToast(error?.message || 'Failed to send notification', 'danger');
        console.error('Error sending notification:', error);
      }
      return;
    }

    // Create new and send
    if (this.notificationForm.invalid) {
      this.markFormGroupTouched(this.notificationForm);
      this.presentToast('Please fill all required fields correctly', 'warning');
      return;
    }
    if (this.selectedUsers.length === 0) {
      this.presentToast('Please select at least one user', 'warning');
      return;
    }

    this.isSending = true;
    const loading = await this.loadingController.create({
      message: 'Creating and sending notification...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const notificationData = {
        title: this.notificationForm.value.title,
        message: this.notificationForm.value.message,
        type: this.notificationForm.value.type
      };
      const createdNotification = await this.notificationService.createNotification(notificationData).toPromise();
      if (!createdNotification || !createdNotification._id) {
        throw new Error('Failed to create notification');
      }
      const userIds = this.selectedUsers.map(u => u._id);
      const sendResponse = await this.notificationService.sendNotificationToUsers({
        notificationId: createdNotification._id,
        userIds,
        sendTo: 'CUSTOM'
      }).toPromise();
      await loading.dismiss();
      this.isSending = false;
      this.presentToast(`Notification sent successfully to ${sendResponse?.sentCount || 0} user(s)`, 'success');
      this.router.navigate(['/notifications']);
    } catch (error: any) {
      await loading.dismiss();
      this.isSending = false;
      this.presentToast(error?.message || 'Failed to create and send notification', 'danger');
      console.error('Error creating and sending notification:', error);
    }
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  confirmSelection() {
    // If creating notification or sending draft, use createAndSendNotification
    if (this.isCreatingNotification || this.isSendingDraft) {
      this.createAndSendNotification();
      return;
    }

    // Navigate back to notifications page with selected users and notification data
    // The notifications page will reopen the modal with the selected users
    this.router.navigate(['/notifications'], {
      state: { 
        selectedUsers: this.selectedUsers,
        notificationData: this.notificationData,
        isEditMode: this.isEditMode,
        notificationId: this.notificationId,
        returnFromUserSelection: true,
        reopenModal: true // Flag to reopen modal
      }
    });
  }

  cancel() {
    this.router.navigate(['/notifications']);
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    toast.present();
  }

  getSelectedCount(): number {
    return this.selectedUsers.length;
  }

  async openDatePicker(type: 'start' | 'end') {
    const currentValue = type === 'start' ? this.filters.planExpiryStart : this.filters.planExpiryEnd;
    
    const modal = await this.modalController.create({
      component: DatePickerModalComponent,
      componentProps: {
        value: currentValue,
        type: type
      },
      cssClass: 'date-picker-modal'
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data && data.value) {
      if (type === 'start') {
        this.filters.planExpiryStart = data.value;
      } else {
        this.filters.planExpiryEnd = data.value;
      }
      this.onFilterChange();
    }
  }

  formatDate(date: string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  toggleSortOrder() {
    this.filters.order = this.filters.order === 'asc' ? 'desc' : 'asc';
    this.onFilterChange();
  }
}

