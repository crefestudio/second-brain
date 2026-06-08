import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.scss']
})
export class ProfileComponent {
    name = '';
    editingName = false;

    email = 'test@email.com';
    editingEmail = false;
    emailError = '';

    saveName() {
        // TODO API 호출
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

        // TODO API 저장

        this.editingEmail = false;
    }

}