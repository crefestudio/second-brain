import { Directive, Input, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: '[telType]'
})
export class TelephoneTypeDirective {

    regexStr = '^[0-9]*$';
    private el;
    constructor(private _el: ElementRef) { 
        this.el = _el;
    }
  
    @HostListener('input', ['$event']) onInput(event: any) {
        let e = <KeyboardEvent> event;
        console.log('TelephoneTypeDirective::onInput e =>', e);

        if(event.isComposing) {
            let reg = /[^0-9]/gi;
            let value = this.el.nativeElement.value;
            this.el.nativeElement.value = value.replace(reg, '');
            e.preventDefault();
            return;
        }   
    }
  
    // @HostListener('keyup', ['$event']) onKeyUp(event) {
    //     let e = <KeyboardEvent> event;
    //     console.log('TelephoneTypeDirective::onKeyUp e, e.key =>', e, e.key, e.keyCode, this.el.nativeElement.value);   
    // }

    @HostListener('keydown', ['$event']) onKeyDown(event: any) {      
        let e = <KeyboardEvent> event;
        console.log('TelephoneTypeDirective::onKeyDown e, e.key =>', e, e.key, e.keyCode, this.el.nativeElement.value);

        if (e.key == 'Process') {
            return;
        }

        // 숫자 제한
        if ([46, 8, 9, 27, 13].indexOf(e.keyCode) !== -1 ||
        // Allow: Ctrl+A
        (e.keyCode == 65 && e.ctrlKey === true) ||
        // Allow: Ctrl+C
        (e.keyCode == 67 && e.ctrlKey === true) ||
        // Allow: Ctrl+V
        (e.keyCode == 86 && e.ctrlKey === true) ||
        // Allow: Ctrl+X
        (e.keyCode == 88 && e.ctrlKey === true) ||
        // Allow: home, end, left, right
        (e.keyCode >= 35 && e.keyCode <= 39)) {
            // let it happen, don't do anything
            return;
        }
         if (e.key.length > 1) { 
            return;
        }
        
        // 길이 제한
        if (this.el && this.el.nativeElement && this.el.nativeElement.value && this.el.nativeElement.value.length >= 4) {
            e.preventDefault();
            return;
        }
        
        let ch = e.key;//String.fromCharCode(e.keyCode);
        // if (ch.length > 1) { 
        //     console.log('TelephoneTypeDirective::onKeyDown !!!!!! ', this.el.nativeElement.value);
        //     this.el.nativeElement.value = this.el.nativeElement.value; 
        //     e.preventDefault();
        //     return;
        // }
        console.log('TelephoneTypeDirective::onKeyDown ', e, e.keyCode, ch, this.el.nativeElement.value);

        let regEx =  new RegExp(this.regexStr);    
        if(regEx.test(ch)) {
            
            return;
        } else {
            e.preventDefault();
        }    
    }
}


// export class OnlyNumber {

//     regexStr = '^[0-9]*$';
//     constructor(private el: ElementRef) { }
  
//     @Input() OnlyNumber: boolean;
  
//     @HostListener('keydown', ['$event']) onKeyDown(event) {
//       let e = <KeyboardEvent> event;
//       if (this.OnlyNumber) {
//           if ([46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
//           // Allow: Ctrl+A
//           (e.keyCode == 65 && e.ctrlKey === true) ||
//           // Allow: Ctrl+C
//           (e.keyCode == 67 && e.ctrlKey === true) ||
//           // Allow: Ctrl+V
//           (e.keyCode == 86 && e.ctrlKey === true) ||
//           // Allow: Ctrl+X
//           (e.keyCode == 88 && e.ctrlKey === true) ||
//           // Allow: home, end, left, right
//           (e.keyCode >= 35 && e.keyCode <= 39)) {
//             // let it happen, don't do anything
//             return;
//           }
//         let ch = String.fromCharCode(e.keyCode);
//         let regEx =  new RegExp(this.regexStr);    
//         if(regEx.test(ch))
//           return;
//         else
//            e.preventDefault();
//         }
//     }
//   }
  