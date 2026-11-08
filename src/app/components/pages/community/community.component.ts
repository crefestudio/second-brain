import { Component, HostBinding, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { SocialAuthService } from '../../../services/social-auth.service';
import { CommunityService, COMMUNITY_ROOMS, CommunityPost, CommunityComment, CommunityMember } from '../../../services/community.service';
import { CommunityIconComponent } from './community-icon.component';

@Component({ selector: 'app-community', standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, CommunityIconComponent],
    templateUrl: './community.component.html', styleUrls: ['./community.component.css', './community-content.css', './community-dialog.css', './community-responsive.css', './community-theme.css', './community-notifications.css'] })
export class CommunityComponent implements OnInit, OnDestroy {
    readonly auth = inject(SocialAuthService);
    private readonly api = inject(CommunityService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    readonly rooms = COMMUNITY_ROOMS;
    readonly groups = ['시작하기', '소통', '스터디', '개발'];
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
    posts: CommunityPost[] = [];
    members: CommunityMember[] = [];
    comments: CommunityComment[] = [];
    accepted: CommunityComment | null = null;
    selected: CommunityPost | null = null;
    nextCursor: [number, string] | null = null;
    dialog: '' | 'join' | 'editor' | 'profile' | 'delete' | 'notifications' | 'notificationSettings' | 'instagram' = '';
    dialogError = '';
    talkAvailable = false;
    emailNotifications = true;
    talkNotifications = true;
    unreadCount = 0;
    notifications: Array<{id: string; type: string; message: string; postId: string; postTitle: string; createdAt: number; read: boolean}> = [];
    notificationCursor: [number, string] | null = null;
    notificationsLoading = false;
    private notificationTimer?: ReturnType<typeof setInterval>;
    private notificationSettingsConfirmed = false;
    name = '';
    bio = '';
    shareChannels = {newsletter: false, kakao: false, instagram: false};
    instagramCaption = '';
    instagramImage = '';
    instagramPostId = '';
    draft = { id: '', roomId: 'hello', kind: 'feed', title: '', body: '', version: 0 };
    replyBody = '';
    replyId = '';
    replyVersion = 0;
    deleteTarget: { post: CommunityPost; comment?: CommunityComment } | null = null;
    private subscription?: Subscription;
    private generation = 0;
    private focusBeforeDialog: HTMLElement | null = null;
    private destroyed = false;

    get communityReturnUrl() { return this.router.url.startsWith('/community') ? this.router.url : '/community'; }
    get room() { return this.rooms.find(r => r.id === this.roomId); }
    get writableRooms() { return this.rooms.filter(r => this.isAdmin || !r.adminOnly); }
    get ownId() { return this.auth.account()?.uid || ''; }
    get title() { return this.view === 'members' ? '멤버' : this.room?.name || '전체 글'; }
    get canWrite() { return !!this.member && (!this.room?.adminOnly || this.isAdmin); }
    get mixedRoom() { return !this.room || this.room.kind === 'both'; }
    get draftRoom() { return this.rooms.find(r => r.id === this.draft.roomId); }
    syncDraftKind() { if (this.draftRoom && this.draftRoom.kind !== 'both') this.draft.kind = this.draftRoom.kind; }
    get editingQuestion() { return this.draft.kind === 'question' || this.draft.roomId === 'questions'; }
    get visibleComments() { return this.comments.filter(c => c.id !== this.accepted?.id); }
    roomsIn(group: string) { return this.rooms.filter(r => r.group === group); }
    roomName(id: string) { return this.rooms.find(r => r.id === id)?.name || id; }
    routePostPending() { return !!this.route.snapshot.queryParamMap.get('post'); }
    initials(name: string) { return name.trim().slice(0, 1).toUpperCase() || 'N'; }
    mayEdit(authorId: string) { return authorId === this.ownId || this.isAdmin; }

    async ngOnInit() {
        try {
            await this.auth.init();
            if (this.auth.account()) {
                const state = await this.api.request('state');
                this.member = state.member; this.isAdmin = state.isAdmin;
                this.talkAvailable = !!state.talkAvailable;
                this.emailNotifications = state.notificationSettings?.email !== false;
                this.talkNotifications = state.notificationSettings?.talk !== false;
                this.notificationSettingsConfirmed = !!state.notificationSettings?.confirmed;
                this.unreadCount = state.unreadCount || 0;
                if (this.member && (!this.notificationSettingsConfirmed || this.route.snapshot.queryParamMap.get('settings') === 'notifications')) this.openDialog('notificationSettings');
                if (!this.member) { this.name = (this.auth.account()?.displayName || '').slice(0, 40); this.openDialog('join'); }
            }
        } catch (e) { this.error = this.message(e); }
        this.ready = true;
        if (this.destroyed) return;
        this.subscription?.unsubscribe();
        if (this.notificationTimer) clearInterval(this.notificationTimer);
        this.notificationTimer = setInterval(() => { if (this.member && !document.hidden) void this.refreshNotificationCount(); }, 60000);
        this.subscription = this.route.queryParamMap.subscribe(params => {
            const r = params.get('room') || '';
            this.roomId = this.rooms.some(x => x.id === r) ? r : '';
            this.kind = ['feed', 'question'].includes(params.get('kind') || '') ? params.get('kind')! : '';
            if (this.room && this.room.kind !== 'both') this.kind = '';
            this.view = params.get('view') === 'members' ? 'members' : 'home';
            this.sidebarOpen = false;
            this.replyBody = ''; this.replyId = ''; this.replyVersion = 0;
            if (this.member) void this.load(false);
        });
    }
    ngOnDestroy() { this.destroyed = true; this.generation++; this.subscription?.unsubscribe(); if (this.notificationTimer) clearInterval(this.notificationTimer); }
    private message(e: unknown) { return e instanceof Error ? e.message : '처리하지 못했습니다. 다시 시도해주세요.'; }
    navigate(room = '', view = 'home', kind = '') {
        void this.router.navigate(['/community'], { queryParams: { room: room || null, view: view === 'home' ? null : view, kind: kind || null } });
    }
    openPost(post: CommunityPost) {
        void this.router.navigate(['/community'], { queryParams: { room: this.roomId || null, kind: this.kind || null, post: post.id } });
    }
    async load(more = false) {
        if (!this.member || (more && !this.nextCursor)) return;
        const generation = ++this.generation;
        this.loading = true; this.error = '';
        if (!more) { this.posts = []; this.members = []; this.selected = null; this.comments = []; this.accepted = null; this.nextCursor = null; }
        const postId = this.route.snapshot.queryParamMap.get('post');
        try {
            const result = await this.api.request(this.view === 'members' ? 'members' : postId ? 'post' : 'feed', {
                roomId: this.roomId, kind: this.kind, ...(postId ? { postId } : {}), cursor: more ? this.nextCursor : null
            });
            if (generation !== this.generation) return;
            this.nextCursor = result.nextCursor;
            if (this.view === 'members') this.members = more ? [...this.members, ...result.members] : result.members;
            else if (postId) { this.selected = result.post; this.accepted = result.accepted; this.comments = more ? [...this.comments, ...result.comments] : result.comments; }
            else this.posts = more ? [...this.posts, ...result.posts] : result.posts;
        } catch (e) { if (generation === this.generation) this.error = this.message(e); }
        finally { if (generation === this.generation) this.loading = false; }
    }
    openDialog(dialog: typeof this.dialog) {
        this.focusBeforeDialog = document.activeElement as HTMLElement;
        this.dialogError = ''; this.dialog = dialog; this.accountOpen = false;
        setTimeout(() => document.querySelector<HTMLElement>('[role="dialog"] input, [role="dialog"] button')?.focus());
    }
    closeDialog() { if (this.busy) return; this.dialog = ''; this.dialogError = ''; this.focusBeforeDialog?.focus(); }
    @HostListener('document:keydown', ['$event']) onKey(event: KeyboardEvent) {
        if (event.key === 'Escape') { this.closeDialog(); this.sidebarOpen = false; this.accountOpen = false; }
        if (event.key !== 'Tab' || !this.dialog) return;
        const controls = [...document.querySelectorAll<HTMLElement>('[role="dialog"] button:not(:disabled), [role="dialog"] input, [role="dialog"] textarea, [role="dialog"] select, [role="dialog"] a[href]')];
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    async join() {
        if (this.busy || !this.name.trim()) return;
        this.busy = true; this.dialogError = '';
        try {
            const result = await this.api.request('join', { name: this.name, consent: true, emailNotifications: this.emailNotifications, talkNotifications: this.talkNotifications });
            this.member = result.member; this.notificationSettingsConfirmed = true; this.dialog = ''; this.notice = '';
            await this.load();
        } catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }
    editPost(post?: CommunityPost) {
        this.shareChannels = {newsletter: !!post?.sharing?.newsletter, kakao: !!post?.sharing?.kakao, instagram: !!post?.sharing?.instagram};
        this.draft = post ? { id: post.id, roomId: post.roomId, kind: post.kind, title: post.title, body: post.body, version: post.version }
            : { id: crypto.randomUUID(), roomId: this.canWrite && this.roomId ? this.roomId : 'hello', kind: this.room?.kind === 'question' ? 'question' : 'feed', title: '', body: '', version: 0 };
        this.syncDraftKind();
        this.openDialog('editor');
    }
    async prepareInstagram(post: CommunityPost) {
        if (!this.isAdmin || post.authorId !== this.ownId || !post.sharing?.instagram) return;
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
        const footer = '\n\n라이프업 커뮤니티에서 이어서 읽기 (멤버 로그인 필요)\nhttps://community.notionable.net/community?post=' + encodeURIComponent(post.id);
        const content = post.title + '\n\n' + post.body;
        const available = 2200 - footer.length;
        this.instagramCaption = (content.length > available ? content.slice(0, available - 1) + '…' : content) + footer;
        this.openDialog('instagram');
    }
    async copyInstagramCaption() {
        try { await navigator.clipboard.writeText(this.instagramCaption); this.dialogError = '캡션을 복사했습니다.'; }
        catch { this.dialogError = '자동 복사를 사용할 수 없습니다. 캡션을 선택해 직접 복사해주세요.'; }
    }
    async savePost() {
        if (this.busy) return;
        this.busy = true; this.dialogError = '';
        try {
            const result = await this.api.request('savePost', { ...this.draft, postId: this.draft.id, ...(this.isAdmin && !this.draft.version ? {sharing: this.shareChannels} : {}) });
            this.dialog = ''; this.notice = this.draft.version ? '글을 수정했습니다.' : '글을 게시했습니다.';
            if (this.route.snapshot.queryParamMap.get('post') === result.post.id) await this.load(); else this.openPost(result.post);
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
    editProfile() { this.name = this.member?.name || ''; this.bio = this.member?.bio || ''; this.openDialog('profile'); }
    async saveProfile() {
        if (this.busy) return;
        this.busy = true; this.dialogError = '';
        try { const result = await this.api.request('profile', { name: this.name, bio: this.bio }); this.member = result.member; this.dialog = ''; if (this.view === 'members') await this.load(); this.notice = '프로필을 저장했습니다.'; }
        catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }
    async refreshNotificationCount() {
        if (!this.member) return;
        try { const result = await this.api.request('notificationCount'); if (!this.destroyed) this.unreadCount = result.unreadCount || 0; }
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
            if (this.destroyed) return;
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
            await this.router.navigate(['/community'], { queryParams: { post: item.postId } });
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
            await this.api.request('notificationSettings', { email: this.emailNotifications, talk: this.talkNotifications });
            this.notificationSettingsConfirmed = true; this.dialog = ''; this.notice = '알림 설정을 저장했습니다.';
        } catch (e) { this.dialogError = this.message(e); } finally { this.busy = false; }
    }

}
