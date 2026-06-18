import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ToastService {

  static instance: ToastService;

  toast$ = new Subject<string>();

  constructor() {
    ToastService.instance = this;
  }

  static show(message: string): void {
    ToastService.instance?.toast$.next(message);
  }
}