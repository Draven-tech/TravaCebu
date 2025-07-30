import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

import { UserCalendarPageRoutingModule } from './user-calendar-routing.module';

import { UserCalendarPage } from './user-calendar.page';
import { BottomNavModule } from '../components/bottom-nav/bottom-nav.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FullCalendarModule,
    UserCalendarPageRoutingModule,
    BottomNavModule
  ],
  declarations: [UserCalendarPage]
})
export class UserCalendarPageModule {}
