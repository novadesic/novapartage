import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HomeComponent } from './home.component';
import { RouterModule } from '@angular/router';
import { homeRoutes } from './home.routes';
import { SharesListComponent } from '../shares-list/shares-list.component';

@NgModule({
  imports: [CommonModule, RouterModule.forChild(homeRoutes), HomeComponent, SharesListComponent],
  exports: [HomeComponent]
})
export class HomeModule {} 