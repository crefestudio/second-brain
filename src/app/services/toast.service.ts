import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type ToastType =
  | 'success'
  | 'warning'
  | 'error';

export interface ToastMessage {
  message: string;
  type: ToastType;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  static instance: ToastService;

  toast$ = new Subject<ToastMessage>();

  constructor() {
    ToastService.instance = this;
  }

  static show(message: string): void {
    ToastService.instance?.toast$.next({
      message,
      type: 'success'
    });
  }

  static warning(message: string): void {
    ToastService.instance?.toast$.next({
      message,
      type: 'warning'
    });
  }

  static error(message: string): void {
    ToastService.instance?.toast$.next({
      message,
      type: 'error'
    });
  }
}