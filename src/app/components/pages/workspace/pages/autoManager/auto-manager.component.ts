import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auto-manager',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auto-manager.component.html',
  styleUrls: ['./auto-manager.component.css']
})
export class AutoManagerComponent {

  services = [
    {
      serviceName: 'Notion AI 업무 시스템',
      purchaseVerified: true,
      apiConnected: true,
      templateInfo: '영업 CRM + 고객관리'
    },
    {
      serviceName: '콘텐츠 자동화 시스템',
      purchaseVerified: true,
      apiConnected: false,
      templateInfo: '블로그 자동 발행'
    }
  ];

}