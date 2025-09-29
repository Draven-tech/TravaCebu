import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { RouteEditorMapPage } from './route-editor-map.page';

const routes: Routes = [
  {
    path: '',
    component: RouteEditorMapPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RouteEditorMapPageRoutingModule {}
