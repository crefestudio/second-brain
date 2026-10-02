import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Invitation, PurchaseInvitationService } from '../../../services/purchase-invitation.service';

@Component({
    selector: 'app-purchase-invitation', standalone: true, imports: [FormsModule, RouterLink],
    templateUrl: './purchase-invitation.component.html', styleUrl: './purchase-invitation.component.scss'
})
export class PurchaseInvitationComponent implements OnInit {
    private readonly service = inject(PurchaseInvitationService);
    private readonly route = inject(ActivatedRoute);
    private token = '';
    invitation: Invitation | null = null;
    name = ''; phone = ''; loading = true; busy = false; error = ''; registered = false;
    get tierLabel(): string { return this.invitation?.memberType === 'premium' ? '프리미엄' : '일반'; }
    async ngOnInit(): Promise<void> {
        this.token = new URLSearchParams(this.route.snapshot.fragment || '').get('token') || '';
        try {
            this.invitation = await this.service.inspect(this.token);
            this.registered = this.invitation.redeemed;
        } catch (error) { this.error = error instanceof Error ? error.message : '초대장을 불러오지 못했습니다.'; }
        finally { this.loading = false; }
    }
    async register(): Promise<void> {
        if (this.busy || this.registered) return;
        this.busy = true; this.error = '';
        try {
            await this.service.redeem(this.token, this.name, this.phone);
            this.registered = true;
        } catch (error) { this.error = error instanceof Error ? error.message : '구매 등록하지 못했습니다.'; }
        finally { this.busy = false; }
    }
}
