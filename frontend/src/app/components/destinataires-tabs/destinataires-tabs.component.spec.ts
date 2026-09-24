import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DestinatairesTabsComponent } from './destinataires-tabs.component';

describe('DestinatairesTabsComponent', () => {
  let component: DestinatairesTabsComponent;
  let fixture: ComponentFixture<DestinatairesTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DestinatairesTabsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DestinatairesTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
