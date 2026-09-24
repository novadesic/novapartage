import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ShareDetailComponent } from './share-detail.component';
import { shareDetailRoutes } from './share-detail.routes';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule.forChild(shareDetailRoutes),
    ShareDetailComponent
  ]
})
export class ShareDetailModule { } 