export interface ParsedDate {
    date: Date;
    hasTime: boolean;
}

const WEEKDAY: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
};

export function resolveDateExpr(
    dateExpr: string | null,
    now: Date = new Date()
): ParsedDate | null {

    if (!dateExpr) return null;

    ///////////////////////////////////////////////////
    // date:2026-07-03
    const explicit = dateExpr.match(/^date:(\d{4}-\d{2}-\d{2})$/);
    if (explicit) {
        return {
            date: new Date(`${explicit[1]}T00:00:00`),
            hasTime: false
        };
    }

    ///////////////////////////////////////////////////
    // today+15:00
    // tomorrow+09:00
    // dayafter+18:30
    // next:monday+14:00
    // this:friday+10:00
    const withTime = dateExpr.match(
        /^(today|tomorrow|dayafter|next:\w+|this:\w+)\+(\d{1,2}):(\d{2})$/
    );

    if (withTime) {
        const [, baseExpr, hh, mm] = withTime;

        const base = resolveDateExpr(baseExpr, now);

        if (!base) return null;

        base.date.setHours(
            Number(hh),
            Number(mm),
            0,
            0
        );

        return {
            date: base.date,
            hasTime: true
        };
    }

    ///////////////////////////////////////////////////
    // today
    if (dateExpr === 'today') {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);

        return {
            date: d,
            hasTime: false
        };
    }

    ///////////////////////////////////////////////////
    // tomorrow
    if (dateExpr === 'tomorrow') {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);

        return {
            date: d,
            hasTime: false
        };
    }

    ///////////////////////////////////////////////////
    // dayafter
    if (dateExpr === 'dayafter') {
        const d = new Date(now);
        d.setDate(d.getDate() + 2);
        d.setHours(0, 0, 0, 0);

        return {
            date: d,
            hasTime: false
        };
    }

    ///////////////////////////////////////////////////
    // now+15m
    // now+3h
    // now+7d
    const relative = dateExpr.match(/^now\+(\d+)([mhd])$/);

    if (relative) {
        const [, valueStr, unit] = relative;

        const value = Number(valueStr);
        const d = new Date(now);

        switch (unit) {
            case 'm':
                d.setMinutes(d.getMinutes() + value);
                break;

            case 'h':
                d.setHours(d.getHours() + value);
                break;

            case 'd':
                d.setDate(d.getDate() + value);
                d.setHours(0, 0, 0, 0);
                return {
                    date: d,
                    hasTime: false
                };
        }

        return {
            date: d,
            hasTime: true
        };
    }

    ///////////////////////////////////////////////////
    // next:monday
    const next = dateExpr.match(
        /^next:(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/
    );

    if (next) {
        const d = new Date(now);
        const target = WEEKDAY[next[1]];

        let diff = (target - d.getDay() + 7) % 7;
        if (diff === 0) diff = 7;

        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);

        return {
            date: d,
            hasTime: false
        };
    }

    ///////////////////////////////////////////////////
    // this:friday
    const current = dateExpr.match(
        /^this:(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/
    );

    if (current) {
        const d = new Date(now);
        const target = WEEKDAY[current[1]];

        d.setDate(
            d.getDate() +
            (target - d.getDay())
        );

        d.setHours(0, 0, 0, 0);

        return {
            date: d,
            hasTime: false
        };
    }

    return null;
}