import {Component, ElementRef, EventEmitter, HostListener, Input, NgZone, OnChanges, OnDestroy, OnInit, Output, ViewChild, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {CommunityService, CommunityMember} from '../../../services/community.service';
import {CommunityAvatarComponent} from './community-avatar.component';

type Peer = {id: string; name: string; avatar?: string};
type Message = {id: string; authorId: string; body: string; createdAt: number; deleted: boolean};
type Conversation = {id: string; peer: Peer; preview: string; updatedAt: number; unread: boolean};
type Cursor = [number, string] | null;

@Component({selector: 'community-chat', standalone: true, imports: [CommonModule, FormsModule, CommunityAvatarComponent],
    templateUrl: './community-chat.component.html', styleUrls: ['./community-chat.component.css']})
export class CommunityChatComponent implements OnInit, OnChanges, OnDestroy {
    private readonly api = inject(CommunityService);
    private readonly zone = inject(NgZone);
    private readonly el: ElementRef<HTMLElement> = inject(ElementRef);
    @Input() ownId = '';
    @Input() open = false;
    @Input() peerId = '';
    @Output() closed = new EventEmitter<void>();
    @Output() unread = new EventEmitter<boolean>();
    @ViewChild('messageList') list?: ElementRef<HTMLElement>;
    conversations: Conversation[] = [];
    inboxCursor: Cursor = null;
    people: CommunityMember[] = [];
    peopleCursor: Cursor = null;
    search = '';
    choosing = false;
    activeId = '';
    peer: Peer | null = null;
    messages: Message[] = [];
    cursor: Cursor = null;
    blocked = false;
    blockedByMe = false;
    draft = '';
    sending = false;
    loading = false;
    error = '';
    realtimeFailed = false;
    deleteId = '';
    private pending: {id: string; body: string; chatId: string} | null = null;
    private drafts = new Map<string, string>();
    private stop?: () => void;
    private timer?: ReturnType<typeof setInterval>;
    private dead = false;
    private sequence = 0;
    private refreshing = false;
    private refreshAgain = false;
    private focusBefore?: HTMLElement;
    private reading = false;
    private messageLoading = false;
    private messagesPending = false;
    get filteredPeople() { return this.people.filter(p => p.id !== this.ownId && p.name.toLocaleLowerCase().includes(this.search.toLocaleLowerCase())); }
    ngOnInit() {
        this.stop = this.api.watchChat(this.ownId, () => this.zone.run(() => { this.realtimeFailed = false; void this.refresh(); }),
            () => this.zone.run(() => { this.realtimeFailed = true; }));
        this.timer = setInterval(() => { if (!document.hidden) void this.refresh(); }, 30000);
    }
    ngOnChanges() {
        if (this.open) {
            this.focusBefore = document.activeElement as HTMLElement;
            setTimeout(() => this.el.nativeElement.querySelector<HTMLButtonElement>('.chat-close')?.focus());
            if (this.peerId) void this.start(this.peerId); else void this.refresh();
        }
    }
    ngOnDestroy() { this.dead = true; this.sequence++; this.stop?.(); if (this.timer) clearInterval(this.timer); this.messages = []; this.drafts.clear(); }
    close() { this.closed.emit(); this.focusBefore?.focus(); }
    back() { this.drafts.set(this.activeId, this.draft); this.sequence++; this.activeId = ''; this.messages = []; this.peer = null; this.loading = false; }
    @HostListener('document:visibilitychange') visible() { if (!document.hidden) void this.refresh(); }
    @HostListener('document:keydown', ['$event']) key(event: KeyboardEvent) {
        if (!this.open) return;
        if (event.key === 'Escape') { event.stopPropagation(); this.close(); }
        if (event.key !== 'Tab') return;
        const controls = [...this.el.nativeElement.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea:not(:disabled)')].filter(e => e.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    private message(e: unknown) { return e instanceof Error ? e.message : '채팅을 불러오지 못했습니다.'; }
    async refresh() {
        if (this.dead) return;
        if (this.refreshing) { this.refreshAgain = true; return; }
        this.refreshing = true;
        try {
            const result = await this.api.request('chatInbox');
            if (this.dead) return;
            this.conversations = result.items;
            this.inboxCursor = result.nextCursor;
            this.unread.emit(result.hasUnread);
            if (this.open && this.activeId) await this.loadMessages();
        } catch (e) { if (this.open) this.error = this.message(e); }
        finally { this.refreshing = false; if (this.refreshAgain && !this.dead) { this.refreshAgain = false; void this.refresh(); } }
    }
    async moreConversations() {
        if (!this.inboxCursor || this.loading) return;
        this.loading = true;
        try { const r = await this.api.request('chatInbox', {cursor: this.inboxCursor}); this.conversations = [...this.conversations, ...r.items.filter((c: Conversation) => !this.conversations.some(p => p.id === c.id))]; this.inboxCursor = r.nextCursor; }
        catch (e) { this.error = this.message(e); } finally { this.loading = false; }
    }
    async choose(more = false) {
        if (this.loading) return;
        this.choosing = true; this.loading = true; this.error = '';
        try { const r = await this.api.request('members', {cursor: more ? this.peopleCursor : null}); this.people = more ? [...this.people, ...r.members] : r.members; this.peopleCursor = r.nextCursor; }
        catch (e) { this.error = this.message(e); } finally { this.loading = false; }
    }
    async start(peerId: string) {
        if (this.sending) return;
        this.error = ''; const seq = ++this.sequence;
        try { const r = await this.api.request('chatStart', {peerId}); if (seq !== this.sequence || this.dead) return; await this.select(r.chatId); }
        catch (e) { if (seq === this.sequence) this.error = this.message(e); }
    }
    async select(id: string) {
        if (this.sending) return;
        this.drafts.set(this.activeId, this.draft);
        this.sequence++; this.activeId = id; this.peer = null; this.messages = []; this.cursor = null;
        this.draft = this.drafts.get(id) || ''; this.pending = null; this.choosing = false; this.error = ''; this.deleteId = '';
        await this.loadMessages();
    }
    async loadMessages(more = false) {
        if (!this.activeId || this.dead || (more && (!this.cursor || this.loading))) return;
        if (this.messageLoading) { this.messagesPending = true; return; }
        this.messageLoading = true;
        const seq = this.sequence, id = this.activeId;
        const element = this.list?.nativeElement, height = element?.scrollHeight || 0;
        const atBottom = !element || element.scrollHeight - element.scrollTop - element.clientHeight < 100;
        this.loading = true;
        try {
            // Reconcile all currently displayed pages, including deletions from another tab.
            let next: Cursor = more ? this.cursor : null;
            const rows: Message[] = [];
            const pages = more ? 1 : Math.max(1, Math.ceil(this.messages.length / 40));
            let result: any;
            for (let i = 0; i < pages; i++) {
                result = await this.api.request('chatMessages', {chatId: id, cursor: next});
                rows.push(...result.messages); next = result.nextCursor;
                if (!next) break;
            }
            if (this.dead || seq !== this.sequence) return;
            this.peer = result.peer; this.blocked = result.blocked; this.blockedByMe = result.blockedByMe;
            const combined = more ? [...rows, ...this.messages] : rows;
            this.messages = [...new Map(combined.map(m => [m.id, m])).values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
            this.cursor = next;
            setTimeout(() => { const el = this.list?.nativeElement; if (!el || seq !== this.sequence) return; if (more) el.scrollTop += el.scrollHeight - height; else if (atBottom) el.scrollTop = el.scrollHeight; });
            if (this.open && !document.hidden && atBottom && !more && this.messages.length) {
                await this.api.request('chatRead', {chatId: id, readAt: this.messages[this.messages.length - 1].createdAt});
                this.conversations = this.conversations.map(c => c.id === id ? {...c, unread: false} : c);
            }
        } catch (e) { if (seq === this.sequence) { this.error = this.message(e); this.messages = []; this.peer = null; } }
        finally {
            this.messageLoading = false;
            if (seq === this.sequence) this.loading = false;
            if (this.messagesPending && !this.dead) { this.messagesPending = false; void this.loadMessages(); }
        }
    }
    async scrolled() {
        const el = this.list?.nativeElement;
        if (this.reading || !this.open || document.hidden || !el || el.scrollHeight - el.scrollTop - el.clientHeight > 40 || !this.messages.length) return;
        if (!this.conversations.some(c => c.id === this.activeId && c.unread)) return;
        this.reading = true;
        try { await this.api.request('chatRead', {chatId: this.activeId, readAt: this.messages[this.messages.length - 1].createdAt}); }
        catch (e) { this.error = this.message(e); } finally { this.reading = false; }
    }
    async send() {
        if (this.sending || this.blocked || !this.draft.trim() || !this.peer) return;
        const body = this.draft.trim(), id = this.activeId;
        if (!this.pending || this.pending.body !== body || this.pending.chatId !== id) this.pending = {id: crypto.randomUUID(), body, chatId: id};
        this.sending = true; this.error = '';
        try {
            await this.api.request('chatSend', {chatId: id, messageId: this.pending.id, body});
            if (this.activeId === id && this.draft.trim() === body) this.draft = '';
            this.drafts.delete(id); this.pending = null; await this.refresh();
            setTimeout(() => { const el = this.list?.nativeElement; if (el) el.scrollTop = el.scrollHeight; });
        } catch (e) { this.error = this.message(e); } finally { this.sending = false; }
    }
    composeKey(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void this.send(); }
    }
    async remove() {
        if (!this.deleteId || this.sending) return;
        this.sending = true;
        try { await this.api.request('chatDelete', {chatId: this.activeId, messageId: this.deleteId}); this.deleteId = ''; await this.loadMessages(); }
        catch (e) { this.error = this.message(e); } finally { this.sending = false; }
    }
    async toggleBlock() {
        if (this.sending) return;
        this.sending = true;
        try { await this.api.request('chatBlock', {chatId: this.activeId, blocked: !this.blockedByMe}); await this.loadMessages(); }
        catch (e) { this.error = this.message(e); } finally { this.sending = false; }
    }
}
