import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-politique-confidentialite',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="container mt-4 mb-5">
      <div class="row justify-content-center">
        <div class="col-lg-10">
          <h1 class="mb-4">Politique de confidentialité</h1>
          
          <div class="card shadow-sm">
            <div class="card-body">
              <p class="text-muted mb-4">Dernière mise à jour : {{ currentDate | date:'dd/MM/yyyy' }}</p>

              <section class="mb-5">
                <h2 class="h4 mb-3">1. Introduction</h2>
                <p>
                  NovaPartage, développé par Novadesic, s'engage à protéger vos données personnelles 
                  conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi 
                  Informatique et Libertés.
                </p>
                <p>
                  Cette politique de confidentialité explique comment nous collectons, utilisons, 
                  conservons et protégeons vos données personnelles lorsque vous utilisez notre service.
                </p>
              </section>

              <section class="mb-5">
                <h2 class="h4 mb-3">2. Données collectées</h2>
                <p>Nous collectons les données suivantes :</p>
                <ul>
                  <li><strong>Données d'identification :</strong> Adresse email, nom d'affichage</li>
                  <li><strong>Données de contenu :</strong> Fichiers Excel que vous partagez</li>
                  <li><strong>Données de formulaires :</strong> Données saisies dans les formulaires partagés</li>
                  <li><strong>Données de navigation :</strong> Cookies, logs d'accès, métadonnées</li>
                  <li><strong>Données techniques :</strong> Adresse IP, type de navigateur, système d'exploitation</li>
                </ul>
              </section>

              <section class="mb-5">
                <h2 class="h4 mb-3">3. Finalités du traitement</h2>
                <p>Vos données sont traitées pour les finalités suivantes :</p>
                <ul>
                  <li>Fournir le service de partage de fichiers sécurisé</li>
                  <li>Gérer l'authentification et les accès</li>
                  <li>Assurer la sécurité et prévenir les fraudes</li>
                  <li>Améliorer le service et l'expérience utilisateur</li>
                  <li>Respecter les obligations légales</li>
                </ul>
              </section>

              <section class="mb-5">
                <h2 class="h4 mb-3">4. Base légale</h2>
                <p>Le traitement de vos données repose sur :</p>
                <ul>
                  <li><strong>Consentement :</strong> Pour les cookies non essentiels</li>
                  <li><strong>Exécution d'un contrat :</strong> Pour la fourniture du service</li>
                  <li><strong>Obligation légale :</strong> Pour la conservation des logs d'audit</li>
                  <li><strong>Intérêt légitime :</strong> Pour la sécurité et l'amélioration du service</li>
                </ul>
              </section>

              <section class="mb-5">
                <h2 class="h4 mb-3">5. Durées de conservation des données</h2>
                <p>Nous conservons vos données selon les durées suivantes :</p>
                <div class="table-responsive">
                  <table class="table table-striped table-bordered">
                    <thead class="table-light">
                      <tr>
                        <th>Type de donnée</th>
                        <th>Durée de conservation</th>
                        <th>Justification</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Fichiers Excel (partages actifs)</strong></td>
                        <td>Jusqu'à suppression par l'utilisateur</td>
                        <td>Nécessaire au fonctionnement du service</td>
                      </tr>
                      <tr>
                        <td><strong>Fichiers Excel (partages supprimés)</strong></td>
                        <td>30 jours</td>
                        <td>Délai de récupération</td>
                      </tr>
                      <tr>
                        <td><strong>Fichiers temporaires</strong></td>
                        <td>24 heures</td>
                        <td>Fichiers non finalisés</td>
                      </tr>
                      <tr>
                        <td><strong>Partages non finalisés (NEW)</strong></td>
                        <td>7 jours</td>
                        <td>Nettoyage automatique des brouillons</td>
                      </tr>
                      <tr>
                        <td><strong>Partages terminés (FINISHED)</strong></td>
                        <td>18 mois</td>
                        <td>Conservation pour historique</td>
                      </tr>
                      <tr>
                        <td><strong>Soumissions de formulaires</strong></td>
                        <td>Lié au partage parent</td>
                        <td>Cohérence avec le partage</td>
                      </tr>
                      <tr>
                        <td><strong>Tokens d'accès expirés</strong></td>
                        <td>90 jours après expiration</td>
                        <td>Traçabilité et audit</td>
                      </tr>
                      <tr>
                        <td><strong>Tokens d'accès validés</strong></td>
                        <td>1 an après validation</td>
                        <td>Historique des validations</td>
                      </tr>
                      <tr>
                        <td><strong>Logs d'audit</strong></td>
                        <td>12 mois</td>
                        <td>Sécurité et conformité</td>
                      </tr>
                      <tr>
                        <td><strong>Logs d'application</strong></td>
                        <td>3 mois</td>
                        <td>Debug et maintenance</td>
                      </tr>
                      <tr>
                        <td><strong>Données de compte (emails)</strong></td>
                        <td>3 ans après dernière activité</td>
                        <td>Obligations légales et service</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <section class="mb-5">
                <h2 class="h4 mb-3">6. Vos droits</h2>
                <p>Conformément au RGPD, vous disposez des droits suivants :</p>
                <ul>
                  <li><strong>Droit d'accès :</strong> Vous pouvez demander l'accès à vos données personnelles</li>
                  <li><strong>Droit de rectification :</strong> Vous pouvez corriger vos données inexactes</li>
                  <li><strong>Droit à l'effacement :</strong> Vous pouvez demander la suppression de vos données</li>
                  <li><strong>Droit à la portabilité :</strong> Vous pouvez récupérer vos données dans un format structuré</li>
                  <li><strong>Droit d'opposition :</strong> Vous pouvez vous opposer au traitement de vos données</li>
                  <li><strong>Droit à la limitation :</strong> Vous pouvez demander la limitation du traitement</li>
                </ul>
                <p class="mt-3">
                  Pour exercer ces droits, contactez-nous à : 
                  <a href="mailto:privacy&#64;novadesic.com">privacy&#64;novadesic.com</a>
                </p>
              </section>

              <section class="mb-5">
                <h2 class="h4 mb-3">7. Sécurité des données</h2>
                <p>Nous mettons en œuvre des mesures techniques et organisationnelles appropriées :</p>
                <ul>
                  <li>Chiffrement des données en transit (HTTPS)</li>
                  <li>Authentification sécurisée par tokens</li>
                  <li>Accès limité aux données (principe du moindre privilège)</li>
                  <li>Surveillance et logs d'audit</li>
                  <li>Sauvegardes régulières</li>
                </ul>
              </section>

              <section class="mb-5">
                <h2 class="h4 mb-3">8. Transferts de données</h2>
                <p>
                  Vos données sont stockées et traitées au sein de l'Union Européenne. 
                  En cas de transfert vers un pays tiers, nous nous assurons que des garanties 
                  appropriées sont en place conformément au RGPD.
                </p>
                <p>
                  Nous utilisons les services suivants qui peuvent traiter vos données :
                </p>
                <ul>
                  <li><strong>Hébergement :</strong> OVH (2 rue Kellermann, 59100 Roubaix, France)</li>
                  <li><strong>Service d'email :</strong> Pour l'envoi de notifications (SMTP/Mailjet selon configuration)</li>
                </ul>
              </section>

              <section class="mb-5">
                <h2 class="h4 mb-3">9. Cookies</h2>
                <p>
                  Nous utilisons des cookies pour améliorer votre expérience. 
                  Pour plus d'informations, consultez notre 
                  <a routerLink="/politique-cookies">politique d'utilisation des cookies</a>.
                </p>
              </section>

              <section class="mb-5">
                <h2 class="h4 mb-3">10. Modifications</h2>
                <p>
                  Nous nous réservons le droit de modifier cette politique de confidentialité. 
                  Les modifications seront publiées sur cette page avec la date de mise à jour.
                </p>
              </section>

              <section class="mb-5">
                <h2 class="h4 mb-3">11. Contact</h2>
                <p>
                  Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits, 
                  contactez-nous :
                </p>
                <p>
                  <strong>Email :</strong> <a href="mailto:privacy&#64;novadesic.com">privacy&#64;novadesic.com</a><br>
                  <strong>Délégué à la Protection des Données :</strong> Novadesic SAS<br>
                  <strong>Adresse :</strong> 7 RUE ISAAC NEWTON ZAE MAS DE KLE, BAT B, ETAGE 1, 34110 FRONTIGNAN, France
                </p>
              </section>

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
      margin-top: 2rem;
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
    
    table {
      font-size: 0.95rem;
    }
    
    table th {
      font-weight: 600;
      background-color: #f8f9fa;
    }
    
    table td {
      vertical-align: middle;
    }
  `]
})
export class PolitiqueConfidentialiteComponent {
  currentDate = new Date();
}

