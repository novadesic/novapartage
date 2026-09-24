import { Routes } from '@angular/router';
import { NewShareComponent } from './new-share.component';

export const newShareRoutes: Routes = [
  {
    path: '',
    component: NewShareComponent
  },
  {
    path: ':id',
    component: NewShareComponent
  }
]; 