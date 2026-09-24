import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TableauSelectionComponent } from './tableau-selection.component';

describe('TableauSelectionComponent', () => {
  let component: TableauSelectionComponent;
  let fixture: ComponentFixture<TableauSelectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableauSelectionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TableauSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
