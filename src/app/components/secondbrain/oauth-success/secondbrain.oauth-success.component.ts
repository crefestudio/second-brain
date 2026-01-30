// // src/app/oauth-success/oauth-success.component.ts
// import { Component, OnInit } from '@angular/core';
// import { HttpClient } from '@angular/common/http';

// @Component({
//   selector: 'app-oauth-success',
//   templateUrl: './oauth-success.component.html',
//   styleUrls: ['./oauth-success.component.css']
// })
// export class OauthSuccessComponent implements OnInit {
//   success = false;
//   workspaceName: string | null = null;
//   botId: string | null = null;

//   constructor(private http: HttpClient) {}

//   ngOnInit(): void {
//     // query params에서 userId나 코드 받을 수 있음
//     // const params = new URLSearchParams(window.location.search);
//     // const userId = params.get('userId');

//     // if (userId) {
//     //   // Firebase Function에서 저장된 Notion 연결 정보 가져오기
//     //   this.http.get<any>(`https://us-central1-notionable-secondbrain.cloudfunctions.net/getUserNotionData?userId=${userId}`)
//     //     .subscribe({
//     //       next: data => {
//     //         this.success = true;
//     //         this.workspaceName = data.workspace_name;
//     //         this.botId = data.bot_id;
//     //       },
//     //       error: err => {
//     //         console.error('Notion data fetch failed', err);
//     //         this.success = false;
//     //       }
//     //     });
//     // }
//   }
// }

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-oauth-success',
  standalone: true, // ⭐ 이게 핵심
  imports: [
    CommonModule,
    HttpClientModule, // ⭐ HttpClient 쓰면 반드시 필요
  ],
  templateUrl: './secondbrain.oauth-success.component.html',
  styleUrls: ['./secondbrain.oauth-success.component.css'],
})
export class SecondBrainOauthSuccessComponent implements OnInit {
  success = false;
  workspaceName: string | null = null;
  botId: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // query params에서 userId나 코드 받을 수 있음
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');

    if (userId) {
      // Firebase Function에서 저장된 Notion 연결 정보 가져오기
      this.http.get<any>(`https://us-central1-notionable-secondbrain.cloudfunctions.net/getUserNotionData?userId=${userId}`)
        .subscribe({
          next: data => {
            this.success = true;
            this.workspaceName = data.workspace_name;
            this.botId = data.bot_id;
          },
          error: err => {
            console.error('Notion data fetch failed', err);
            this.success = false;
          }
        });
    }
  }
}
