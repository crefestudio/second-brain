import { CommonModule } from '@angular/common';
import { Component, AfterViewInit, ViewChild, ElementRef, OnInit, inject } from '@angular/core';
import { APP_CONFIG, AppConfig } from '../../../config/app-config.token';
import { NotionService } from '../../../services/notion.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,  
    templateUrl: './secondbrain.setup.component.html',
    imports: [CommonModule],
    styleUrls: ['./secondbrain.setup.component.css']
})
export class SecondBrainSetupComponent implements AfterViewInit {

    databaseData: any;
    private config = inject<AppConfig>(APP_CONFIG);
 
    constructor(private notionService: NotionService) { }

    async ngOnInit() {
        // try {
        //     this.databaseData = await this.notionService.getDatabase();
        //     console.log(this.databaseData);
        // } catch (err) {
        //     console.error(err);
        // }
    }

    ngAfterViewInit() {
        
    }

  
}
  
