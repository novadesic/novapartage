import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService, Theme } from '../../services/theme.service';

@Component({
  selector: 'app-theme-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dropdown" (click)="$event.stopPropagation()">
      <button class="btn btn-outline-secondary btn-sm dropdown-toggle" 
              type="button" 
              data-bs-toggle="dropdown" 
              aria-expanded="false"
              (click)="$event.stopPropagation()">
        <i class="bi bi-palette me-1"></i>
        Thème
      </button>
      <ul class="dropdown-menu">
        <li *ngFor="let theme of availableThemes">
          <button class="dropdown-item d-flex align-items-center" 
                  type="button"
                  [class.active]="theme.name === currentTheme"
                  (click)="onThemeChange(theme.name); $event.stopPropagation()">
            <i class="bi bi-circle me-2"></i>
            {{ theme.displayName }}
            <i *ngIf="theme.name === currentTheme" 
               class="bi bi-check ms-auto"></i>
          </button>
        </li>
      </ul>
    </div>
  `,
  styles: []
})
export class ThemeSelectorComponent implements OnInit {
  availableThemes: Theme[] = [];
  currentTheme: string = 'slate';

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.availableThemes = this.themeService.getAvailableThemes();
    this.currentTheme = this.themeService.getCurrentTheme();
  }

  onThemeChange(themeName: string): void {
    this.themeService.setTheme(themeName);
    this.currentTheme = themeName;
  }
} 