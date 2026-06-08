import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LifeUpComponent } from './life-up.component';

describe('LifeUpComponent', () => {
  let component: LifeUpComponent;
  let fixture: ComponentFixture<LifeUpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LifeUpComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LifeUpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
