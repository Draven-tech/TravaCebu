import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, ModalController } from '@ionic/angular';
import { RouteDetailPage } from '../route-detail/route-detail.page';

@Component({
  standalone: false,
  selector: 'app-route-list',
  templateUrl: './route-list.page.html',
  styleUrls: ['./route-list.page.scss'],
})
export class RouteListPage implements OnInit {
  routes: any[] = [];

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController
  ) {}

  ngOnInit() {
    this.firestore.collection('jeepney_routes').valueChanges({ idField: 'id' })
      .subscribe(routes => this.routes = routes);
  }

  async openRouteDetail(routeData: any) {
    const modal = await this.modalCtrl.create({
      component: RouteDetailPage,
      componentProps: {
        route: routeData
      }
    });
    return await modal.present();
  }

  async deleteRoute(id: string) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: 'Delete this route permanently?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          handler: () => this.firestore.collection('jeepney_routes').doc(id).delete()
        }
      ]
    });
    await alert.present();
  }
}