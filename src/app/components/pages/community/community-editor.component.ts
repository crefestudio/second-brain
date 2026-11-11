import {AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy, Output, ViewChild, ViewEncapsulation, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {ClubDocument, plainDocument, documentText, documentHtml} from '../../../../../functions/src/community-document';
import {HtmlContainer, HtmlParagraph, HtmlImage, StyledSpan, HtmlStyles, prepareHtml} from './community-html';

@Component({selector: 'community-editor', standalone: true, imports: [FormsModule], encapsulation: ViewEncapsulation.None,
    template: `<div class="club-editor">
    <div class="club-editor-tabs" role="group" aria-label="편집 모드">
      <button type="button" [class.active]="mode === 'editor'" [attr.aria-pressed]="mode === 'editor'" (click)="setMode('editor')">에디터</button>
      <span aria-hidden="true">|</span>
      <button type="button" [class.active]="mode === 'html'" [attr.aria-pressed]="mode === 'html'" (click)="setMode('html')">HTML</button>
    </div>
    <div [hidden]="mode !== 'editor'"><div class="club-editor-toolbar" role="toolbar" aria-label="본문 서식">
      @for (tool of tools; track tool.id) { <button type="button" [disabled]="disabled" [class.active]="active(tool.id)" [attr.aria-pressed]="active(tool.id)" [attr.aria-label]="tool.label" [title]="tool.label" (click)="format(tool.id)">{{tool.text}}</button> }
      <button type="button" [disabled]="disabled" (click)="showLink = !showLink" aria-label="링크">링크</button>
      <button type="button" [disabled]="disabled || !editor?.can()?.undo()" (click)="editor?.chain()?.focus()?.undo()?.run()" aria-label="실행 취소">↶</button>
      <button type="button" [disabled]="disabled || !editor?.can()?.redo()" (click)="editor?.chain()?.focus()?.redo()?.run()" aria-label="다시 실행">↷</button>
    </div>@if (showLink) { <div class="club-editor-link"><input type="url" name="editorLink" [(ngModel)]="link" [ngModelOptions]="{standalone:true}" placeholder="https://" aria-label="링크 주소"><button type="button" [disabled]="disabled" (click)="applyLink()">적용</button><button type="button" [disabled]="disabled" (click)="editor?.chain()?.focus()?.unsetLink()?.run(); showLink=false">링크 해제</button></div> }
    <div #surface></div></div>
    @if (mode === 'html') {
      <textarea class="club-editor-html" aria-label="HTML 소스" [disabled]="disabled" [ngModel]="htmlSource" (ngModelChange)="updateHtml($event)" [ngModelOptions]="{standalone:true}" spellcheck="false" placeholder="<h2>제목</h2><p>내용을 입력하세요.</p>"></textarea>
    }
    </div><small class="club-editor-help">@if (mode === 'html') { HTML의 글자색, 배경색, 여백, 테두리 등 기본 스타일을 유지해요. 스크립트와 외부 스타일은 지원하지 않아요. } @else { # 제목 · **굵게** · - 목록 · &gt; 인용 · 코드 블록을 사용할 수 있어요. }</small>@if (error) { <p class="club-editor-error" role="alert">{{error}}</p> }`,
    styleUrls: ['./community-editor.css']})
export class CommunityEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
    private readonly zone = inject(NgZone);
    mode: 'editor' | 'html' = 'editor';
    htmlSource = '';
    @Input() document: ClubDocument | null = null;
    @Input() body = '';
    @Input() disabled = false;
    @Output() changed = new EventEmitter<{body: string; bodyDocument: ClubDocument}>();
    @ViewChild('surface') surface!: ElementRef<HTMLElement>;
    editor?: Editor;
    showLink = false; link = ''; error = '';
    tools = [{id:'heading',text:'제목',label:'제목'}, {id:'bold',text:'B',label:'굵게'}, {id:'italic',text:'I',label:'기울임'}, {id:'strike',text:'S',label:'취소선'}, {id:'bulletList',text:'• 목록',label:'글머리 목록'}, {id:'orderedList',text:'1. 목록',label:'번호 목록'}, {id:'blockquote',text:'❝',label:'인용'}, {id:'code',text:'<>',label:'인라인 코드'}, {id:'codeBlock',text:'코드',label:'코드 블록'}, {id:'horizontalRule',text:'―',label:'구분선'}];
    ngAfterViewInit() {
        this.editor = new Editor({element: this.surface.nativeElement, extensions: [StarterKit.configure({heading:{levels:[1,2,3]}, link:{openOnClick:false, protocols:['https','http','mailto']}}), HtmlContainer, HtmlParagraph, HtmlImage, StyledSpan, HtmlStyles],
            content: this.document || plainDocument(this.body), editable: !this.disabled,
            editorProps: {attributes: {class:'club-rich-text', role:'textbox', 'aria-label':'내용', 'aria-multiline':'true', id:'post-body'}},
            onUpdate: ({editor}) => this.zone.run(() => { const bodyDocument = editor.getJSON() as ClubDocument; const body = documentText(bodyDocument); this.error = body.length > 12000 ? '본문은 12,000자까지 입력할 수 있어요.' : ''; this.changed.emit({body, bodyDocument}); }),
            onSelectionUpdate: () => this.zone.run(() => {})});
    }
    ngOnChanges() { this.editor?.setEditable(!this.disabled); }
    ngOnDestroy() { this.editor?.destroy(); }
    setMode(mode: 'editor' | 'html') {
        if (!this.editor || this.mode === mode) return;
        if (mode === 'html') this.htmlSource = this.editor.getHTML();
        this.showLink = false;
        this.mode = mode;
    }
    updateHtml(source: string) {
        if (!this.editor || this.disabled) return;
        this.htmlSource = source;
        this.editor.commands.setContent(prepareHtml(source), {emitUpdate: true});
    }
    active(id: string) { return this.editor?.isActive(id) || false; }
    format(id: string) {
        if (!this.editor || this.disabled) return;
        const c = this.editor.chain().focus();
        switch (id) {
        case 'heading': c.toggleHeading({level:2}).run(); break;
        case 'bold': c.toggleBold().run(); break;
        case 'italic': c.toggleItalic().run(); break;
        case 'strike': c.toggleStrike().run(); break;
        case 'bulletList': c.toggleBulletList().run(); break;
        case 'orderedList': c.toggleOrderedList().run(); break;
        case 'blockquote': c.toggleBlockquote().run(); break;
        case 'code': c.toggleCode().run(); break;
        case 'codeBlock': c.toggleCodeBlock().run(); break;
        case 'horizontalRule': c.setHorizontalRule().run(); break;
        }
    }
    applyLink() {
        if (!/^(https?:\/\/|mailto:)[^\s]+$/i.test(this.link.trim())) { this.error = 'http 또는 https 링크를 입력해주세요.'; return; }
        this.editor?.chain().focus().extendMarkRange('link').setLink({href:this.link.trim()}).run(); this.showLink = false; this.error = '';
    }
}

@Component({selector:'community-document', standalone:true, encapsulation:ViewEncapsulation.None,
    template:`@if (document) { <div class="club-rich-text" [innerHTML]="html"></div> } @else { <p class="club-plain-text">{{body}}</p> }`, styleUrls:['./community-editor.css']})
export class CommunityDocumentComponent implements OnChanges {
    private readonly sanitizer = inject(DomSanitizer);
    @Input() document: ClubDocument | null | undefined;
    @Input() body = '';
    html: SafeHtml | string = '';
    ngOnChanges() {
        // documentHtml validates every node, URL and CSS property and escapes all values.
        // Trust only that generated output, never user-provided HTML directly.
        try { this.html = this.document ? this.sanitizer.bypassSecurityTrustHtml(documentHtml(this.document)) : ''; }
        catch { this.document = null; }
    }
}
