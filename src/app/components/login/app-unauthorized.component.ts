import { Component } from '@angular/core';

@Component({
    selector: 'app-unauthorized',
    template: `
        <div class="unauthorized-container">

            <div class="icon">
                🔒
            </div>

            <h2>
                로그인이 필요합니다
            </h2>

            <p>
                Notionable App은 회원 전용 서비스입니다.
            </p>

        </div>
    `,
    styles: [`
        :host {
            display: block;
            width: 100%;
            height: 100vh;
        }

        .unauthorized-container {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;

            width: 100%;
            height: 100%;

            text-align: center;
            padding: 16px;
            box-sizing: border-box;
        }

        .icon {
            font-size: 32px;
            margin-bottom: 8px;
        }

        h2 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            line-height: 1.4;
        }

        p {
            margin-top: 6px;
            font-size: 13px;
            color: #888;
            line-height: 1.5;
        }
    `]
})
export class UnauthorizedComponent {}