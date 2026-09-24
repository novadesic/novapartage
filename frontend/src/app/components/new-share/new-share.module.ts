import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NewShareComponent } from './new-share.component';
import { DestinatairesTabsComponent } from '../destinataires-tabs/destinataires-tabs.component';
import { TableauSelectionComponent } from '../tableau-selection/tableau-selection.component';
import { DestinatairesListComponent } from '../destinataires-list/destinataires-list.component';
import { FormConfiguratorComponent } from '../form-configurator/form-configurator.component';
import { FormsPreviewContainerComponent } from '../forms-preview-container/forms-preview-container.component';
import { newShareRoutes } from './new-share.routes';
import { LoggerService } from '../../services/logger.service';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(newShareRoutes),
    NewShareComponent
  ],
  exports: []
})
export class NewShareModule {
  constructor(private logger: LoggerService) {

  }
} 