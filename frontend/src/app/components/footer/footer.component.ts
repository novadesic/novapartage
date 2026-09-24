import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <footer class="bg-light text-secondary py-2 border-top">
      <div class="container">
        <div class="row">
          <div class="col text-center">
            <small> 
            <strong>Partagez des données, pas vos fichiers</strong></small>
          
            <br>
            <small>
            Une application développée par <a href="https://www.novadesic.com" target="_blank" class="text-secondary">Novadesic</a> &copy; {{ currentYear }} -
              <a routerLink="/mentions-legales" class="text-secondary">Mentions légales</a> -
              <a routerLink="/conditions-utilisation" class="text-secondary">Conditions d'utilisation</a> -
              <a routerLink="/politique-confidentialite" class="text-secondary">Politique de confidentialité</a>
              
            </small>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    footer {
      margin-top: auto;
    }
    
    footer small {
      opacity: 0.8;
    }
    
    footer a {
      text-decoration: none;
    }
    
    footer a:hover {
      text-decoration: underline;
    }
  `]
})
export class FooterComponent {
  currentYear = new Date().getFullYear();
  originUrl = window.location.origin;
} 