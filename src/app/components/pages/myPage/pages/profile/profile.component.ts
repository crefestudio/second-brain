import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { UserService } from '../../../../../services/user.service';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {

    memberUid = '';
    name = '';
    editingName = false;

    email = '';
    editingEmail = false;
    emailError = '';

    phoneNumber = '';
    createdAt = '';
    certificateExpiredAt = '';
    hasConnectedTemplate = false;


    constructor(
        private userService: UserService
    ) { }

    async ngOnInit(): Promise<void> {

        this.memberUid =
            localStorage.getItem(
                'member_uid'
            ) ?? '';

        const userId =
            localStorage.getItem(
                'userId'
            );

        if (!userId) {
            this.hasConnectedTemplate = false;
            return;
        }

        const user = await UserService.getUser(userId);       
        this.name = user.name ?? '';
        this.email = user.email ?? '';
        this.phoneNumber = user.phoneNumber ?? '';

        this.createdAt = this.formatDate(
            user.createdAt
        );

        this.certificateExpiredAt = this.formatDate(
            user.certificateExpiredAt
        );
    }

    private formatDate(value: any): string {

        if (!value) {
            return '';
        }

        try {

            if (value.toDate) {
                return value
                    .toDate()
                    .toLocaleDateString();
            }

            return new Date(value)
                .toLocaleDateString();

        } catch {

            return '';
        }
    }

    saveName() {
        this.editingName = false;
    }

    saveEmail() {

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(this.email)) {

            this.emailError =
                '올바른 이메일 형식이 아닙니다.';

            return;
        }

        this.emailError = '';

        this.editingEmail = false;
    }
}