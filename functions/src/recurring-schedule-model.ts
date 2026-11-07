import * as LunarModule from 'korean-lunar-calendar';
const LunarCalendar = (LunarModule as any).default || LunarModule;
/** Shared calendar rules, independent of Habit and its rewards. */
export type ScheduleKind = 'monthly' | 'yearly';
export interface RecurringSchedule {
    id: string; name: string; icon: string; category: string; kind: ScheduleKind;
    month: number; day: number; time: string; duration: number; enabled: boolean;
    calendar: 'solar' | 'lunar'; leapMonth?: boolean; startDate: string; version: number;
}
export const MONTH_LENGTHS = [31,28,31,30,31,30,31,31,30,31,30,31];
export function koreaDate(now = new Date()): string {
    return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
export function validateSchedule(value: any): string {
    if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200) return '일정 이름을 200자 이내로 입력해주세요.';
    if (!['monthly', 'yearly'].includes(value.kind) || !['solar','lunar'].includes(value.calendar) || (value.kind === 'monthly' && value.calendar !== 'solar')) return '양력 월간 또는 년간 일정을 선택해주세요.';
    if (!Number.isInteger(value.day) || value.day < 1 || value.day > 31) return '날짜를 선택해주세요.';
    if (!Number.isInteger(value.month) || value.month < 1 || value.month > 12) return '월을 선택해주세요.';
    if (value.leapMonth !== undefined && typeof value.leapMonth !== 'boolean') return '윤달 설정을 확인해주세요.';
    if (value.calendar === 'lunar' && value.day > 30) return '음력 날짜는 1~30일로 입력해주세요.';
    if (value.calendar === 'solar' && value.leapMonth) return '윤달은 음력에서만 선택할 수 있습니다.';
    if (value.kind === 'yearly' && value.calendar === 'solar' && value.day > (value.month === 2 ? 29 : MONTH_LENGTHS[value.month - 1])) return '유효한 양력 날짜를 선택해주세요.';
    if (typeof value.time !== 'string' || (value.time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))) return '시간을 입력하거나 종일을 선택해주세요.';
    if (!Number.isInteger(value.duration) || value.duration < 5 || value.duration > 1440) return '소요 시간은 5~1440분으로 입력해주세요.';
    if (typeof value.enabled !== 'boolean' || typeof value.icon !== 'string' || value.icon.length > 20 || typeof value.category !== 'string' || value.category.length > 60) return '일정 설정을 확인해주세요.';
    return '';
}
export function isScheduleDue(schedule: RecurringSchedule, date: string): boolean {
    if (validateSchedule(schedule) || !schedule.enabled || date < schedule.startDate) return false;
    const [year, month, day] = date.split('-').map(Number);
    const actual = new Date(Date.UTC(year, month - 1, day));
    return actual.toISOString().slice(0, 10) === date && matchesDate(schedule, date);
}
export function scheduleConflict(a: RecurringSchedule, b: RecurringSchedule): boolean {
    if (a.id === b.id || !a.enabled || !b.enabled || a.kind !== b.kind || !sameRepeatDate(a,b)) return false;
    if (a.name.trim() === b.name.trim() && a.time === b.time) return true;
    if (!a.time || !b.time) return false;
    const minutes = (s: string) => Number(s.slice(0,2))*60 + Number(s.slice(3));
    return minutes(a.time) < minutes(b.time) + b.duration && minutes(b.time) < minutes(a.time) + a.duration;
}
export function occurrenceKey(id: string, date: string): string { return `${id}:${date}`; }

export const MIN_CALENDAR_YEAR = 1900;
export const MAX_LUNAR_YEAR = 2050;
export function dateString(year:number,month:number,day:number) { return year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0'); }
const lunarCache = new Map<string, {year:number;month:number;day:number;intercalation:boolean}|null>();
export function lunarDate(date:string) {
    if(lunarCache.has(date)) return lunarCache.get(date)!;
    const [year,month,day]=date.split('-').map(Number); const c=new LunarCalendar();
    const result=c.setSolarDate(year,month,day)?{...c.getLunarCalendar(),intercalation:!!c.getLunarCalendar().intercalation}:null;
    if(lunarCache.size>20000) lunarCache.clear(); lunarCache.set(date,result); return result;
}
export function matchesDate(schedule:RecurringSchedule,date:string):boolean {
    const [,month,day]=date.split('-').map(Number);
    if(schedule.calendar!=='lunar') return schedule.day===day && (schedule.kind==='monthly'||schedule.month===month);
    const lunar=lunarDate(date);
    return !!lunar && schedule.month===lunar.month && schedule.day===lunar.day && !!schedule.leapMonth===lunar.intercalation;
}
export function yearlyDates(schedule:RecurringSchedule,year:number):string[] {
    if(schedule.calendar!=='lunar') {
        const date=dateString(year,schedule.month,schedule.day);
        return new Date(Date.UTC(year,schedule.month-1,schedule.day)).toISOString().slice(0,10)===date?[date]:[];
    }
    const dates:string[]=[];
    for(const lunarYear of [year-1,year]) {
        const c=new LunarCalendar();
        if(!c.setLunarDate(lunarYear,schedule.month,schedule.day,!!schedule.leapMonth)) continue;
        const solar=c.getSolarCalendar(); const back=c.getLunarCalendar();
        if(solar.year===year && !!back.intercalation===!!schedule.leapMonth) dates.push(dateString(solar.year,solar.month,solar.day));
    }
    return dates.sort();
}
function sameRepeatDate(a:RecurringSchedule,b:RecurringSchedule):boolean {
    if(a.kind==='monthly') return a.day===b.day;
    if(a.calendar===b.calendar) return a.day===b.day && a.month===b.month && !!a.leapMonth===!!b.leapMonth;
    // Mixed solar/lunar schedules can meet on different dates each year.
    for(let year=Number(koreaDate().slice(0,4));year<=MAX_LUNAR_YEAR;year++) {
        const dates=new Set(yearlyDates(a,year)); if(yearlyDates(b,year).some(date=>dates.has(date))) return true;
    }
    return false;
}
