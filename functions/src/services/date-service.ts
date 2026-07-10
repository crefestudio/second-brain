/**
 * 문자열을 Date 객체로 변환한다.
 * @param text 날짜 문자열
 * @return 변환된 Date 객체
 */

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
    saturday: 6,
};

export function formatDateTime(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;
}

export function formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function resolveDateExpr(
    dateExpr: string | null,
    now: Date = new Date()
): ParsedDate | null {
    if (!dateExpr) return null;

    // /////////////////////////////////////////////////
    // date:2026-07-03
    const explicit = dateExpr.match(/^date:(\d{4}-\d{2}-\d{2})$/);
    if (explicit) {
        return {
            date: new Date(`${explicit[1]}T00:00:00+09:00`),
            hasTime: false,
        };
    }

    // /////////////////////////////////////////////////
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
            hasTime: true,
        };
    }

    // /////////////////////////////////////////////////
    // today
    if (dateExpr === "today") {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);

        return {
            date: d,
            hasTime: false,
        };
    }

    // /////////////////////////////////////////////////
    // tomorrow
    if (dateExpr === "tomorrow") {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);

        return {
            date: d,
            hasTime: false,
        };
    }

    // /////////////////////////////////////////////////
    // dayafter
    if (dateExpr === "dayafter") {
        const d = new Date(now);
        d.setDate(d.getDate() + 2);
        d.setHours(0, 0, 0, 0);

        return {
            date: d,
            hasTime: false,
        };
    }

    // /////////////////////////////////////////////////
    // now+15m
    // now+3h
    // now+7d
    const relative = dateExpr.match(/^now\+(\d+)([mhd])$/);

    if (relative) {
        const [, valueStr, unit] = relative;

        const value = Number(valueStr);
        const d = new Date(now);

        switch (unit) {
            case "m":
                d.setMinutes(d.getMinutes() + value);
                break;

            case "h":
                d.setHours(d.getHours() + value);
                break;

            case "d":
                d.setDate(d.getDate() + value);
                d.setHours(0, 0, 0, 0);
                return {
                    date: d,
                    hasTime: false,
                };
        }

        return {
            date: d,
            hasTime: true,
        };
    }

    // /////////////////////////////////////////////////
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
            hasTime: false,
        };
    }

    // /////////////////////////////////////////////////
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
            hasTime: false,
        };
    }

    // /////////////////////////////////////////////////
    // date:2026-07-03
    const explicitYmd = dateExpr.match(/^date:(\d{4})-(\d{2})-(\d{2})$/);

    if (explicitYmd) {
        const [, y, m, d] = explicitYmd;

        return {
            date: new Date(`${y}-${m}-${d}T00:00:00+09:00`),
            hasTime: false,
        };
    }

    // /////////////////////////////////////////////////
    // date:08-08
    const explicitMd = dateExpr.match(/^date:(\d{2})-(\d{2})$/);

    if (explicitMd) {
        const [, m, d] = explicitMd;

        return {
            date: new Date(
                now.getFullYear(),
                Number(m) - 1,
                Number(d)
            ),
            hasTime: false,
        };
    }

    // /////////////////////////////////////////////////
    // date:08
    const explicitDay = dateExpr.match(/^date:(\d{2})$/);

    if (explicitDay) {
        const [, d] = explicitDay;

        return {
            date: new Date(
                now.getFullYear(),
                now.getMonth(),
                Number(d)
            ),
            hasTime: false,
        };
    }

    // /////////////////////////////////////////////////
    // date:2026-07-03+15:00
    const explicitYmdTime = dateExpr.match(
        /^date:(\d{4})-(\d{2})-(\d{2})\+(\d{2}):(\d{2})$/
    );

    if (explicitYmdTime) {
        const [, y, m, d, hh, mm] = explicitYmdTime;

        return {
            date: new Date(`${y}-${m}-${d}T${hh}:${mm}:00+09:00`),
            hasTime: true,
        };
    }

    // /////////////////////////////////////////////////
    // date:08-08+15:00
    const explicitMdTime = dateExpr.match(
        /^date:(\d{2})-(\d{2})\+(\d{2}):(\d{2})$/
    );

    if (explicitMdTime) {
        const [, m, d, hh, mm] = explicitMdTime;

        const date = new Date(
            now.getFullYear(),
            Number(m) - 1,
            Number(d),
            Number(hh),
            Number(mm),
            0,
            0
        );

        return {
            date,
            hasTime: true,
        };
    }

    // /////////////////////////////////////////////////
    // date:08+15:00
    const explicitDayTime = dateExpr.match(
        /^date:(\d{2})\+(\d{2}):(\d{2})$/
    );

    if (explicitDayTime) {
        const [, d, hh, mm] = explicitDayTime;

        const date = new Date(
            now.getFullYear(),
            now.getMonth(),
            Number(d),
            Number(hh),
            Number(mm),
            0,
            0
        );

        return {
            date,
            hasTime: true,
        };
    }

    return null;
}
