import { Component, Input, OnInit } from '@angular/core';
import { ModalController, ToastController, LoadingController } from '@ionic/angular';
import { UsersService } from './users.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-bulk-upload',
  templateUrl: './bulk-upload.modal.html',
  styleUrls: ['./bulk-upload.modal.scss'],
  standalone: false
})
export class BulkUploadModalComponent implements OnInit {
  @Input() uploadType: 'subscriptions' | 'users' = 'users';
  selectedFile: File | null = null;
  uploadProgress: number = 0;
  isUploading: boolean = false;
  fileInputElement: HTMLInputElement | null = null;
  uploadResult: any = null;
  showResults: boolean = false;

  constructor(
    private modalController: ModalController,
    private usersService: UsersService,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    // Create file input element
    this.fileInputElement = document.createElement('input');
    this.fileInputElement.type = 'file';
    this.fileInputElement.accept = '.xlsx,.xls';
    this.fileInputElement.style.display = 'none';
    this.fileInputElement.addEventListener('change', (e: any) => this.onFileSelected(e));
    document.body.appendChild(this.fileInputElement);
  }

  selectFile() {
    this.fileInputElement?.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const validExtensions = ['.xlsx', '.xls'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!validExtensions.includes(fileExtension)) {
        this.presentToast('Please select an Excel file (.xlsx or .xls)', 'danger');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.presentToast('File size must be less than 5MB', 'danger');
        return;
      }

      this.selectedFile = file;
    }
  }

  async uploadFile() {
    if (!this.selectedFile) {
      this.presentToast('Please select a file', 'warning');
      return;
    }

    this.isUploading = true;
    const loading = await this.loadingController.create({
      message: `Uploading ${this.uploadType === 'subscriptions' ? 'subscriptions' : 'users'}...`
    });
    await loading.present();

    try {
      let response: any;
      if (this.uploadType === 'subscriptions') {
        response = await this.usersService.bulkUploadSubscriptions(this.selectedFile!).toPromise();
      } else {
        response = await this.usersService.bulkCreateUsers(this.selectedFile!).toPromise();
      }

      // Store the full response
      this.uploadResult = response;
      this.showResults = true;
      
      // Show summary toast
      const summary = response.summary || {};
      if (this.uploadType === 'subscriptions') {
        const successCount = summary.successCount || 0;
        const failedCount = summary.failedCount || 0;
        if (successCount > 0) {
          this.presentToast(
            `Successfully assigned ${successCount} subscription(s)${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
            failedCount > 0 ? 'warning' : 'success'
          );
        } else {
          this.presentToast('No subscriptions were assigned. Check failed rows for details.', 'warning');
        }
      } else {
        const created = summary.created || 0;
        const skipped = summary.skipped || 0;
        const failed = summary.failed || 0;
        if (created > 0) {
          this.presentToast(
            `Created ${created} user(s)${skipped > 0 ? `, ${skipped} skipped` : ''}${failed > 0 ? `, ${failed} failed` : ''}`,
            failed > 0 || skipped > 0 ? 'warning' : 'success'
          );
        } else {
          this.presentToast('No users were created. Check failed rows for details.', 'warning');
        }
      }
    } catch (error: any) {
      const errorMessage = error?.error?.message || error?.message || `Failed to upload ${this.uploadType}`;
      this.presentToast(errorMessage, 'danger');
    } finally {
      this.isUploading = false;
      await loading.dismiss();
    }
  }

  closeResults() {
    // Dismiss modal with refresh flag to reload user list
    this.modalController.dismiss({ refresh: true });
  }

  uploadAnother() {
    // Reset to file selection state
    this.selectedFile = null;
    this.uploadResult = null;
    this.showResults = false;
    if (this.fileInputElement) {
      this.fileInputElement.value = '';
    }
  }

  cancel() {
    this.modalController.dismiss();
  }

  async presentToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color
    });
    toast.present();
  }

  getUploadTypeLabel(): string {
    return this.uploadType === 'subscriptions' ? 'Bulk Subscription Access' : 'Bulk User Creation';
  }

  getUploadDescription(): string {
    return this.uploadType === 'subscriptions'
      ? 'Upload an Excel file to grant subscription access to multiple users'
      : 'Upload an Excel file to create multiple user accounts';
  }

  downloadTemplate() {
    let worksheet: XLSX.WorkSheet;
    let workbook: XLSX.WorkBook;
    let filename: string;

    if (this.uploadType === 'users') {
      // Bulk User Creation Template
      const data = [
        ['Full Name', 'Email', 'Mobile', 'WhatsApp'],
        ['John Doe', 'john.doe@example.com', '1234567890', '1234567890'],
        ['Jane Smith', 'jane.smith@example.com', '0987654321', '0987654321']
      ];
      
      worksheet = XLSX.utils.aoa_to_sheet(data);
      filename = 'bulk-user-creation-template.xlsx';
    } else {
      // Bulk Subscription Assignment Template
      const data = [
        ['Email', 'Mobile', 'Plan Code'],
        ['john.doe@example.com', '', 'PLAN001'],
        ['', '0987654321', 'PLAN002']
      ];
      
      worksheet = XLSX.utils.aoa_to_sheet(data);
      filename = 'bulk-subscription-template.xlsx';
    }

    // Set column widths for better readability
    const colWidths = this.uploadType === 'users' 
      ? [{ wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 }]
      : [{ wch: 30 }, { wch: 15 }, { wch: 15 }];
    worksheet['!cols'] = colWidths;

    // Create workbook and add worksheet
    workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, filename);
    
    this.presentToast('Template downloaded successfully', 'success');
  }
}

