import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController, NavController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Notification, User } from './notifications.types';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-notification-form',
  templateUrl: './notification-form.modal.html',
  styleUrls: ['./notification-form.modal.scss'],
  standalone: false
})
export class NotificationFormModalComponent implements OnInit {
  @Input() notification?: Notification;
  @Input() initialSelectedUsers?: User[];
  @Input() notificationData?: any;
  notificationForm: FormGroup;
  isEditMode: boolean = false;
  selectedUsers: User[] = [];

  constructor(
    private modalController: ModalController,
    private formBuilder: FormBuilder,
    private toastController: ToastController,
    private userService: UserService,
    private navController: NavController
  ) {
    this.notificationForm = this.formBuilder.group({
      title: ['', [Validators.required, Validators.maxLength(200)]],
      message: ['', [Validators.required, Validators.maxLength(1000)]],
      type: ['INFO', Validators.required],
      status: ['DRAFT', Validators.required],
      targetUsers: [[]]
    });
  }

  ngOnInit() {
    // Initialize selected users from input or empty array
    if (this.initialSelectedUsers) {
      this.selectedUsers = [...this.initialSelectedUsers];
    } else {
      this.selectedUsers = [];
    }

    // Load notification data if editing
    if (this.notification) {
      this.isEditMode = true;
      this.loadNotificationData();
    } else if (this.notificationData) {
      // Load from notificationData if provided
      this.notificationForm.patchValue(this.notificationData);
      if (this.notificationData.targetUsers && this.selectedUsers.length === 0) {
        // If we have targetUsers but no selectedUsers, we need to load them
        // This will be handled when user selects users
      }
    }
  }

  ionViewWillEnter() {
    // Check for selected users from navigation state when returning from user selection
    const state = window.history.state;
    if (state?.selectedUsers && state?.returnFromUserSelection) {
      this.selectedUsers = state.selectedUsers;
      this.updateTargetUsers();
      // Clear the state to prevent reusing it
      window.history.replaceState({}, '');
    }
  }

  openUserSelection() {
    // Navigate to user selection page with current selected users
    this.modalController.dismiss({ action: 'selectUsers', selectedUsers: this.selectedUsers });
    this.navController.navigateForward('/notifications/select-users', {
      state: {
        selectedUsers: this.selectedUsers,
        notificationData: this.notificationForm.value,
        isEditMode: this.isEditMode,
        notificationId: this.notification?._id
      }
    });
  }

  loadNotificationData() {
    const notification = this.notification!;
    
    // Selected users are loaded in loadUsers() after users are fetched
    // This ensures users are available before trying to match them

    this.notificationForm.patchValue({
      title: notification.title || '',
      message: notification.message || '',
      type: notification.type || 'INFO',
      status: notification.status || 'DRAFT',
      targetUsers: notification.targetUsers || []
    });
  }

  removeUser(user: User) {
    const index = this.selectedUsers.findIndex(u => u._id === user._id);
    if (index > -1) {
      this.selectedUsers.splice(index, 1);
      this.updateTargetUsers();
    }
  }

  updateTargetUsers() {
    this.notificationForm.patchValue({
      targetUsers: this.selectedUsers.map(u => u._id)
    });
  }

  isUserSelected(userId: string): boolean {
    return this.selectedUsers.some(u => u._id === userId);
  }

  async onSubmit() {
    if (this.notificationForm.valid) {
      const formData = {
        ...this.notificationForm.value,
        targetUsers: this.selectedUsers.map(u => u._id)
      };

      if (this.isEditMode && this.notification?._id) {
        formData._id = this.notification._id;
      }

      this.modalController.dismiss({ success: true, notification: formData });
    } else {
      this.markFormGroupTouched(this.notificationForm);
      this.presentToast('Please fill all required fields correctly', 'warning');
    }
  }

  cancel() {
    this.modalController.dismiss();
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  getTypeColor(type: string): string {
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

  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color
    });
    toast.present();
  }
}

