import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastController, LoadingController, AlertController } from '@ionic/angular';
import { SettingsService, Settings } from '../services/settings.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: false
})
export class SettingsPage implements OnInit {
  settingsForm: FormGroup;
  isLoading: boolean = false;
  isSaving: boolean = false;
  originalSettings: Settings | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private settingsService: SettingsService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {
    this.settingsForm = this.formBuilder.group({
      appName: ['', Validators.required],
      appDescription: [''],
      defaultNotificationTitle: ['', Validators.required],
      defaultNotificationMessage: ['', Validators.required],
      razorpayKeyId: [''],
      razorpayKeySecret: [''],
      maintenanceMode: [false],
      maintenanceMessage: [''],
      enableWhatsAppNotifications: [true],
      enableFirebaseNotifications: [true]
    });
  }

  ngOnInit() {
    this.loadSettings();
  }

  async loadSettings() {
    this.isLoading = true;
    
    try {
      const settings = await this.settingsService.getSettings().toPromise();
      
      if (!settings) {
        throw new Error('No settings data received');
      }
      
      this.originalSettings = settings;
      
      // Populate form with settings
      this.settingsForm.patchValue({
        appName: settings.appName || '',
        appDescription: settings.appDescription || '',
        defaultNotificationTitle: settings.defaultNotificationTitle || '',
        defaultNotificationMessage: settings.defaultNotificationMessage || '',
        razorpayKeyId: settings.razorpayKeyId || '',
        razorpayKeySecret: '', // Don't populate secret field
        maintenanceMode: settings.maintenanceMode || false,
        maintenanceMessage: settings.maintenanceMessage || '',
        enableWhatsAppNotifications: settings.enableWhatsAppNotifications !== false,
        enableFirebaseNotifications: settings.enableFirebaseNotifications !== false
      });
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to load settings. Please try again.';
      this.presentToast(errorMessage, 'danger');
      console.error('Error loading settings:', error);
    } finally {
      this.isLoading = false;
    }
  }

  async saveSettings() {
    if (this.settingsForm.invalid) {
      this.presentToast('Please fill in all required fields', 'warning');
      return;
    }

    this.isSaving = true;
    const loading = await this.loadingController.create({
      message: 'Saving settings...'
    });
    await loading.present();

    try {
      const formValue = this.settingsForm.value;
      
      // Only include razorpayKeySecret if it was changed (not empty)
      const updateData: any = {
        appName: formValue.appName,
        appDescription: formValue.appDescription,
        defaultNotificationTitle: formValue.defaultNotificationTitle,
        defaultNotificationMessage: formValue.defaultNotificationMessage,
        razorpayKeyId: formValue.razorpayKeyId,
        maintenanceMode: formValue.maintenanceMode,
        maintenanceMessage: formValue.maintenanceMessage,
        enableWhatsAppNotifications: formValue.enableWhatsAppNotifications,
        enableFirebaseNotifications: formValue.enableFirebaseNotifications
      };

      // Only update secret if a new value was provided
      if (formValue.razorpayKeySecret && formValue.razorpayKeySecret.trim() !== '') {
        updateData.razorpayKeySecret = formValue.razorpayKeySecret;
      }

      await this.settingsService.updateSettings(updateData).toPromise();
      
      await loading.dismiss();
      this.presentToast('Settings saved successfully', 'success');
      this.loadSettings(); // Reload to get updated settings
    } catch (error: any) {
      await loading.dismiss();
      const errorMessage = error?.message || 'Failed to save settings. Please try again.';
      this.presentToast(errorMessage, 'danger');
      console.error('Error saving settings:', error);
    } finally {
      this.isSaving = false;
    }
  }

  async resetSettings() {
    const alert = await this.alertController.create({
      header: 'Reset Settings',
      message: 'Are you sure you want to reset all settings to defaults? This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Reset',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Resetting settings...'
            });
            await loading.present();

            try {
              await this.settingsService.resetSettings().toPromise();
              await loading.dismiss();
              this.presentToast('Settings reset to defaults', 'success');
              this.loadSettings();
            } catch (error: any) {
              await loading.dismiss();
              const errorMessage = error?.message || 'Failed to reset settings. Please try again.';
              this.presentToast(errorMessage, 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
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
}
