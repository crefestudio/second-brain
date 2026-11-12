import {CommunityEditorComponent, CommunityDocumentComponent} from './community-editor.component';
import {DomSanitizer, SafeHtml} from '@angular/platform-browser';
import {renderCommunityNewsletter} from '../../../../../functions/src/community-newsletter';
import {ClubDocument} from '../../../../../functions/src/community-document';
import { NOTIFICATION_CATEGORIES, notificationPreferences } from '../../../../../functions/src/community-notification-settings';
import { CommunityChatComponent } from './community-chat.component';
import { CommunityRoomCoverComponent } from './community-room-cover.component';
import { isCommunityRoomVisible, supportsCommunityRequests } from '../../../../../functions/src/community-model';
import { CommunityMedia, communityVideoUrl } from '../../../../../functions/src/community-media-model';
import { CommunityMediaComponent } from './community-media.component';
import { communityHomePath, isCommunityReturnPath } from '../../../config/community-navigation';
import { Component, HostBinding, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { SocialAuthService } from '../../../services/social-auth.service';
import { CommunityService, COMMUNITY_ROOMS, CommunityPost, CommunityComment, CommunityMember } from '../../../services/community.service';
import { CommunityIconComponent } from './community-icon.component';
import { CommunityAvatarComponent } from './community-avatar.component';

@Component({ selector: 'app-community', standalone: true,
    imports: [CommunityEditorComponent, CommunityDocumentComponent, CommunityChatComponent, CommonModule, FormsModule, RouterLink, CommunityRoomCoverComponent, CommunityMediaComponent, CommunityIconComponent, CommunityAvatarComponent],
    templateUrl: './community.component.html', styleUrls: ['./community.component.css', './community-content.css', './community-dialog.css', './community-responsive.css', './community-theme.css', './community-notifications.css', './community-drafts.css', './community-pins.css', './community-sidebar.css'] })
export class CommunityComponent implements OnInit, OnDestroy {
    readonly auth = inject(SocialAuthService);
    private readonly api = inject(CommunityService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    readonly rooms = COMMUNITY_ROOMS;
    readonly groups = ['시작하기', '함께 나누기', '함께 배우기', '서비스', '라이프업 템플릿', '작업실'];
    @HostBinding('class.community-dark') get darkTheme() { return this.theme === 'dark'; }
    theme: 'light' | 'dark' = this.readTheme();
    private readTheme(): 'light' | 'dark' {
        try { return localStorage.getItem('notionable.community.theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
    }
    setTheme(theme: 'light' | 'dark') {
        this.theme = theme;
        try { localStorage.setItem('notionable.community.theme', theme); } catch { /* Storage can be unavailable. */ }
    }
    member: CommunityMember | null = null;
    isAdmin = false;
    ready = false;
    loading = false;
    busy = false;
    error = '';
    notice = '';
    roomId = '';
    kind = '';
    view = 'home';
    sidebarOpen = false;
    accountOpen = false;
    chatOpen = false;
    chatPeerId = '';
    chatUnread = false;
    openChat(peerId = '') { this.chatPeerId = peerId; this.chatOpen = true; this.accountOpen = false; }
    posts: CommunityPost[] = [];
    pinnedPosts: CommunityPost[] = [];
    sidebarPinnedPosts: CommunityPost[] = [];
    popularPosts: CommunityPost[] = [];
    get loadPinnedSidebar() { return this.view === 'mine' || this.view === 'home'; }
    get showPinnedSidebar() { return this.loadPinnedSidebar && this.sidebarPinnedPosts.length > 0; }
    get showPopularPosts() { return this.view === 'home' && !this.roomId; }
    showChannelBadge(post: CommunityPost) { return !this.roomId && (post.pinExpiresAt || 0) <= Date.now(); }
    roomTone(id: string) { const index = this.rooms.findIndex(r => r.id === id); return 'tone-' + Math.max(0, index % 6); }
    pinTarget: CommunityPost | null = null;
    pinMode = 'none';
    readonly permanentPin = Number.MAX_SAFE_INTEGER;
    editPin(post: CommunityPost) { this.pinTarget = post; this.pinMode = post.pinExpiresAt === this.permanentPin ? 'always' : (post.pinExpiresAt || 0) > Date.now() ? 'day' : 'none'; this.openDialog('pin'); }
    async savePin() {
        if (this.busy || !this.pinTarget) return;
        this.busy = true; this.dialogError = '';
        try { await this.api.request('pinPost', {postId: this.pinTarget.id, mode: this.pinMode}); this.dialog = ''; this.notice = this.pinMode === 'none' ? '상단 고정을 해제했습니다.' : '해당 방 상단과 고정된 글에 표시했습니다.'; await this.load(); }
        catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }
    members: CommunityMember[] = [];
    comments: CommunityComment[] = [];
    accepted: CommunityComment | null = null;
    selected: CommunityPost | null = null;
    nextCursor: [number, string] | null = null;
    dialog: '' | 'join' | 'editor' | 'profile' | 'delete' | 'notifications' | 'notificationSettings' | 'instagram' | 'settings' | 'withdraw' | 'pin' | 'newsletter' = '';
    private readonly sanitizer = inject(DomSanitizer);
    newsletterTarget: CommunityPost | null = null;
    editingNewsletterStatus: CommunityPost | null = null;
    newsletterPreview: SafeHtml = '';
    private newsletterRequests = new Map<string, string>();
    prepareNewsletter(post: CommunityPost) {
        if (!this.isAdmin || post.isPrivate) return;
        this.newsletterTarget = post;
        const mail = renderCommunityNewsletter(post.title, post.body, 'https://club.notionable.net/?post=' + encodeURIComponent(post.id), {authorName:post.authorName,roomName:this.roomName(post.roomId),publishedAt:post.createdAt}, post.bodyDocument);
        // Only the escaped, application-owned mail template is trusted in this sandboxed preview.
        this.newsletterPreview = this.sanitizer.bypassSecurityTrustHtml(mail.html);
        this.openDialog('newsletter');
    }
    async sendNewsletter() {
        const post = this.newsletterTarget;
        if (!post || this.busy || !this.isAdmin || post.isPrivate) return;
        const requestId = this.newsletterRequests.get(post.id) || crypto.randomUUID();
        this.newsletterRequests.set(post.id, requestId);
        this.busy = true; this.dialogError = '';
        try {
            await this.api.request('sendNewsletter', {postId:post.id,version:post.version,requestId});
            this.newsletterRequests.delete(post.id);
            this.dialog = ''; this.notice = '뉴스레터 발송을 접수했습니다. 수신 허용 및 전체 차단 여부를 확인해 순차 발송합니다.';
            await this.load();
        } catch (e) { this.dialogError = this.message(e); }
        finally { this.busy = false; }
    }
    withdrawalStatus: string | null = null;
    withdrawalConfirmed = false;
    dialogError = '';
    talkAvailable = false;
    readonly notificationCategories = NOTIFICATION_CATEGORIES;
    notificationPreferences = notificationPreferences();
    allowMemberDm = false;
    unreadCount = 0;
    roomUnreadCounts: Record<string, number> = {};
    private roomCountGeneration = 0;
    async refreshRoomUnreadCounts() {
        if (!this.member || this.destroyed) return;
        const request = ++this.roomCountGeneration;
        try {
            const result = await this.api.request('roomUnreadCounts');
            if (!this.destroyed && request === this.roomCountGeneration) this.roomUnreadCounts = result.counts || {};
        } catch { /* Keep the last confirmed counts until the next refresh. */ }
    }
    notifications: Array<{id: string; type: string; message: string; postId: string; postTitle: string; createdAt: number; read: boolean}> = [];
    notificationCursor: [number, string] | null = null;
    notificationsLoading = false;
    private notificationTimer?: ReturnType<typeof setInterval>;
    private notificationSettingsConfirmed = false;
    name = '';
    bio = '';
    avatarDraft = '';
    avatarProcessing = false;
    shareChannels = {newsletter: false, kakao: false, instagram: false};
    instagramCaption = '';
    instagramImage = '';
    instagramPostId = '';
    instagramPublishedUrl = '';
    draftRevision = 0;
    draftPreview: SavedClubDraft | null = null;
    savedDrafts: SavedClubDraft[] = [];
    get showingDrafts() { return this.view === 'mine' && this.route.snapshot.queryParamMap.get('drafts') === '1'; }
    showDrafts() { void this.router.navigate([this.communityHome], {queryParams:{view:'mine',drafts:1}}); }
    openSavedDraft(draft: SavedClubDraft) { void this.router.navigate([this.communityHome], {queryParams:{view:'mine',draft:draft.id}}); }
    editSavedDraft(saved: SavedClubDraft) {
        this.draft = {id:saved.id, roomId:saved.roomId, kind:saved.kind, title:saved.title, body:saved.body, bodyDocument:saved.bodyDocument, media: saved.media.map(m=>({...m})), isPrivate:saved.isPrivate, version:0};
        this.draftRevision = saved.revision; this.shareChannels = {...saved.sharing}; this.videoUrl=''; this.openDialog('editor');
    }
    async deleteSavedDraft(saved: SavedClubDraft) {
        if (this.busy || !window.confirm('이 임시저장 글을 삭제할까요?')) return;
        this.busy=true; this.error='';
        try { await this.api.request('deleteDraft',{draftId:saved.id,revision:saved.revision}); this.showDrafts(); }
        catch(e) { this.error=this.message(e); } finally { this.busy=false; }
    }
    async saveDraft() {
        if(this.busy || this.mediaProcessing || this.draft.version) return;
        if(this.videoUrl.trim()) { this.addVideo(); if(this.videoUrl.trim()) return; }
        this.busy=true; this.dialogError='';
        try { const result=await this.api.request('saveDraft',{...this.draft,draftId:this.draft.id,revision:this.draftRevision,sharing:this.shareChannels});
            this.draftRevision=result.draft.revision; this.dialog=''; this.notice='임시저장했습니다. 나에게만 보이며 알림은 발송되지 않았습니다.';
            if(this.route.snapshot.queryParamMap.get('draft')===result.draft.id) await this.load(); else this.openSavedDraft(result.draft);
        } catch(e) { this.dialogError=this.message(e); } finally { this.busy=false; }
    }
    updateDocument(value: {body:string;bodyDocument:ClubDocument}) { Object.assign(this.draft,value); }
    draft = { bodyDocument: null as ClubDocument | null, id: '', roomId: 'hello', kind: 'feed', title: '', body: '', media: [] as CommunityMedia[], isPrivate: false, version: 0 };
    mediaProcessing = false;
    videoUrl = '';
    addVideo() {
        if (this.busy || this.mediaProcessing) return;
        const src = communityVideoUrl(this.videoUrl.trim());
        if (!src) { this.dialogError = 'YouTube 또는 Vimeo 동영상의 HTTPS 링크를 입력해주세요.'; return; }
        if (this.draft.media.filter(item => item.type === 'video').length >= 3) { this.dialogError = '동영상은 최대 3개까지 추가할 수 있습니다.'; return; }
        this.draft.media.push({type: 'video', src}); this.videoUrl = ''; this.dialogError = '';
    }
    async selectPostPhotos(event: Event) {
        const input = event.target as HTMLInputElement;
        const files = Array.from(input.files || []); input.value = '';
        if (this.busy || this.mediaProcessing || !files.length) return;
        if (files.length + this.draft.media.filter(item => item.type === 'image').length > 3) { this.dialogError = '사진은 최대 3장까지 추가할 수 있습니다.'; return; }
        this.mediaProcessing = true; this.dialogError = '';
        try {
            const photos: CommunityMedia[] = [];
            for (const file of files) {
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('5MB 이하의 JPG·PNG·WebP 사진을 선택해주세요.');
                const bitmap = await createImageBitmap(file);
                try {
                    const canvas = document.createElement('canvas');
                    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
                    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                    const context = canvas.getContext('2d');
                    if (!context) throw new Error('사진을 처리할 수 없습니다.');
                    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
                    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                    let src = canvas.toDataURL('image/jpeg', .85);
                    for (let quality = .75; src.length > 180000 && quality >= .25; quality -= .1) src = canvas.toDataURL('image/jpeg', quality);
                    if (src.length > 180000) throw new Error('사진이 너무 복잡하거나 큽니다. 크기를 줄인 후 다시 선택해주세요.');
                    photos.push({type: 'image', src});
                } finally { bitmap.close(); }
            }
            this.draft.media.push(...photos);
        } catch (error) { this.dialogError = this.message(error); }
        finally { this.mediaProcessing = false; }
    }
    replyBody = '';
    replyId = '';
    replyVersion = 0;
    deleteTarget: { post: CommunityPost; comment?: CommunityComment } | null = null;
    private subscription?: Subscription;
    private generation = 0;
    private focusBeforeDialog: HTMLElement | null = null;
    private destroyed = false;

    readonly communityHome = communityHomePath();
    get communityReturnUrl() { return isCommunityReturnPath(this.router.url) ? this.router.url : this.communityHome; }
    get room() { return this.rooms.find(r => r.id === this.roomId); }
    get writableRooms() { return this.rooms.filter(r => isCommunityRoomVisible(r.id) && (this.isAdmin || !r.adminOnly)); }
    get writableRoomGroups() { return this.groups.map(group => ({ group, rooms: this.writableRooms.filter(room => room.group === group) })).filter(item => item.rooms.length); }
    get currentProfileName() { return this.member?.name || this.auth.account()?.displayName || '멤버'; }
    get currentProfilePhoto() { return this.member?.avatar || ''; }
    get ownId() { return this.auth.account()?.uid || ''; }
    get title() { return this.view === 'members' ? '멤버' : this.view === 'mine' ? '내 글' : this.room?.name || '전체 글'; }
    get canWrite() { return !!this.member && (!this.room?.adminOnly || this.isAdmin); }
    get mixedRoom() { return !this.room || this.room.kind === 'both'; }
    get requestsAllowed() { return supportsCommunityRequests(this.roomId); }
    get draftRequestsAllowed() { return supportsCommunityRequests(this.draft.roomId); }
    get draftRoom() { return this.rooms.find(r => r.id === this.draft.roomId); }
    roomMenuOpen = false;
    selectDraftRoom(roomId: string) { this.draft.roomId = roomId; this.roomMenuOpen = false; this.syncDraftKind(); }
    syncDraftKind() { if (this.draft.kind === 'request' && !this.draftRequestsAllowed) this.draft.kind = 'feed'; if (this.draft.kind !== 'request' && this.draftRoom && this.draftRoom.kind !== 'both') this.draft.kind = this.draftRoom.kind; }
    get editingQuestion() { return this.draft.kind === 'question' || (this.draft.roomId === 'questions' && this.draft.kind !== 'request'); }
    get visibleComments() { return this.comments.filter(c => !c.deleted && c.id !== this.accepted?.id); }
    roomsIn(group: string) { return this.rooms.filter(r => r.group === group && isCommunityRoomVisible(r.id)); }
    roomName(id: string) { return this.rooms.find(r => r.id === id)?.name || id; }
    routePostPending() { return !!this.route.snapshot.queryParamMap.get('post'); }
    initials(name: string) { return name.trim().slice(0, 1).toUpperCase() || 'N'; }
    mayEdit(authorId: string) { return authorId === this.ownId || this.isAdmin; }

    async ngOnInit() {
        try {
            await this.auth.init();
            if (this.auth.account()) {
                const state = await this.api.request('state');
                this.member = state.member; this.isAdmin = state.isAdmin; this.withdrawalStatus = state.withdrawalStatus || null;
                this.talkAvailable = !!state.talkAvailable;
                this.notificationPreferences = notificationPreferences(state.notificationSettings);
                this.allowMemberDm = state.allowMemberDm === true;
                this.notificationSettingsConfirmed = !!state.notificationSettings?.confirmed;
                this.unreadCount = state.unreadCount || 0;
                if (this.member && (!this.notificationSettingsConfirmed || this.route.snapshot.queryParamMap.get('settings') === 'notifications')) this.openDialog('notificationSettings');
                if (!this.member && !this.withdrawalStatus) { this.name = (this.auth.account()?.displayName || '').slice(0, 40); this.openDialog('join'); }
            }
        } catch (e) { this.error = this.message(e); }
        this.ready = true;
        if (this.destroyed) return;
        this.subscription?.unsubscribe();
        if (this.notificationTimer) clearInterval(this.notificationTimer);
        this.notificationTimer = setInterval(() => { if (this.member && !document.hidden) { void this.refreshNotificationCount(); void this.refreshRoomUnreadCounts(); if ([...this.pinnedPosts, ...this.sidebarPinnedPosts].some(post => (post.pinExpiresAt || 0) <= Date.now())) void this.load(); } }, 60000);
        this.subscription = this.route.queryParamMap.subscribe(params => {
            const r = params.get('room') || '';
            this.roomId = isCommunityRoomVisible(r) ? r : '';
            this.kind = ['feed', 'question', 'request'].includes(params.get('kind') || '') ? params.get('kind')! : '';
            if (this.kind === 'request' && !this.requestsAllowed) this.kind = '';
            this.view = ['members', 'mine'].includes(params.get('view') || '') ? params.get('view')! : 'home';
            this.sidebarOpen = false;
            this.replyBody = ''; this.replyId = ''; this.replyVersion = 0;
            if (this.member) void this.load(false);
        });
    }
    ngOnDestroy() { this.destroyed = true; this.generation++; this.subscription?.unsubscribe(); if (this.notificationTimer) clearInterval(this.notificationTimer); }
    private message(e: unknown) { return e instanceof Error ? e.message : '처리하지 못했습니다. 다시 시도해주세요.'; }
    navigate(room = '', view = 'home', kind = '') {
        void this.router.navigate([this.communityHome], { queryParams: { room: room || null, view: view === 'home' ? null : view, kind: kind || null } });
    }
    openPost(post: CommunityPost) {
        void this.router.navigate([this.communityHome], { queryParams: { room: this.roomId || null, kind: this.kind || null, view: this.view === 'mine' ? 'mine' : null, post: post.id } });
    }
    async load(more = false) {
        if (!this.member || (more && !this.nextCursor)) return;
        const generation = ++this.generation;
        this.loading = true; this.error = '';
        if (!more) { this.draftPreview = null; this.savedDrafts = []; this.sidebarPinnedPosts = []; this.popularPosts = []; this.pinnedPosts = []; this.posts = []; this.members = []; this.selected = null; this.comments = []; this.accepted = null; this.nextCursor = null; }
        const postId = this.route.snapshot.queryParamMap.get('post');
        try {
            const draftId = this.route.snapshot.queryParamMap.get('draft');
            if (this.view === 'mine' && (draftId || this.showingDrafts)) {
                const [result, pins] = await Promise.all([
                    this.api.request(draftId ? 'draft' : 'drafts', {draftId, cursor:more ? this.nextCursor : null}),
                    this.api.request('pins')
                ]);
                if (generation !== this.generation) return;
                this.sidebarPinnedPosts = pins.posts || [];
                if (draftId) this.draftPreview = result.draft;
                else this.savedDrafts = more ? [...this.savedDrafts,...result.drafts] : result.drafts;
                this.nextCursor=result.nextCursor || null; return;
            }
            const [result, pins] = await Promise.all([this.api.request(this.view === 'members' ? 'members' : postId ? 'post' : 'feed', {
                roomId: this.roomId, kind: this.kind, mine: this.view === 'mine', ...(postId ? { postId } : {}), cursor: more ? this.nextCursor : null
            }), this.loadPinnedSidebar ? this.api.request('pins', {roomId: this.view === 'mine' ? '' : this.roomId, includePopular:this.showPopularPosts}) : Promise.resolve({posts:[]})]);
            if (generation !== this.generation) return;
            this.sidebarPinnedPosts = pins.posts || [];
            this.popularPosts = pins.popularPosts || [];
            this.nextCursor = result.nextCursor;
            if (this.view === 'members') this.members = more ? [...this.members, ...result.members] : result.members;
            else if (postId) { this.selected = result.post; this.accepted = result.accepted; this.comments = more ? [...this.comments, ...result.comments] : result.comments; }
            else { this.pinnedPosts = result.pinnedPosts || []; this.posts = more ? [...this.posts, ...result.posts] : result.posts; }
            void this.refreshRoomUnreadCounts();
        } catch (e) { if (generation === this.generation) this.error = this.message(e); }
        finally { if (generation === this.generation) this.loading = false; }
    }
    openDialog(dialog: typeof this.dialog) {
        if (!this.dialog) this.focusBeforeDialog = document.activeElement as HTMLElement;
        this.dialogError = ''; this.dialog = dialog; this.accountOpen = false;
        if (dialog === 'withdraw') this.withdrawalConfirmed = false;
        setTimeout(() => document.querySelector<HTMLElement>('[role="dialog"] input, [role="dialog"] button')?.focus());
    }
    closeDialog() { if (this.busy || this.avatarProcessing || this.mediaProcessing) return; this.dialog = ''; this.dialogError = ''; this.focusBeforeDialog?.focus(); }
    @HostListener('document:keydown', ['$event']) onKey(event: KeyboardEvent) {
        if (event.key === 'Escape' && this.roomMenuOpen) { this.roomMenuOpen = false; event.stopPropagation(); return; }
        if (event.key === 'Escape') {
            if (this.dialog === 'editor') return;
            this.closeDialog(); this.sidebarOpen = false; this.accountOpen = false;
        }
        if (event.key !== 'Tab' || !this.dialog) return;
        const controls = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button:not(:disabled), [role="dialog"] input, [role="dialog"] textarea, [role="dialog"] select, [role="dialog"] [contenteditable="true"], [role="dialog"] a[href]')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    async join() {
        if (this.busy || !this.name.trim()) return;
        this.busy = true; this.dialogError = '';
        try {
            const result = await this.api.request('join', { name: this.name, consent: true, categories: this.notificationPreferences });
            this.member = result.member; this.notificationSettingsConfirmed = true; this.dialog = ''; this.notice = '';
            await this.load();
        } catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }
    editPost(post?: CommunityPost) {
        this.editingNewsletterStatus = post || null;
        this.draftRevision=0;
        this.shareChannels = {newsletter: !!post?.sharing?.newsletter, kakao: !!post?.sharing?.kakao, instagram: !!post?.sharing?.instagram};
        this.draft = post ? { bodyDocument: post.bodyDocument || null, id: post.id, roomId: post.roomId, kind: post.kind, title: post.title, body: post.body, media: (post.media || []).map(item => ({...item})), isPrivate: !!post.isPrivate, version: post.version }
            : { bodyDocument: null, id: crypto.randomUUID(), roomId: this.canWrite && this.roomId ? this.roomId : 'hello', kind: this.kind || (this.room?.kind === 'question' ? 'question' : this.room?.kind === 'request' ? 'request' : 'feed'), title: '', body: '', media: [] as CommunityMedia[], isPrivate: false, version: 0 };
        this.videoUrl = '';
        this.syncDraftKind();
        this.openDialog('editor');
    }
    async prepareInstagram(post: CommunityPost) {
        if (post.isPrivate || !this.isAdmin || post.authorId !== this.ownId || !post.sharing?.instagram) return;
        await document.fonts.ready;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        if (!ctx) { this.error = '이미지를 만들 수 없습니다. 다른 브라우저에서 다시 시도해주세요.'; return; }
        ctx.fillStyle = '#f3f0ff'; ctx.fillRect(0, 0, 1080, 1080);
        ctx.fillStyle = '#ded5ff'; ctx.beginPath(); ctx.arc(1030, 40, 300, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#5941a9'; ctx.font = 'bold 26px LifeupCommunityPretendard, sans-serif';
        ctx.fillText('LIFEUP COMMUNITY', 88, 120);
        ctx.fillStyle = '#202124'; ctx.font = 'bold 64px LifeupCommunityPretendard, sans-serif';
        const lines: string[] = []; let line = '';
        for (const char of Array.from(post.title)) {
            if (ctx.measureText(line + char).width > 900) { lines.push(line); line = char; }
            else line += char;
        }
        if (line) lines.push(line);
        lines.slice(0, 7).forEach((value, i) => ctx.fillText(i === 6 && lines.length > 7 ? value.slice(0, -1) + '…' : value, 88, 300 + i * 86));
        ctx.fillStyle = '#5941a9'; ctx.font = '28px LifeupCommunityPretendard, sans-serif';
        ctx.fillText('경험을 나누고, 함께 성장하는 곳', 88, 948);
        ctx.font = '24px LifeupCommunityPretendard, sans-serif'; ctx.fillText('@notionable_net', 88, 998);
        this.instagramImage = canvas.toDataURL('image/jpeg', 0.94);
        this.instagramPostId = post.id;
        this.instagramPublishedUrl = post.sharedInstagramUrl || '';
        const footer = '\n\n노셔너블 클럽에서 이어서 읽기 (멤버 로그인 필요)\nhttps://club.notionable.net/?post=' + encodeURIComponent(post.id);
        const content = post.title + '\n\n' + post.body;
        const available = 2200 - footer.length;
        this.instagramCaption = (content.length > available ? content.slice(0, available - 1) + '…' : content) + footer;
        this.openDialog('instagram');
    }
    async saveInstagramLink() {
        if (this.busy) return;
        this.busy = true; this.dialogError = '';
        try {
            const result = await this.api.request('instagramLink', {postId: this.instagramPostId, url: this.instagramPublishedUrl.trim()});
            if (this.selected && this.selected.id === result.post.id) Object.assign(this.selected, result.post);
            const post = this.posts.find(p => p.id === result.post.id); if (post) Object.assign(post, result.post);
            this.instagramPublishedUrl = result.post.sharedInstagramUrl || '';
            this.dialogError = this.instagramPublishedUrl ? '공유 링크를 저장했습니다.' : '공유 링크를 제거했습니다.';
        } catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }
    async copyInstagramCaption() {
        try { await navigator.clipboard.writeText(this.instagramCaption); this.dialogError = '캡션을 복사했습니다.'; }
        catch { this.dialogError = '자동 복사를 사용할 수 없습니다. 캡션을 선택해 직접 복사해주세요.'; }
    }
    async savePost(previewNewsletter = false) {
        if (this.busy || this.mediaProcessing) return;
        if (previewNewsletter && (!this.isAdmin || !this.draft.version || this.draft.isPrivate)) return;
        if (this.videoUrl.trim()) { this.addVideo(); if (this.videoUrl.trim()) return; }
        this.busy = true; this.dialogError = '';
        try {
            const result = await this.api.request('savePost', { ...this.draft, ...(this.draftRevision ? {draftRevision:this.draftRevision} : {}), postId: this.draft.id, ...(this.isAdmin && !this.draft.version && !this.draft.isPrivate ? {sharing: {newsletter: false, kakao: false, instagram: false}} : {}) });
            this.dialog = ''; this.notice = this.draft.version ? '글을 수정했습니다.' : '글을 게시했습니다.';
            if (this.route.snapshot.queryParamMap.get('post') === result.post.id) await this.load(); else this.openPost(result.post);
            if (previewNewsletter) this.prepareNewsletter(result.post);
        } catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }
    async like(post: CommunityPost) {
        if (this.busy) return;
        this.busy = true; this.error = '';
        try { Object.assign(post, await this.api.request('like', { postId: post.id, liked: !post.liked })); }
        catch (e) { this.error = this.message(e); } finally { this.busy = false; }
    }
    editReply(comment: CommunityComment) {
        this.replyBody = comment.body; this.replyId = comment.id; this.replyVersion = comment.version;
        setTimeout(() => document.getElementById('reply-body')?.focus());
    }
    cancelReply() { this.replyId = ''; this.replyVersion = 0; this.replyBody = ''; }
    async saveReply() {
        if (this.busy || !this.selected || !this.replyBody.trim()) return;
        this.busy = true; this.error = '';
        this.replyId ||= crypto.randomUUID();
        try {
            await this.api.request('saveComment', { postId: this.selected.id, commentId: this.replyId, body: this.replyBody, version: this.replyVersion });
            this.cancelReply(); await this.load(); this.notice = '답글을 저장했습니다.';
        } catch (e) { this.error = this.message(e); } finally { this.busy = false; }
    }
    async accept(comment: CommunityComment) {
        if (this.busy || !this.selected) return;
        this.busy = true; this.error = '';
        try {
            await this.api.request('accept', { postId: this.selected.id, commentId: comment.id, accepted: this.selected.acceptedCommentId !== comment.id });
            await this.load();
        } catch (e) { this.error = this.message(e); } finally { this.busy = false; }
    }
    askDelete(post: CommunityPost, comment?: CommunityComment) { this.deleteTarget = { post, comment }; this.openDialog('delete'); }
    async remove() {
        if (this.busy || !this.deleteTarget) return;
        this.busy = true; this.dialogError = '';
        const { post, comment } = this.deleteTarget;
        try {
            await this.api.request(comment ? 'deleteComment' : 'deletePost', { postId: post.id, commentId: comment?.id, version: comment?.version ?? post.version });
            this.dialog = ''; this.notice = '삭제했습니다.';
            if (comment) { this.cancelReply(); await this.load(); } else this.navigate(this.roomId, 'home', this.kind);
        } catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }
    async withdrawCommunity() {
        if (this.busy || !this.member || !this.withdrawalConfirmed) return;
        this.busy = true; this.dialogError = '';
        try {
            const result = await this.api.request('withdraw', {consent: true, confirmation: '클럽 탈퇴'});
            this.generation++; this.roomCountGeneration++;
            this.member = null; this.withdrawalStatus = result.withdrawalStatus || 'pending';
            this.posts = []; this.members = []; this.comments = []; this.selected = null; this.accepted = null;
            this.notifications = []; this.unreadCount = 0; this.roomUnreadCounts = {};
            this.nextCursor = null; this.notificationCursor = null; this.loading = false;
            this.replyBody = ''; this.replyId = ''; this.deleteTarget = null;
            this.draft = {bodyDocument: null, id: '', roomId: 'hello', kind: 'feed', title: '', body: '', media: [] as CommunityMedia[], isPrivate: false, version: 0};
            this.draftPreview = null; this.savedDrafts = []; this.draftRevision = 0;
            this.name = ''; this.bio = ''; this.avatarDraft = ''; this.instagramImage = ''; this.instagramCaption = '';
            this.notificationPreferences = notificationPreferences({email:false,talk:false});
            this.dialog = ''; this.accountOpen = false; this.sidebarOpen = false; this.error = ''; this.notice = '';
            if (this.notificationTimer) clearInterval(this.notificationTimer);
            await this.router.navigate([this.communityHome], {replaceUrl: true});
            setTimeout(() => document.getElementById('withdrawal-complete')?.focus());
        } catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }
    editProfile() {
        this.name = this.member?.name || ''; this.bio = this.member?.bio || '';
        this.avatarDraft = this.member?.avatar || ''; this.openDialog('profile');
    }
    async selectAvatar(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0]; input.value = '';
        if (!file || this.busy || this.avatarProcessing) return;
        this.dialogError = '';
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
            this.dialogError = '5MB 이하의 JPG·PNG·WebP 사진을 선택해주세요.'; return;
        }
        this.avatarProcessing = true;
        const url = URL.createObjectURL(file);
        try {
            const image = new Image(); image.src = url; await image.decode();
            if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 25000000) {
                throw new Error('사진의 해상도가 너무 큽니다. 2,500만 화소 이하의 사진을 선택해주세요.');
            }
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 192;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('사진을 처리하지 못했습니다. 다른 브라우저에서 다시 시도해주세요.');
            const side = Math.min(image.naturalWidth, image.naturalHeight);
            context.fillStyle = '#ffffff'; context.fillRect(0, 0, 192, 192);
            context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 192, 192);
            if (!this.destroyed) this.avatarDraft = canvas.toDataURL('image/jpeg', 0.85);
        } catch (e) {
            this.dialogError = e instanceof Error && e.name !== 'EncodingError' ? e.message : '사진을 열 수 없습니다. 다른 사진을 선택해주세요.';
        } finally { URL.revokeObjectURL(url); this.avatarProcessing = false; }
    }
    removeAvatar() { if (!this.busy && !this.avatarProcessing) { this.avatarDraft = ''; this.dialogError = ''; } }
    async saveProfile() {
        if (this.busy || this.avatarProcessing || this.mediaProcessing) return;
        this.busy = true; this.dialogError = '';
        try {
            const result = await this.api.request('profile', { name: this.name, bio: this.bio,
                ...(this.avatarDraft !== (this.member?.avatar || '') ? {avatar: this.avatarDraft} : {}) });
            this.member = result.member; this.dialog = '';
            // Update already-rendered historical content without resetting reply drafts or pagination.
            for (const item of [...this.posts, ...this.comments, ...(this.selected ? [this.selected] : []), ...(this.accepted ? [this.accepted] : [])]) {
                if (item.authorId === this.ownId) item.authorAvatar = result.member.avatar || '';
            }
            this.members = this.members.map(m => m.id === this.ownId ? result.member : m);
            this.notice = '프로필을 저장했습니다.';
        }
        catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }
    async refreshNotificationCount() {
        if (!this.member) return;
        try { const result = await this.api.request('notificationCount'); if (!this.destroyed && this.member) this.unreadCount = result.unreadCount || 0; }
        catch { /* Background refresh is best effort; opening notifications reports errors. */ }
    }
    async openNotifications() {
        this.openDialog('notifications');
        await this.loadNotifications();
    }
    async loadNotifications(more = false) {
        if (this.notificationsLoading) return;
        this.notificationsLoading = true; this.dialogError = '';
        try {
            const result = await this.api.request('notifications', { cursor: more ? this.notificationCursor : null });
            if (this.destroyed || !this.member) return;
            this.notifications = more ? [...this.notifications, ...result.items] : result.items;
            this.notificationCursor = result.nextCursor; this.unreadCount = result.unreadCount;
        } catch (e) { this.dialogError = this.message(e); } finally { this.notificationsLoading = false; }
    }
    async readNotification(item: typeof this.notifications[number]) {
        if (this.busy) return;
        this.busy = true;
        try {
            await this.api.request('readNotification', { notificationId: item.id });
            if (!item.read) this.unreadCount = Math.max(0, this.unreadCount - 1);
            item.read = true; this.dialog = '';
            await this.router.navigate([this.communityHome], { queryParams: { post: item.postId } });
        } catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }
    async readAllNotifications() {
        if (this.busy) return; this.busy = true;
        try { await this.api.request('readAllNotifications'); this.unreadCount = 0; this.notifications.forEach(item => item.read = true); }
        catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }
    async saveNotificationSettings() {
        if (this.busy) return; this.busy = true; this.dialogError = '';
        try {
            await this.api.request('notificationSettings', { categories: this.notificationPreferences, allowMemberDm: this.allowMemberDm });
            this.notificationSettingsConfirmed = true; this.dialog = ''; this.notice = '알림 설정을 저장했습니다.';
        } catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }

}

interface SavedClubDraft {id:string; roomId:string; kind:string; title:string; body:string; bodyDocument:ClubDocument|null; media:CommunityMedia[]; isPrivate:boolean; revision:number; updatedAt:number; sharing:{newsletter:boolean;kakao:boolean;instagram:boolean}}
