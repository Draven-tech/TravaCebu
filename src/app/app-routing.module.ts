// app-routing.module.ts
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
const routes: Routes = [
  {
    path: '',
    redirectTo: 'welcome',
    pathMatch: 'full'
  },
  {
    path: 'welcome',
    loadChildren: () => import('./welcome/welcome.module').then(m => m.WelcomePageModule),
    canActivate: [ AuthGuard ]
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule),

  },
  {
    path: 'register',
    loadChildren: () => import('./register/register.module').then(m => m.RegisterPageModule),
    canActivate: [ AuthGuard ]
  },
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then(m => m.LoginPageModule),
    canActivate: [ AuthGuard ]
  },
  {
    path: 'user-dashboard',
    loadChildren: () => import('./user-dashboard/user-dashboard.module').then(m => m.UserDashboardPageModule)
  },
  {
    path: 'user-dashboard/:uid',
    loadChildren: () => import('./user-dashboard/user-dashboard.module').then(m => m.UserDashboardPageModule)
  },
  {
    path: 'bucket-list',
    loadChildren: () => import('./bucket-list/bucket-list.module').then(m => m.BucketListPageModule)
  },
  {
    path: 'user-map',
    loadChildren: () => import('./user-map/user-map.module').then( m => m.UserMapPageModule)
  },
  {
    path: 'tourist-spot-detail/:id',
    loadChildren: () => import('./tourist-spot-detail/tourist-spot-detail.module').then( m => m.TouristSpotDetailPageModule)
  },
  {
    path: 'user-profile',
    loadChildren: () => import('./user-profile/user-profile.module').then( m => m.UserProfilePageModule)
  },
  {
    path: 'terms',
    loadChildren: () => import('./terms/terms.module').then(m => m.TermsPageModule)
  },
  {
    path: 'privacy',
    loadChildren: () => import('./privacy/privacy.module').then(m => m.PrivacyPageModule)
  },
  {
    path: 'user-calendar',
    loadChildren: () => import('./user-calendar/user-calendar.module').then( m => m.UserCalendarPageModule)
  },
  {
    path: 'my-itineraries',
    loadChildren: () => import('./my-itineraries/my-itineraries.module').then( m => m.MyItinerariesPageModule)
  },

];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { 
      preloadingStrategy: PreloadAllModules,
      enableTracing: false
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}