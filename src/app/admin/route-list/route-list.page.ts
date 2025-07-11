import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, ModalController, NavController } from '@ionic/angular';
import { RouteDetailPage } from '../route-detail/route-detail.page';
import { DatePipe } from '@angular/common';

@Component({
  standalone: false,
  selector: 'app-route-list',
  templateUrl: './route-list.page.html',
  styleUrls: ['./route-list.page.scss'],
})
export class RouteListPage implements OnInit {
  routes: any[] = [];
  isLoading = true;

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    public datePipe: DatePipe
  ) {}

  formatDate(date: any): string | null {
    return this.datePipe.transform(date, 'mediumDate');
  }

  ngOnInit() {
    this.loadRoutes();
  }

  loadRoutes() {
    this.isLoading = true;
    this.firestore.collection('jeepney_routes', ref => ref.orderBy('createdAt', 'desc'))
      .valueChanges({ idField: 'id' })
      .subscribe({
        next: (routes) => {
          this.routes = routes;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading routes:', err);
          this.isLoading = false;
        }
      });
  }

  refreshRoutes() {
    this.loadRoutes();
  }

  async openRouteDetail(routeData: any) {
    const modal = await this.modalCtrl.create({
      component: RouteDetailPage,
      componentProps: {
        route: routeData
      }
    });
    await modal.present();
  }

  editRoute(route: any) {
    this.navCtrl.navigateForward(['/admin/route-editor'], {
      state: { routeToEdit: route }
    });
  }

  navigateToEditor() {
    this.navCtrl.navigateForward('/admin/route-editor');
  }

  async deleteRoute(id: string) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this route?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: () => {
            this.firestore.collection('jeepney_routes').doc(id).delete()
              .then(() => {
                this.showAlert('Success', 'Route deleted successfully');
              })
              .catch(err => {
                this.showAlert('Error', 'Failed to delete route');
                console.error(err);
              });
          }
        }
      ]
    });
    await alert.present();
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}