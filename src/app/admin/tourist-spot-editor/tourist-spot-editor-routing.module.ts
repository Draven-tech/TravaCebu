import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TouristSpotEditorPage } from './tourist-spot-editor.page';

const routes: Routes = [
  {
    path: '',
    component: TouristSpotEditorPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TouristSpotEditorPageRoutingModule {}
