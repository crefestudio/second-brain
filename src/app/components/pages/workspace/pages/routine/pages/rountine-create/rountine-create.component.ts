import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-rountine-create',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './rountine-create.component.html',
    styleUrls: ['./rountine-create.component.scss']
})
export class RoutineCreateComponent {

    weekDays = ['월', '화', '수', '목', '금', '토', '일'];

    routine = {
        name: '',
        time: '07:00',
        duration: 10,
        startDate: '',   // ✅ 추가
        days: [] as string[]
    };    

    toggleDay(routine: any, day: string) {
        const index = routine.days.indexOf(day);

        if (index === -1) {
        routine.days.push(day);
        } else {
        routine.days.splice(index, 1);
        }
    }

    isSelected(routine: any, day: string) {
        return routine.days.includes(day);
    }

    addRoutine(routine: any) {
        if (!routine.name?.trim()) return;

        console.log('추가된 루틴:', routine);

        // 초기화
        this.routine = {
            name: '',
            time: '07:00',
            duration: 10,
            startDate: '',
            days: []
        };
    }
}