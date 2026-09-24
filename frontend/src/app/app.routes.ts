import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./components/index/index.module').then(m => m.IndexModule),
    // Pas de AuthGuard - accessible à tous, redirection automatique vers /home si connecté
  },
  {
    path: 'home',
    loadChildren: () => import('./components/home/home.module').then(m => m.HomeModule),
    canActivate: [AuthGuard],
    data: {
      authorities: ['ROLE_USER', 'ROLE_MANAGER', 'ROLE_ADMIN'],
      requiresSubscription: true
    }
  },
  {
    path: 'share/new',
    loadChildren: () => import('./components/new-share/new-share.module').then(m => m.NewShareModule)
    // Pas de AuthGuard - accessible sans authentification
  },
  {
    path: 'share/new/:id',
    loadChildren: () => import('./components/new-share/new-share.module').then(m => m.NewShareModule),
    canActivate: [AuthGuard],
    data: {
      authorities: ['ROLE_USER', 'ROLE_MANAGER', 'ROLE_ADMIN'],
      requiresSubscription: true
    }
  },
  {
    path: 'share/:id',
    loadChildren: () => import('./components/share-detail/share-detail.module').then(m => m.ShareDetailModule),
    canActivate: [AuthGuard],
    data: {
      authorities: ['ROLE_USER', 'ROLE_MANAGER', 'ROLE_ADMIN'],
      requiresSubscription: true
    }
  },
  {
    path: 'access/:token',
    loadComponent: () => import('./components/share-access/share-access.component').then(m => m.ShareAccessComponent)
  },
  {
    path: 'demo-inscription',
    loadComponent: () => import('./components/demo-inscription/demo-inscription.component').then(m => m.DemoInscriptionComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./components/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent)
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./components/auth-callback/auth-callback.component').then(m => m.AuthCallbackComponent)
  },
  {
    path: 'mentions-legales',
    loadComponent: () => import('./components/mentions-legales/mentions-legales.component').then(m => m.MentionsLegalesComponent)
  },
  {
    path: 'conditions-utilisation',
    loadComponent: () => import('./components/conditions-utilisation/conditions-utilisation.component').then(m => m.ConditionsUtilisationComponent)
  },
  {
    path: 'politique-cookies',
    loadComponent: () => import('./components/politique-cookies/politique-cookies.component').then(m => m.PolitiqueCookiesComponent)
  },
  {
    path: 'politique-confidentialite',
    loadComponent: () => import('./components/politique-confidentialite/politique-confidentialite.component').then(m => m.PolitiqueConfidentialiteComponent)
  },
  {
    path: 'compte',
    loadComponent: () => import('./components/account/account.component').then(m => m.AccountComponent),
    canActivate: [AuthGuard],
    data: { authorities: ['ROLE_USER', 'ROLE_MANAGER', 'ROLE_ADMIN'] }
  }
];
