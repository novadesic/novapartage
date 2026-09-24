import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map, distinctUntilChanged } from 'rxjs';
import { LoggerService } from './logger.service';

export interface MessageState {
  shouldDisplay: boolean;
  type?: 'info' | 'warning' | 'error' | 'success';
  text?: string;
  recipientsWithoutSelection?: number[];
  recipientsWithoutPageTitle?: number[];
  errorType?: 'selection' | 'pageTitle' | null;
}

export interface MessageDataState {
  currentStep: number;
  recipients: any[];
  isFinalizing: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private messageSubject = new BehaviorSubject<MessageState | null>(null);
  public message$ = this.messageSubject.asObservable();

  // État centralisé des données nécessaires aux messages
  private dataStateSubject = new BehaviorSubject<MessageDataState>({
    currentStep: 1,
    recipients: [],
    isFinalizing: false
  });
  public dataState$ = this.dataStateSubject.asObservable();

  // Message utilisateur actuel
  private userMessageSubject = new BehaviorSubject<{ type: 'info' | 'warning' | 'error' | 'success', text: string } | null>(null);
  private userMessage$ = this.userMessageSubject.asObservable();

  constructor(private logger: LoggerService) {
    // Calcul automatique des messages basé sur l'état
    this.initializeMessageComputation();
  }

  private initializeMessageComputation(): void {
    combineLatest([
      this.dataState$,
      this.userMessage$
    ]).pipe(
      map(([dataState, userMessage]) => this.computeMessageState(dataState, userMessage)),
      distinctUntilChanged((prev, curr) => 
        prev?.shouldDisplay === curr?.shouldDisplay &&
        prev?.type === curr?.type &&
        prev?.text === curr?.text
      )
    ).subscribe(messageState => {
      // Ne logger que si le message change vraiment
      if (messageState?.shouldDisplay) {
        this.logger.log('MessageService: Affichage du message', { type: messageState.type, text: messageState.text });
      }
      this.messageSubject.next(messageState);
    });
  }

  private computeMessageState(dataState: MessageDataState, userMessage: { type: 'info' | 'warning' | 'error' | 'success', text: string } | null): MessageState {
    // Si pas de message utilisateur, ne pas afficher
    if (!userMessage) {
      return { shouldDisplay: false };
    }

    // Si la finalisation est en cours, arrêter les traitements inutiles
    if (dataState.isFinalizing) {
      return { shouldDisplay: false };
    }

    // Pré-calculer les indices des destinataires sans sélection
    const recipientsWithoutSelection = this.getRecipientsWithoutSelectionIndices(dataState.recipients);
    const recipientsWithoutPageTitle = this.getRecipientsWithoutPageTitleIndices(dataState.recipients);
    const errorType = this.getErrorMessageType(dataState);

    // Pour les messages de type warning avec "destinataires suivants"
    if (userMessage.type === 'warning' && 
        userMessage.text.includes('destinataires suivants') && 
        recipientsWithoutSelection.length > 0) {
      return {
        shouldDisplay: true,
        type: userMessage.type,
        text: userMessage.text,
        recipientsWithoutSelection,
        recipientsWithoutPageTitle,
        errorType
      };
    }

    // Pour les messages d'erreur avec "destinataires suivants" et type "selection"
    if (userMessage.type === 'error' && 
        userMessage.text.includes('destinataires suivants') && 
        errorType === 'selection') {
      return {
        shouldDisplay: true,
        type: userMessage.type,
        text: userMessage.text,
        recipientsWithoutSelection,
        recipientsWithoutPageTitle,
        errorType
      };
    }

    // Pour les messages d'erreur avec "destinataires suivants" et type "pageTitle"
    if (userMessage.type === 'error' && 
        userMessage.text.includes('destinataires suivants') && 
        errorType === 'pageTitle') {
      return {
        shouldDisplay: true,
        type: userMessage.type,
        text: userMessage.text,
        recipientsWithoutSelection,
        recipientsWithoutPageTitle,
        errorType
      };
    }

    // Pour les messages d'erreur avec "titre de formulaire"
    if (userMessage.type === 'error' && 
        userMessage.text.includes('titre de formulaire')) {
      return {
        shouldDisplay: true,
        type: userMessage.type,
        text: userMessage.text,
        recipientsWithoutSelection,
        recipientsWithoutPageTitle,
        errorType
      };
    }


    // Pour tous les autres types de messages (info, success, et autres cas)
    if (!(userMessage.type === 'warning' && userMessage.text.includes('destinataires suivants')) && 
        !(userMessage.type === 'error' && userMessage.text.includes('destinataires suivants'))) {
      return {
        shouldDisplay: true,
        type: userMessage.type,
        text: userMessage.text,
        recipientsWithoutSelection,
        recipientsWithoutPageTitle,
        errorType
      };
    }

    // Pour les messages d'erreur généraux (comme les titres de formulaire)
    if (userMessage.type === 'error') {
      return {
        shouldDisplay: true,
        type: userMessage.type,
        text: userMessage.text,
        recipientsWithoutSelection,
        recipientsWithoutPageTitle,
        errorType
      };
    }

    this.logger.log('MessageService: Aucune condition remplie, retour shouldDisplay: false');
    return { shouldDisplay: false };
  }

