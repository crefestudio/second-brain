import { yearlyCountdown } from './schedule-countdown';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../../../services/auth.service';
import { RecurringSchedulesService, ScheduleState } from '../../../../../services/recurring-schedules.service';
import { RecurringSchedule, ScheduleKind, lunarDate, dateString, yearlyDates, matchesDate, koreaDate, validateSchedule, scheduleConflict } from '../../../../../../../functions/src/recurring-schedule-model';
import { SCHEDULE_RECOMMENDATIONS, ScheduleRecommendation } from './schedule-recommendations';
@Component({ selector:'app-recurring-schedules', standalone:true, imports:[CommonModule,FormsModule,RouterLink],
    templateUrl:'./recurring-schedules.component.html', styleUrls:[
        '../routine/routine.component.css',
        '../routine/pages/rountine-find/routine-find.component.scss',
        '../routine/pages/my-rountine/my-routine.component.scss',
        '../routine/pages/routine-dashboard/routine-dashboard.component.scss'
    ] })
export class RecurringSchedulesComponent implements OnInit, OnDestroy {
    tab = 'dashboard'; kind: ScheduleKind = 'monthly'; category = '전체'; userId = '';
    loading = true; busy = false; error = ''; message = ''; allowed = true; connected = false;
    state: ScheduleState = { enabled:false, schedules:[], receipts:[] };
    editing: RecurringSchedule | null = null; editorNote = ''; editorError = ''; deleting: RecurringSchedule | null = null; confirmEnable = false;
    days = Array.from({length:31},(_,i)=>i+1);
    selectedYear = Number(koreaDate().slice(0,4));
    get months() { return Array.from({length:12},(_,i)=>({month:i+1,days:Array.from({length:new Date(Date.UTC(this.selectedYear,i+1,0)).getUTCDate()},(_,j)=>j+1)})); }
    changeYear(delta:number) { this.cancelDrag(); this.selectedYear=Math.max(1900,Math.min(9998,this.selectedYear+delta)); }
    lunarLabel(month:number,day:number) { const l=lunarDate(dateString(this.selectedYear,month,day));return l?' ('+(l.intercalation?'윤':'')+l.month+'.'+l.day+')':''; }
    get unplacedSchedules() { return this.visibleSchedules.filter(s=>s.kind==='yearly'&&!yearlyDates(s,this.selectedYear).length); }
    editorPreview() { if(!this.editing)return '';const dates=yearlyDates(this.editing,this.selectedYear);return dates.length?dates.join(', '):'해당 연도에 날짜가 없습니다. 생성하지 않습니다.'; }
    normalizeCalendar() { if(!this.editing)return;if(this.editing.kind==='monthly')this.editing.calendar='solar';if(this.editing.calendar!=='lunar')this.editing.leapMonth=false; }
    scheduleName(s:RecurringSchedule) { return (s.calendar==='lunar'?'(음) ':'')+s.icon+' '+s.name; }
    dateRowsForMonth(days:number[],month:number) { if(this.kind==='monthly')return this.dateRows(days);const offset=new Date(Date.UTC(this.selectedYear,month-1,1)).getUTCDay();const cells=[...Array(offset).fill(0),...days];while(cells.length%7)cells.push(0);return this.dateRows(cells); }
    today = koreaDate(); currentMonth = Number(this.today.slice(5,7));
    private subscription?: Subscription;
    drag: { schedule: RecurringSchedule; pointerId:number; x:number; y:number; active:boolean; month:number; day:number; element:HTMLElement } | null = null;
    constructor(private auth:AuthService, private api:RecurringSchedulesService, private route:ActivatedRoute, private router:Router) {}
    async ngOnInit() {
        this.subscription=this.route.paramMap.subscribe(params=>{ this.cancelDrag(); this.editing=null; this.deleting=null; this.confirmEnable=false; this.message=''; this.tab=params.get('tab') || 'dashboard'; if(!['dashboard','mine','recommendations'].includes(this.tab)) void this.router.navigateByUrl('/workspace/recurring-schedules/dashboard'); });
        try { await this.auth.updateSession(); this.userId=this.auth.getUserId(); this.connected=!!this.auth.getNotionAccessToken(); this.allowed=['lifeUp','lifeupPlanner'].includes(this.auth.templateId);
            if(this.userId && this.allowed) this.state=await this.api.request(this.userId,'list');
        } catch(error) { this.error=this.errorText(error); } finally { this.loading=false; }
    }
    ngOnDestroy() { this.subscription?.unsubscribe(); this.cancelDrag(); }
    private errorText(error:unknown) { return error instanceof Error ? error.message : '처리하지 못했습니다.'; }
    get canEdit() { return !!this.userId && this.allowed && !this.busy && !this.loading; }
    get categories() { return ['전체',...new Set(SCHEDULE_RECOMMENDATIONS.filter(s=>s.kind===this.kind).map(s=>s.category))]; }
    get recommendations() { return SCHEDULE_RECOMMENDATIONS.filter(s=>s.kind===this.kind && (this.category==='전체'||s.category===this.category)); }
    get visibleSchedules() { return this.state.schedules.filter(s=>s.kind===this.kind); }
    get monthSchedules() {
        const prefix=this.today.slice(0,7), year=Number(this.today.slice(0,4));
        return this.state.schedules.flatMap(schedule=>{
            const dates=schedule.kind==='monthly'?[dateString(year,this.currentMonth,schedule.day)]:yearlyDates(schedule,year);
            return dates.filter(date=>date.startsWith(prefix)&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date).map(date=>({...schedule,displayDate:date}));
        }).sort((a,b)=>a.displayDate.localeCompare(b.displayDate)||a.time.localeCompare(b.time));
    }
    get yearlyCountdowns() { return yearlyCountdown(this.state.schedules,this.today); }
    cellHeight(month:number,days:number[]) { return Math.max(this.kind==='yearly'?72:180,...days.filter(day=>day>0).map(day=>(this.cellSchedules(month,day).length+(this.drag?.active && this.drag.day===day && this.drag.month===month?1:0))*36+44)); }
    get needsReview() { return this.state.receipts.filter(r=>r.status==='review'); }
    setKind(kind:ScheduleKind) { this.cancelDrag(); this.kind=kind; this.category='전체'; }
    cellSchedules(month:number,day:number) { return this.visibleSchedules.filter(s=>day>0 && (s.kind==='monthly'?s.day===day:matchesDate(s,dateString(this.selectedYear,month,day)))).sort((a,b)=>a.time.localeCompare(b.time)); }
    dateLabel(schedule:{kind:ScheduleKind;month:number;day:number}) { return schedule.kind==='monthly' ? '매월 '+schedule.day+'일' : '매년 '+((schedule as RecurringSchedule).calendar==='lunar'?'(음) '+((schedule as RecurringSchedule).leapMonth?'윤':''):'')+schedule.month+'월 '+schedule.day+'일'; }
    openEditor(schedule?:RecurringSchedule, day=5, month=1, recommendation?:ScheduleRecommendation) {
        if(!this.canEdit) return;
        this.editorError=''; this.editorNote=recommendation?.note || '';
        this.editing=schedule ? {...schedule,leapMonth:!!schedule.leapMonth} : {id:'',name:recommendation?.name||'',icon:recommendation?.icon||'📅',category:recommendation?.category||'직접 등록',kind:recommendation?.kind||this.kind,month:recommendation?.month||month,day:recommendation?.day||day,time:'',duration:30,enabled:true,calendar:'solar',leapMonth:false,startDate:this.today,version:0};
        if(recommendation) this.editorNote='추천 날짜를 실제 일정에 맞게 설정해주세요. 실제 생일·납부일·계약일에 맞게 확인해주세요. '+this.editorNote;
        setTimeout(()=>document.getElementById('schedule-name')?.focus());
    }
    async save() {
        if(!this.editing||this.busy) return;
        this.normalizeCalendar();
        this.editorError=validateSchedule(this.editing);
        if(this.editorError)return;
        const conflict=this.state.schedules.find(s=>scheduleConflict(this.editing!,s));
        if(conflict){this.editorError='같은 반복 유형 안에서 일정이 겹칩니다: '+conflict.name;return;}
        if(await this.perform('save',{schedule:this.editing},'반복 일정을 저장했습니다. 이미 생성된 노션 할일은 유지됩니다.')) this.editing=null;
        else this.editorError=this.error;
    }
    async perform(action:string,data:object={},message='') {
        if(this.busy||!this.userId)return false;
        this.busy=true;this.error='';this.message='';
        try {this.state=await this.api.request(this.userId,action,data);this.message=message;return true;}
        catch(error){this.error=this.errorText(error);return false;}finally{this.busy=false;}
    }
    async remove() { if(this.deleting && await this.perform('delete',{id:this.deleting.id,version:this.deleting.version},'반복 설정을 삭제했습니다. 기존 노션 할일은 유지됩니다.'))this.deleting=null; }
    async enable() { if(await this.perform('enable',{enabled:true},'자동 등록을 켰습니다. 오늘 일정부터 15분 간격으로 확인합니다.'))this.confirmEnable=false; }
    startDrag(event:PointerEvent,schedule:RecurringSchedule) {
        if(!this.canEdit||event.button!==0||!event.isPrimary||this.drag||(event.target as HTMLElement).closest('button'))return;
        const element=event.currentTarget as HTMLElement;
        this.drag={schedule,pointerId:event.pointerId,x:event.clientX,y:event.clientY,active:false,month:Number(element.closest<HTMLElement>('[data-schedule-month]')?.dataset['scheduleMonth'])||schedule.month,day:Number(element.closest<HTMLElement>('[data-schedule-day]')?.dataset['scheduleDay'])||schedule.day,element};element.setPointerCapture(event.pointerId);
    }
    moveDrag(event:PointerEvent) {
        const drag=this.drag;if(!drag||drag.pointerId!==event.pointerId)return;
        if(!drag.active&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<7)return;
        drag.active=true;
        const cell=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-schedule-day]');
        if(!cell||!drag.element.closest('.date-board')?.contains(cell)){drag.day=0;return;}
        drag.day=Number(cell.dataset['scheduleDay']);drag.month=Number(cell.dataset['scheduleMonth']);
        let scroller: HTMLElement | null = drag.element.parentElement;
        while(scroller && !(scroller.scrollHeight>scroller.clientHeight && /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller=scroller.parentElement;
        const bounds=scroller?.getBoundingClientRect();
        const top=bounds?.top || 0, bottom=bounds?.bottom || window.innerHeight;
        const amount=event.clientY>bottom-70?18:event.clientY<top+70?-18:0;
        if(amount){if(scroller)scroller.scrollBy(0,amount);else window.scrollBy(0,amount);}
    }
    async endDrag(event:PointerEvent) {
        if(!this.drag||this.drag.pointerId!==event.pointerId)return;
        this.moveDrag(event);const drag=this.drag;this.cancelDrag();
        if(!drag.active){this.openEditor(drag.schedule);return;}
        if(!drag.day)return;
        const schedule={...drag.schedule,day:drag.day,month:drag.month};
        if(schedule.calendar==='lunar') {
            const lunar=lunarDate(dateString(this.selectedYear,drag.month,drag.day));
            if(!lunar){this.error='해당 연도는 음력 변환을 지원하지 않습니다.';return;}
            schedule.month=lunar.month;schedule.day=lunar.day;schedule.leapMonth=lunar.intercalation;
        }
        if(schedule.day===drag.schedule.day&&schedule.month===drag.schedule.month&&!!schedule.leapMonth===!!drag.schedule.leapMonth)return;
        const conflict=this.state.schedules.find(s=>scheduleConflict(schedule,s));
        if(conflict){this.error='이동할 날짜에 겹치는 일정이 있습니다: '+conflict.name;return;}
        await this.perform('save',{schedule},this.dateLabel(schedule)+'로 이동했습니다. 기존 노션 할일은 유지됩니다.');
    }
    dateRows(days:number[]) { return Array.from({length:Math.ceil(days.length/7)},(_,i)=>days.slice(i*7,i*7+7)); }
    scrollMonth(month:number) { document.getElementById('schedule-month-'+month)?.scrollIntoView({behavior:'smooth',block:'start'}); }
    cancelDrag() {const d=this.drag;this.drag=null;if(d?.element.hasPointerCapture(d.pointerId))d.element.releasePointerCapture(d.pointerId);}
    @HostListener('document:keydown', ['$event'])
    trapDialogFocus(event:KeyboardEvent) {
        if(event.key!=='Tab'||(!this.editing&&!this.deleting&&!this.confirmEnable))return;
        const dialog=document.querySelector<HTMLElement>('[role=dialog]');
        const controls=Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')||[]).filter(e=>e.getClientRects().length);
        const first=controls[0],last=controls[controls.length-1];
        if(!first){event.preventDefault();return;}
        if(!dialog?.contains(document.activeElement)||(!event.shiftKey&&document.activeElement===last)){event.preventDefault();first.focus();}
        else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    }
    @HostListener('document:keydown.escape') escape() {this.cancelDrag();if(!this.busy){this.editing=null;this.deleting=null;this.confirmEnable=false;}}
}
