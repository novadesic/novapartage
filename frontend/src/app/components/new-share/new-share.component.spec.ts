import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewShareComponent } from './new-share.component';

describe('NewShareComponent', () => {
  let component: NewShareComponent;
  let fixture: ComponentFixture<NewShareComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewShareComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NewShareComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
