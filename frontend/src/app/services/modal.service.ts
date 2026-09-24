import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface LoginModalOptions {
  email?: string;
  isSessionExpired?: boolean;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private openLoginModalSubject = new Subject<LoginModalOptions | void>();
  
  openLoginModal$ = this.openLoginModalSubject.asObservable();
  
  openLoginModal(options?: LoginModalOptions): void {
    this.openLoginModalSubject.next(options || undefined);
  }
  
  private openEmailValidationModalSubject = new Subject<LoginModalOptions | void>();
  
  openEmailValidationModal$ = this.openEmailValidationModalSubject.asObservable();
  
  openEmailValidationModal(options?: LoginModalOptions): void {
    this.openEmailValidationModalSubject.next(options || undefined);
  }
}
