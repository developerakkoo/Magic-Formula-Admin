import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SubscriptionsPage } from './subscriptions.page';

describe('SubscriptionsPage', () => {
  let component: SubscriptionsPage;
  let fixture: ComponentFixture<SubscriptionsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SubscriptionsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