  // Actions pour mettre à jour les données
  updateCurrentStep(step: number): void {
    this.logger.log('MessageService: Mise à jour de l\'étape', step);
    const currentState = this.dataStateSubject.value;
    this.dataStateSubject.next({ ...currentState, currentStep: step });
  }

  updateRecipients(recipients: any[]): void {
    const currentState = this.dataStateSubject.value;
    this.dataStateSubject.next({ ...currentState, recipients });
  }

  updateFinalizingState(isFinalizing: boolean): void {
    this.logger.log('MessageService: Mise à jour de l\'état de finalisation', isFinalizing);
    const currentState = this.dataStateSubject.value;
    this.dataStateSubject.next({ ...currentState, isFinalizing });
  }

  // Actions pour les messages
  showMessage(type: 'info' | 'warning' | 'error' | 'success', text: string): void {
    this.userMessageSubject.next({ type, text });
  }

  clearMessage(): void {
    //console.log('MessageService: clearMessage appelé');
    this.userMessageSubject.next(null);
  }

  // Méthodes utilitaires (déplacées du composant)
  private getRecipientsWithoutSelectionIndices(recipients: any[]): number[] {
    if (this.dataStateSubject.value.isFinalizing) {
      return [];
    }

    return recipients
      .map((recipient, recipientIndex) => ({ recipient, recipientIndex }))
      .filter(({ recipient }) => {
        // Logique simplifiée pour détecter les sélections
        // Chercher la première feuille qui a des sélections pour ce destinataire
        let hasSelection = false;
        
        if (recipient.selection) {
          for (const sheetKey of Object.keys(recipient.selection)) {
            const selections = recipient.selection[sheetKey];
            if (selections && Array.isArray(selections) && selections.length > 0) {
              hasSelection = true;
              break;
            }
          }
        }
        
        return !hasSelection;
      })
      .map(({ recipientIndex }) => recipientIndex);
  }

  private getRecipientsWithoutPageTitleIndices(recipients: any[]): number[] {
    if (this.dataStateSubject.value.isFinalizing) {
      return [];
    }

    return recipients
      .map((recipient, recipientIndex) => ({ recipient, recipientIndex }))
      .filter(({ recipient }) => {
        const pageTitle = recipient.pageTitle;
        return !pageTitle || pageTitle.trim().length === 0;
      })
      .map(({ recipientIndex }) => recipientIndex);
  }

  private getErrorMessageType(dataState: MessageDataState): 'selection' | 'pageTitle' | null {
    if (dataState.currentStep === 4) {
      // À l'étape 4, vérifier d'abord les sélections, puis les titres
      const hasSelection = this.allRecipientsHaveSelection(dataState.recipients);
      if (!hasSelection) {
        return 'selection';
      }
      const hasPageTitle = this.allRecipientsHavePageTitle(dataState.recipients);
      if (!hasPageTitle) {
        return 'pageTitle';
      }
    } else if (dataState.currentStep === 2 || dataState.currentStep === 3) {
      // Aux étapes 2 et 3, vérifier seulement les sélections
      const hasSelection = this.allRecipientsHaveSelection(dataState.recipients);
      if (!hasSelection) {
        return 'selection';
      }
    }
    return null;
  }

  private allRecipientsHaveSelection(recipients: any[]): boolean {
    if (recipients.length === 0) return false;
    
    return recipients.every(recipient => {
      return recipient.selection && Object.keys(recipient.selection).some(key => 
        recipient.selection[key] && recipient.selection[key].length > 0
      );
    });
  }

  private allRecipientsHavePageTitle(recipients: any[]): boolean {
    if (recipients.length === 0) return false;
    
    return recipients.every(recipient => {
      const pageTitle = recipient.pageTitle;
      return pageTitle && pageTitle.trim().length > 0;
    });
  }
}
