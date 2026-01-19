import { Component, OnInit } from '@angular/core';
import { ToastController, LoadingController, AlertController } from '@ionic/angular';
import { LogsService, Log, LogsListParams } from '../services/logs.service';

@Component({
  selector: 'app-logs',
  templateUrl: './logs.page.html',
  styleUrls: ['./logs.page.scss'],
  standalone: false
})
export class LogsPage implements OnInit {
  logs: Log[] = [];
  filteredLogs: Log[] = [];
  isLoading: boolean = false;
  
  // Filters
  filters: LogsListParams = {
    page: 1,
    limit: 50,
    type: undefined,
    module: '',
    search: '',
    startDate: undefined,
    endDate: undefined,
    sortBy: 'createdAt',
    order: 'desc'
  };

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalCount = 0;
  limit = 50;

  // UI State
  showFilters = false;
  selectedLogs: string[] = [];

  constructor(
    private logsService: LogsService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadLogs();
  }

  ionViewWillEnter() {
    this.loadLogs();
  }

  async loadLogs() {
    this.isLoading = true;
    
    try {
      const response = await this.logsService.getLogs(this.filters).toPromise();
      
      if (response) {
        this.logs = response.data;
        this.filteredLogs = [...this.logs];
        this.currentPage = response.page;
        this.totalPages = response.totalPages;
        this.totalCount = response.total;
        this.limit = response.limit;
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to load logs. Please try again.';
      this.presentToast(errorMessage, 'danger');
      console.error('Error loading logs:', error);
      this.logs = [];
      this.filteredLogs = [];
    } finally {
      this.isLoading = false;
    }
  }

  onSearch() {
    this.filters.search = this.filters.search?.trim() || '';
    this.filters.page = 1;
    this.currentPage = 1;
    this.loadLogs();
  }

  onFilterChange() {
    this.filters.page = 1;
    this.currentPage = 1;
    this.loadLogs();
  }

  onPageChange(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.filters.page = page;
      this.currentPage = page;
      this.loadLogs();
    }
  }

  async deleteLog(logId: string) {
    const alert = await this.alertController.create({
      header: 'Delete Log',
      message: 'Are you sure you want to delete this log?',
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
              message: 'Deleting log...'
            });
            await loading.present();

            try {
              await this.logsService.deleteLog(logId).toPromise();
              await loading.dismiss();
              this.presentToast('Log deleted successfully', 'success');
              this.loadLogs();
            } catch (error: any) {
              await loading.dismiss();
              const errorMessage = error?.message || 'Failed to delete log. Please try again.';
              this.presentToast(errorMessage, 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async bulkDeleteLogs() {
    if (this.selectedLogs.length === 0) {
      this.presentToast('Please select logs to delete', 'warning');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Delete Logs',
      message: `Are you sure you want to delete ${this.selectedLogs.length} log(s)?`,
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
              message: 'Deleting logs...'
            });
            await loading.present();

            try {
              await this.logsService.bulkDeleteLogs(this.selectedLogs).toPromise();
              await loading.dismiss();
              this.presentToast(`${this.selectedLogs.length} log(s) deleted successfully`, 'success');
              this.selectedLogs = [];
              this.loadLogs();
            } catch (error: any) {
              await loading.dismiss();
              const errorMessage = error?.message || 'Failed to delete logs. Please try again.';
              this.presentToast(errorMessage, 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async clearAllLogs() {
    const alert = await this.alertController.create({
      header: 'Clear All Logs',
      message: 'Are you sure you want to delete all logs? This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear All',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingController.create({
              message: 'Clearing all logs...'
            });
            await loading.present();

            try {
              await this.logsService.clearAllLogs().toPromise();
              await loading.dismiss();
              this.presentToast('All logs cleared successfully', 'success');
              this.selectedLogs = [];
              this.loadLogs();
            } catch (error: any) {
              await loading.dismiss();
              const errorMessage = error?.message || 'Failed to clear logs. Please try again.';
              this.presentToast(errorMessage, 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  toggleLogSelection(logId: string) {
    const index = this.selectedLogs.indexOf(logId);
    if (index > -1) {
      this.selectedLogs.splice(index, 1);
    } else {
      this.selectedLogs.push(logId);
    }
  }

  isLogSelected(logId: string): boolean {
    return this.selectedLogs.includes(logId);
  }

  selectAll() {
    this.selectedLogs = this.logs.map(log => log._id);
  }

  clearSelection() {
    this.selectedLogs = [];
  }

  getLogTypeColor(type: string): string {
    switch (type) {
      case 'ERROR':
        return 'danger';
      case 'WARNING':
        return 'warning';
      case 'SUCCESS':
        return 'success';
      case 'INFO':
      default:
        return 'primary';
    }
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
