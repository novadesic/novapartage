import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-conditions-utilisation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container mt-4 mb-5">
      <div class="row justify-content-center">
        <div class="col-lg-8">
          <h1 class="mb-4">Conditions d'utilisation</h1>
          
          <div class="card shadow-sm">
            <div class="card-body">
              <p class="text-muted mb-4">Dernière mise à jour : {{ currentDate | date:'dd/MM/yyyy' }}</p>

              <h2 class="h4 mb-3">1. Acceptation des conditions</h2>
              <p>En accédant et en utilisant la plateforme NovaPartage, vous acceptez d'être lié par ces conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser le service.</p>

              <h2 class="h4 mb-3 mt-4">2. Description du service</h2>
              <p>NovaPartage est une plateforme de partage de données sécurisé développée par Novadesic. Le service permet aux utilisateurs de partager des fichiers et documents de manière sécurisée avec des destinataires autorisés.</p>

              <h2 class="h4 mb-3 mt-4">3. Inscription et compte utilisateur</h2>
              <p>Pour utiliser NovaPartage, vous devez créer un compte en fournissant des informations exactes et à jour. Vous êtes responsable de maintenir la confidentialité de vos identifiants de connexion et de toutes les activités qui se produisent sous votre compte.</p>

              <h2 class="h4 mb-3 mt-4">4. Utilisation acceptable</h2>
              <p>Vous vous engagez à utiliser NovaPartage uniquement à des fins légales et conformes à ces conditions. Il est interdit de :</p>
              <ul>
                <li>Partager du contenu illégal, diffamatoire ou offensant</li>
                <li>Tenter d'accéder sans autorisation aux systèmes ou données d'autres utilisateurs</li>
                <li>Utiliser le service pour transmettre des virus ou du code malveillant</li>
                <li>Violer les droits de propriété intellectuelle</li>
                <li>Utiliser le service à des fins commerciales non autorisées</li>
              </ul>

              <h2 class="h4 mb-3 mt-4">5. Contenu partagé</h2>
              <p>Vous conservez la propriété de vos données. En utilisant NovaPartage, vous accordez à Novadesic une licence limitée pour héberger et transmettre vos fichiers conformément à votre utilisation du service.</p>
              <p>Vous êtes entièrement responsable du contenu que vous partagez et vous garantissez que vous disposez de tous les droits nécessaires pour le partager.</p>

              <h2 class="h4 mb-3 mt-4">6. Sécurité et confidentialité</h2>
              <p>Novadesic met en œuvre des mesures de sécurité appropriées pour protéger vos données. Cependant, aucune transmission sur Internet n'est totalement sécurisée. Vous utilisez le service à vos propres risques.</p>

              <h2 class="h4 mb-3 mt-4">7. Disponibilité du service</h2>
              <p>Novadesic s'efforce de maintenir la disponibilité du service mais ne peut garantir une disponibilité continue. Le service peut être temporairement indisponible pour maintenance ou pour des raisons techniques.</p>

              <h2 class="h4 mb-3 mt-4">8. Limitation de responsabilité</h2>
              <p>Dans toute la mesure permise par la loi applicable, Novadesic ne sera pas responsable des dommages indirects, accessoires, spéciaux ou consécutifs résultant de l'utilisation ou de l'impossibilité d'utiliser NovaPartage.</p>

              <h2 class="h4 mb-3 mt-4">9. Modification des conditions</h2>
              <p>Novadesic se réserve le droit de modifier ces conditions d'utilisation à tout moment. Les modifications prendront effet dès leur publication sur le site. Il est de votre responsabilité de consulter régulièrement ces conditions.</p>

              <h2 class="h4 mb-3 mt-4">10. Résiliation</h2>
              <p>Vous pouvez résilier votre compte à tout moment. Novadesic peut également suspendre ou résilier votre accès au service en cas de violation de ces conditions.</p>

              <h2 class="h4 mb-3 mt-4">11. Conservation des données</h2>
              <p>NovaPartage conserve vos données conformément à notre politique de confidentialité :</p>
              <ul>
                <li><strong>Partages actifs :</strong> Conservation jusqu'à suppression par l'utilisateur</li>
                <li><strong>Partages supprimés :</strong> Suppression définitive après 30 jours</li>
                <li><strong>Fichiers temporaires :</strong> Suppression automatique après 24 heures</li>
                <li><strong>Partages non finalisés :</strong> Suppression automatique après 7 jours</li>
                <li><strong>Tokens d'accès expirés :</strong> Conservation 90 jours pour audit</li>
                <li><strong>Logs :</strong> Conservation 12 mois (audit) / 3 mois (application)</li>
              </ul>
              <p class="mt-3">
                Pour plus de détails, consultez notre 
                <a routerLink="/politique-confidentialite">politique de confidentialité</a>.
              </p>

              <h2 class="h4 mb-3 mt-4">12. Droit applicable</h2>
              <p>Ces conditions d'utilisation sont régies par le droit français. Tout litige sera soumis à la compétence exclusive des tribunaux français.</p>

              <h2 class="h4 mb-3 mt-4">13. Contact</h2>
              <p>Pour toute question concernant ces conditions d'utilisation, vous pouvez nous contacter à : contact&#64;novadesic.com</p>
              <p class="mt-2">
                <strong>Novadesic SAS</strong><br>
                7 RUE ISAAC NEWTON ZAE MAS DE KLE, BAT B, ETAGE 1<br>
                34110 FRONTIGNAN, France<br>
                SIRET : 901138248 (RCS Montpellier)
              </p>

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
    
    ul {
      padding-left: 1.5rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
  `]
})
export class ConditionsUtilisationComponent {
  currentDate = new Date();
} 