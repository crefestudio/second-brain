import { Pipe, PipeTransform } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

@Pipe({
    name: 'sanitizeHtml'
})
export class SanitizeHtmlPipe implements PipeTransform {

    constructor(private _sanitizer:DomSanitizer) {
    }

    transform(v: any):SafeHtml {
        return this._sanitizer.bypassSecurityTrustHtml(v);
    }
}

@Pipe({
    name: 'replaceHtmlToString'
})
export class ReplaceHtmlToTextPipe  implements PipeTransform {

    constructor() {
    }

    transform(html: any):String {
        let result: String = "";
        if(html != null) {
            result = html;

            result = result.replace(/&apos;/g, "'");
            result = result.replace(/&quot;/g, '"');
            result = result.replace(/&gt;/g, ">");
            result = result.replace(/&lt;/g, "<");
            result = result.replace(/&#40;/g, "(");
            result = result.replace(/&#41;/g, ")");
        }
        return result;
    }
}

@Pipe({
    name: 'reduceTextLength'
})
export class ReduceTextLengthPipe implements PipeTransform {
    transform(value?: string, limit: number = 15): string {
        if (!value) return '';
        if (value.length <= limit) return value;
        return value.substring(0, limit) + '...';
    }
}