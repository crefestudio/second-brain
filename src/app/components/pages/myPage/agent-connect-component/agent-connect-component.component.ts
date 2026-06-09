import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../../services/user.service';


@Component({
    selector: 'app-agent-connect-component',
    imports: [CommonModule, FormsModule],
    templateUrl: './agent-connect-component.component.html',
    styleUrl: './agent-connect-component.component.css'
})
export class AgentConnectComponentComponent {
    requestMode = false;
    verifyValue = '';

    constructor(private userService: UserService) {

        // userId
    }
    async submitVerification() {
        const value = this.verifyValue.trim();

        if (!value) {
            alert('구매시 등록한 이메일을 입력해주세요.');
            return;
        }

        let email: string | undefined;
        let phone: string | undefined;

        // 이메일 검사
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (emailRegex.test(value)) {

            email = value.toLowerCase();

        } else {

            // 전화번호 검사
            const digits = value.replace(/\D/g, '');

            if (digits.length === 11 && digits.startsWith('010')) {

                phone =
                    `${digits.substring(0, 3)}-` +
                    `${digits.substring(3, 7)}-` +
                    `${digits.substring(7, 11)}`;

            } else {

                alert('올바른 이메일을 입력해주세요.');
                return;

            }
        }

        try {

            // const result = await this.userService.verifyPurchaser('lifeup', email, phone);

            // if (!result?.purchaser) {

            //     alert('구매정보를 찾을 수 없습니다. 관리자 문의로 접수합니다.');

            //     // TODO:
            //     // 관리자 메일 발송
            //     // toto791@gmail.com

            //     return;
            // }

            // // users/{userId}/purchase/lifeup 저장
            // await setDoc(
            //     doc(
            //         this.firestore,
            //         'users',
            //         this.userId,
            //         'purchase',
            //         'lifeup'
            //     ),
            //     result.purchaser,
            //     { merge: true }
            // );

            alert('구매 정보가 확인되었습니다.');

            this.requestMode = false;

        } catch (e) {

            console.error(e);

            alert('구매 확인 중 오류가 발생했습니다.');
        }
    }

    cancelVerification() {

        this.verifyValue = '';

        this.requestMode = false;
    }


}
