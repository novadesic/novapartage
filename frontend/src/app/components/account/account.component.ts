import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';
import { FooterComponent } from '../footer/footer.component';
import { AccountService, AccountData } from '../../services/account.service';
import { UnifiedAuthService } from '../../services/unified-auth.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, NavbarComponent, FooterComponent],
  template: `
    <div class="d-flex flex-column min-vh-100">
      <app-navbar pageTitle="Votre compte"></app-navbar>

      <main class="flex-grow-1 container py-4">
        <div class="row justify-content-center">
          <div class="col-lg-8">
            <div class="card shadow-sm">
              <div class="card-body p-4">
                <h1 class="h4 mb-4">Informations du compte</h1>

                <dl class="row mb-0">
                  <dt class="col-sm-4">Email</dt>
                  <dd class="col-sm-8">{{ email }}</dd>

                  <dt class="col-sm-4">Nom affiché</dt>
                  <dd class="col-sm-8">{{ displayName }}</dd>

                  <dt class="col-sm-4">Statut</dt>
                  <dd class="col-sm-8">
                    <span *ngIf="accountData?.subscription?.demoMode" class="badge text-bg-info">
                      Compte testeur
                      <span *ngIf="accountData?.subscription?.demoExpiresAt">
                        jusqu'au {{ accountData?.subscription?.demoExpiresAt | date:'longDate' }}
                      </span>
                    </span>
                    <span *ngIf="accountData?.subscription?.active && !accountData?.subscription?.demoMode" class="badge text-bg-success">
                      Accès complet
                    </span>
                    <span *ngIf="accountData?.subscription?.restricted" class="badge text-bg-secondary">
                      Mode consultation
                    </span>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </main>

      <app-footer></app-footer>
    </div>
  `
})
export class AccountComponent implements OnInit {
  accountData: AccountData | null = null;
  email = '';
  displayName = '';

  constructor(
    private accountService: AccountService,
    private authService: UnifiedAuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getUserInfo();
    this.email = user?.email || this.authService.getUserEmail() || '';
    this.displayName = user?.firstName || user?.name || user?.email || 'Utilisateur';

    this.accountService.loadAccount().subscribe(data => {
      this.accountData = data;
      const member = data?.member as Record<string, unknown> | undefined;
      if (member?.['firstname'] || member?.['name']) {
        this.displayName = String(member['firstname'] || member['name']);
      }
    });
  }
}
