import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-mentions-legales',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container mt-4 mb-5">
      <div class="row justify-content-center">
        <div class="col-lg-8">
          <h1 class="mb-4">Mentions légales</h1>
          
          <div class="card shadow-sm">
            <div class="card-body">
              <h2 class="h4 mb-3">Éditeur du site</h2>
              <p><strong>Novadesic SAS</strong><br>
              Société par actions simplifiée (SAS)<br>
              Capital social : 2 500 euros<br>
              Immatriculée au Registre du Commerce et des Sociétés de Montpellier sous le numéro 901138248<br>
              Siège social : 7 RUE ISAAC NEWTON ZAE MAS DE KLE, BAT B, ETAGE 1<br>
              34110 FRONTIGNAN, France<br>
              N° de TVA intracommunautaire : FR21901138248<br>
              Email : contact&#64;novadesic.com</p>

              <h2 class="h4 mb-3 mt-4">Directeur de la publication</h2>
              <p>Le directeur de la publication est <strong>Soriano Mikaël</strong>, (Novadesic SAS).</p>

              <h2 class="h4 mb-3 mt-4">Hébergement</h2>
              <p>Ce site est hébergé par :<br>
              <strong>OVH</strong><br>
              2 rue Kellermann<br>
              59100 Roubaix, France<br>
              Téléphone : +33 (0)8 99 70 17 61</p>

              <h2 class="h4 mb-3 mt-4">Propriété intellectuelle</h2>
              <p>L'ensemble de ce site relève de la législation française et internationale sur le droit d'auteur et la propriété intellectuelle. Tous les droits de reproduction sont réservés, y compris pour les documents téléchargeables et les représentations iconographiques et photographiques.</p>
              <p>La reproduction de tout ou partie de ce site sur un support électronique quel qu'il soit est formellement interdite sauf autorisation expresse du directeur de la publication.</p>

              <h2 class="h4 mb-3 mt-4">Protection des données personnelles</h2>
              <p>Conformément à la loi Informatique et Libertés du 6 janvier 1978 modifiée et au Règlement Général sur la Protection des Données (RGPD), vous disposez d'un droit d'accès, de rectification, de suppression et d'opposition aux données personnelles vous concernant.</p>
              <p>Pour exercer ces droits, vous pouvez nous contacter à l'adresse email suivante : privacy&#64;novadesic.com</p>

              <h2 class="h4 mb-3 mt-4">Cookies</h2>
              <p>Ce site utilise des cookies pour améliorer votre expérience de navigation. Vous pouvez configurer votre navigateur pour refuser les cookies ou être informé quand des cookies sont envoyés.</p>

              <h2 class="h4 mb-3 mt-4">Liens hypertextes</h2>
              <p>Les liens hypertextes mis en place dans le cadre du présent site web en direction d'autres ressources présentes sur le réseau Internet ne sauraient engager la responsabilité de Novadesic.</p>

              <h2 class="h4 mb-3 mt-4">Droit applicable</h2>
              <p>Tout litige en relation avec l'utilisation du site NovaPartage est soumis au droit français. En dehors des cas où la loi ne le permet pas, il est fait attribution exclusive de juridiction aux tribunaux compétents de Montpellier.</p>

              <div class="text-center mt-4">
                <a routerLink="/" class="btn btn-primary">Retour à l'accueil</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .card {
      border-radius: 8px;
    }
    
    h1 {
      color: #2c3e50;
      font-weight: 600;
    }
    
    h2 {
      color: #34495e;
      border-bottom: 2px solid #ecf0f1;
      padding-bottom: 0.5rem;
    }
    
    .card-body {
      line-height: 1.6;
    }
  `]
})
export class MentionsLegalesComponent {} 