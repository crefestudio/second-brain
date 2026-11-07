import { RecurringSchedule, yearlyDates, MAX_LUNAR_YEAR } from '../../../../../../../functions/src/recurring-schedule-model';
export function yearlyCountdown(schedules: RecurringSchedule[], today: string) {
 const year=Number(today.slice(0,4));
 return schedules.filter(s=>s.kind==='yearly').map(schedule=>{
  let date='';
  for(let y=year;y<=(schedule.calendar==='lunar'?MAX_LUNAR_YEAR:year+8);y++) {
   date=yearlyDates(schedule,y).find(d=>d>=today)||''; if(date)break;
  }
  return {schedule,date,days:date?Math.round((Date.parse(date)-Date.parse(today))/86400000):null};
 }).sort((a,b)=>(a.days??Infinity)-(b.days??Infinity)||a.schedule.time.localeCompare(b.schedule.time)||a.schedule.name.localeCompare(b.schedule.name,'ko'));
}
