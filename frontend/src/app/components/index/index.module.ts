import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IndexComponent } from './index.component';
import { RouterModule } from '@angular/router';
import { indexRoutes } from './index.routes';
import { FooterComponent } from '../footer/footer.component';

@NgModule({
  declarations: [],
  imports: [CommonModule, RouterModule.forChild(indexRoutes), FooterComponent, IndexComponent],
  exports: []
})
export class IndexModule {} 