import { Component, OnInit } from '@angular/core';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { LocalTipsService, PendingLocalTip } from '../../services/local-tips.service';

@Component({
  selector: 'app-pending-local-tips',
  templateUrl: './pending-local-tips.page.html',
  styleUrls: ['./pending-local-tips.page.scss'],
  standalone: false
})
export class PendingLocalTipsPage implements OnInit {
  pendingTips: PendingLocalTip[] = [];
  approvedTips: PendingLocalTip[] = [];
  rejectedTips: PendingLocalTip[] = [];
  selectedTab: 'pending' | 'approved' | 'rejected' = 'pending';
  isLoading = true;

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private authService: AuthService,
    private localTipsService: LocalTipsService
  ) {}

  async ngOnInit(): Promise<void> {
    const isAdmin = await this.authService.isAdmin();
    if (!isAdmin) {
      await this.showToast('Admin access required.', 'danger');
      this.navCtrl.navigateBack('/admin/login');
      return;
    }
    this.loadTips();
  }

  loadTips(): void {
    this.isLoading = true;

    this.localTipsService.getTipsByStatus('pending').subscribe({
      next: (tips) => {
        this.pendingTips = tips;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });

    this.localTipsService.getTipsByStatus('approved').subscribe((tips) => {
      this.approvedTips = tips;
    });

    this.localTipsService.getTipsByStatus('rejected').subscribe((tips) => {
      this.rejectedTips = tips;
    });
  }

  async approveTip(tip: PendingLocalTip): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Approve Local Tip',
      message: `Approve this tip for ${tip.spotName}?`,
      inputs: [
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Optional review notes'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Approve',
          handler: async (data) => {
            try {
              await this.localTipsService.approveTip(tip.id!, data.notes || '');
              await this.showToast('Tip approved successfully.', 'success');
            } catch (error: any) {
              await this.showToast(error?.message || 'Failed to approve tip.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async rejectTip(tip: PendingLocalTip): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Reject Local Tip',
      message: `Provide a reason for rejecting this tip for ${tip.spotName}.`,
      inputs: [
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Reason for rejection'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reject',
          handler: async (data) => {
            const notes = (data.notes || '').trim();
            if (!notes) {
              await this.showToast('Rejection reason is required.', 'warning');
              return false;
            }
            try {
              await this.localTipsService.rejectTip(tip.id!, notes);
              await this.showToast('Tip rejected.', 'warning');
            } catch (error: any) {
              await this.showToast(error?.message || 'Failed to reject tip.', 'danger');
            }
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async refreshData(event: any): Promise<void> {
    this.loadTips();
    event.target.complete();
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
