import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { auth } from '../firebase';
import { RecurringSchedule } from '../../../functions/src/recurring-schedule-model';
export interface ScheduleState {
    enabled: boolean; schedules: RecurringSchedule[];
    receipts: { id: string; name: string; date: string; status: string; pageId: string }[];
}
@Injectable({ providedIn: 'root' })
export class RecurringSchedulesService {
    constructor(private http: HttpClient) {}
    async request(userId: string, action: string, data: object = {}): Promise<ScheduleState> {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("로그인이 필요합니다.");
        try {
            return await firstValueFrom(this.http.post<ScheduleState>('https://us-central1-notionable-secondbrain.cloudfunctions.net/manageRecurringSchedules',
                { userId, action, ...data }, { headers: { Authorization: 'Bearer ' + token } }));
        } catch (error: any) { throw new Error(error?.error?.error || "저장하지 못했습니다. 연결을 확인하고 다시 시도해주세요."); }
    }
}
