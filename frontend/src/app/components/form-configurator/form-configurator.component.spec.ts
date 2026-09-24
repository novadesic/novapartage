import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormConfiguratorComponent } from './form-configurator.component';

describe('FormConfiguratorComponent', () => {
  let component: FormConfiguratorComponent;
  let fixture: ComponentFixture<FormConfiguratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormConfiguratorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(FormConfiguratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should return empty columns when no data', () => {
    component.data = [];
    expect(component.columns).toEqual([]);
  });

  it('should return correct columns from data', () => {
    component.data = [
      { name: 'John', age: 30, city: 'Paris' },
      { name: 'Jane', age: 25, city: 'London' }
    ];
    expect(component.columns).toEqual(['name', 'age', 'city']);
  });

  it('should return empty selected data when no selection', () => {
    component.data = [
      { name: 'John', age: 30, city: 'Paris' },
      { name: 'Jane', age: 25, city: 'London' }
    ];
    component.selection = [];
    expect(component.selectedData).toEqual([]);
  });

  it('should return only selected cells data', () => {
    component.data = [
      { name: 'John', age: 30, city: 'Paris' },
      { name: 'Jane', age: 25, city: 'London' }
    ];
    // Sélectionner seulement la cellule name de la première ligne et age de la deuxième ligne
    component.selection = [{ row: 0, col: 0 }, { row: 1, col: 1 }];
    
    const result = component.selectedData;
    expect(result).toEqual([
      { name: 'John' },  // Seule la cellule name est présente
      { age: 25 }        // Seule la cellule age est présente
    ]);
  });

  it('should return correct selected columns', () => {
    component.data = [
      { name: 'John', age: 30, city: 'Paris' },
      { name: 'Jane', age: 25, city: 'London' }
    ];
    component.selection = [{ row: 0, col: 0 }, { row: 1, col: 1 }];
    expect(component.selectedColumns).toEqual(['name', 'age']);
  });

  it('should emit sheet index change', () => {
    spyOn(component.selectedSheetIndexChange, 'emit');
    component.onSheetChange(1);
    expect(component.selectedSheetIndexChange.emit).toHaveBeenCalledWith(1);
  });
}); 