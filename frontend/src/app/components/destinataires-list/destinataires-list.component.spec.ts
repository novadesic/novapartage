import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DestinatairesListComponent } from './destinataires-list.component';

describe('DestinatairesListComponent', () => {
  let component: DestinatairesListComponent;
  let fixture: ComponentFixture<DestinatairesListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DestinatairesListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DestinatairesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
