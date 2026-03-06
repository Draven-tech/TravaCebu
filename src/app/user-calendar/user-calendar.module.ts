import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { UserCalendarPageRoutingModule } from './user-calendar-routing.module';

import { UserCalendarPage } from './user-calendar.page';
import { ComponentsModule } from '../components/components.module';
import { MyItinerariesPageModule } from '../my-itineraries/my-itineraries.module';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    UserCalendarPageRoutingModule,
    ComponentsModule,
    MyItinerariesPageModule
  ],
  declarations: [UserCalendarPage]
})
export class UserCalendarPageModule {}
