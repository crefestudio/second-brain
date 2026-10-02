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

///////////////////////////////////////////////////////////
export function formatDateExpr(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

///////////////////////////////////////////////////////////
export function formatTimeExpr(date: Date): string {
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");

    return `${hour}:${minute}`;
}


export function formatDateTime(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;
}

export function formatDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatKoreanDate(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date);

    return `${year}년 ${month}월 ${day}일 (${weekday})`;
}

export function formatKoreanDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date);
    const hour = date.getHours();
    const minute = String(date.getMinutes()).padStart(2, "0");

    return `${year}년 ${month}월 ${day}일 (${weekday}) ${hour}:${minute}`;
}

export interface DateProcessData {
    date?: string;
    time?: string;
    endDate?: string;
    endTime?: string;
}

function getKoreaNow(): Date {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

export function resolveDateExpr(
    dateExpr: string | null,
    previousData?: DateProcessData
): ParsedDate | null {
    if (!dateExpr) return null;

    const now: Date = getKoreaNow();
    const previous = createDateFromData(previousData);
    const mergePreviousTime = (date: Date, hasTime: boolean): ParsedDate => {
        if (!hasTime && previous?.hasTime) {
            date.setHours(
                previous.date.getHours(),
                previous.date.getMinutes(),
                0,
                0
            );

            return {
                date,
                hasTime: true
            };
        }

        return {
            date,
            hasTime
        };
    };

    // time:03:00
    if (/^time:(\d{1,2}):(\d{2})$/.test(dateExpr)) {
        const [, hh, mm] = dateExpr.match(/^time:(\d{1,2}):(\d{2})$/)!;
        const date = previous
            ? new Date(previous.date)
            : new Date(now);

        date.setHours(
            Number(hh),
            Number(mm),
            0,
            0
        );

        return {
            date,
            hasTime: true
        };
    }

    if (dateExpr === "am" || dateExpr === "pm") {
        if (!previous?.hasTime) return null;

        const date = new Date(previous.date);
        const hour = date.getHours();

        if (dateExpr === "am" && hour >= 12) {
            date.setHours(hour - 12, date.getMinutes(), 0, 0);
        }

        if (dateExpr === "pm" && hour < 12) {
            date.setHours(hour + 12, date.getMinutes(), 0, 0);
        }

        return {
            date,
            hasTime: true
        };
    }

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
        const base = resolveDateExpr(baseExpr);

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

    // date:2026-07-03+15:00
    const explicitYmdTime = dateExpr.match(
        /^date:(\d{4})-(\d{2})-(\d{2})\+(\d{1,2}):(\d{2})$/
    );

    if (explicitYmdTime) {
        const [, y, m, d, hh, mm] = explicitYmdTime;

        return {
            date: new Date(
                Number(y),
                Number(m) - 1,
                Number(d),
                Number(hh),
                Number(mm),
                0,
                0
            ),
            hasTime: true
        };
    }

    // date:08-08+15:00
    const explicitMdTime = dateExpr.match(
        /^date:(\d{2})-(\d{2})\+(\d{1,2}):(\d{2})$/
    );

    if (explicitMdTime) {
        const [, m, d, hh, mm] = explicitMdTime;

        return {
            date: new Date(
                now.getFullYear(),
                Number(m) - 1,
                Number(d),
                Number(hh),
                Number(mm),
                0,
                0
            ),
            hasTime: true
        };
    }

    // date:08+15:00
    const explicitDayTime = dateExpr.match(
        /^date:(\d{2})\+(\d{1,2}):(\d{2})$/
    );

    if (explicitDayTime) {
        const [, d, hh, mm] = explicitDayTime;

        return {
            date: new Date(
                now.getFullYear(),
                now.getMonth(),
                Number(d),
                Number(hh),
                Number(mm),
                0,
                0
            ),
            hasTime: true
        };
    }

    // date:2026-07-03
    const explicitYmd = dateExpr.match(
        /^date:(\d{4})-(\d{2})-(\d{2})$/
    );

    if (explicitYmd) {
        const [, y, m, d] = explicitYmd;

        return mergePreviousTime(
            new Date(
                Number(y),
                Number(m) - 1,
                Number(d),
                0,
                0,
                0,
                0
            ),
            false
        );
    }

    // date:08-08
    const explicitMd = dateExpr.match(
        /^date:(\d{2})-(\d{2})$/
    );

    if (explicitMd) {
        const [, m, d] = explicitMd;

        return mergePreviousTime(
            new Date(
                now.getFullYear(),
                Number(m) - 1,
                Number(d),
                0,
                0,
                0,
                0
            ),
            false
        );
    }

    // date:08
    const explicitDay = dateExpr.match(
        /^date:(\d{2})$/
    );

    if (explicitDay) {
        const [, d] = explicitDay;

        return mergePreviousTime(
            new Date(
                now.getFullYear(),
                now.getMonth(),
                Number(d),
                0,
                0,
                0,
                0
            ),
            false
        );
    }

    // today
    if (dateExpr === "today") {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);

        return mergePreviousTime(date, false);
    }

    // tomorrow
    if (dateExpr === "tomorrow") {
        const date = new Date(now);
        date.setDate(date.getDate() + 1);
        date.setHours(0, 0, 0, 0);

        return mergePreviousTime(date, false);
    }

    // dayafter
    if (dateExpr === "dayafter") {
        const date = new Date(now);
        date.setDate(date.getDate() + 2);
        date.setHours(0, 0, 0, 0);

        return mergePreviousTime(date, false);
    }

    // now+15m
    // now+3h
    // now+7d
    const relative = dateExpr.match(/^now\+(\d+)([mhd])$/);

    if (relative) {
        const [, valueStr, unit] = relative;
        const value = Number(valueStr);
        const date = new Date(now);

        switch (unit) {
            case "m":
                date.setMinutes(date.getMinutes() + value);

                return {
                    date,
                    hasTime: true
                };

            case "h":
                date.setHours(date.getHours() + value);

                return {
                    date,
                    hasTime: true
                };

            case "d":
                date.setDate(date.getDate() + value);
                date.setHours(0, 0, 0, 0);

                return mergePreviousTime(date, false);
        }
    }

    // prev-1d
    // prev-7d
    const previousRelative = dateExpr.match(/^prev([+-])(\d+)d$/);

    if (previousRelative) {
        if (!previous) return null;

        const [, operator, valueStr] = previousRelative;
        const value = Number(valueStr);
        const date = new Date(previous.date);

        date.setDate(date.getDate() + (operator === "+" ? value : -value));

        return {
            date,
            hasTime: previous.hasTime
        };
    }
    
    // next:monday
    const next = dateExpr.match(
        /^next:(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/
    );

    if (next) {
        const date = new Date(now);
        const target = WEEKDAY[next[1]];
        let diff = (target - date.getDay() + 7) % 7;

        if (diff === 0) diff = 7;

        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);

        return mergePreviousTime(date, false);
    }

    // this:monday
    const current = dateExpr.match(
        /^this:(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/
    );

    if (current) {
        const date = new Date(now);
        const target = WEEKDAY[current[1]];

        date.setDate(
            date.getDate() +
            target -
            date.getDay()
        );

        date.setHours(0, 0, 0, 0);

        return mergePreviousTime(date, false);
    }

    return null;
}

function createDateFromData(data?: DateProcessData): ParsedDate | null {
    if (!data?.date) return null;

    const [year, month, day] = data.date.split("-").map(Number);
    const date = new Date(year, month - 1, day, 0, 0, 0, 0);

    if (data.time) {
        const [hour, minute] = data.time.split(":").map(Number);

        date.setHours(
            hour,
            minute,
            0,
            0
        );

        return {
            date,
            hasTime: true
        };
    }

    return {
        date,
        hasTime: false
    };
}
export function resolveDateData(expr: string, previous?: DateProcessData): DateProcessData | null {
    const parts = expr.split("..");
    if (parts.length > 2) return null;
    const start = resolveDateExpr(parts[0], parts.length === 1 ? previous : undefined);
    if (!start || !Number.isFinite(start.date.getTime())) return null;
    const data: DateProcessData = { date: formatDateExpr(start.date), ...(start.hasTime ? { time: formatTimeExpr(start.date) } : {}) };
    if (parts.length === 1) {
        if (previous?.endDate && previous.date) {
            const oldStart = createDateFromData(previous);
            const oldEnd = createDateFromData({ date: previous.endDate, time: previous.endTime });
            if (!oldStart || !oldEnd) return null;
            oldEnd.date.setTime(oldEnd.date.getTime() + start.date.getTime() - oldStart.date.getTime());
            data.endDate = formatDateExpr(oldEnd.date);
            if (start.hasTime) data.endTime = formatTimeExpr(oldEnd.date);
        }
        return data;
    }
    let endExpr = parts[1];
    const short = endExpr.match(/^date:(\d{2})(?:-(\d{2}))?(\+\d{1,2}:\d{2})?$/);
    if (short) {
        const [, first, day, time = ""] = short;
        endExpr = "date:" + (day ? start.date.getFullYear() + "-" + first + "-" + day : formatDateExpr(start.date).slice(0, 7) + "-" + first) + time;
    }
    const end = resolveDateExpr(endExpr);
    if (!end || !Number.isFinite(end.date.getTime())) return null;
    for (const [part, parsed] of [[parts[0], start], [endExpr, end]] as const) {
        const explicit = part.match(/^date:(?:(\d{4})-)?(\d{2})-(\d{2})(?:\+(\d{1,2}):(\d{2}))?$/);
        if (explicit && (parsed.date.getMonth() + 1 !== Number(explicit[2]) || parsed.date.getDate() !== Number(explicit[3]) ||
            (explicit[4] !== undefined && (Number(explicit[4]) > 23 || Number(explicit[5]) > 59)))) return null;
    }
    if (start.hasTime !== end.hasTime || end.date < start.date) return null;
    return { ...data, endDate: formatDateExpr(end.date), ...(end.hasTime ? { endTime: formatTimeExpr(end.date) } : {}) };
}

export function toNotionDate(data: DateProcessData) {
    return {
        start: data.time ? data.date + "T" + data.time + ":00" : data.date,
        end: data.endDate ? (data.endTime ? data.endDate + "T" + data.endTime + ":00" : data.endDate) : null,
        ...(data.time ? { time_zone: "Asia/Seoul" } : {})
    };
}

// A month is planning context, not a calendar day. Keep it in the task title.
export function hasMonthWithoutDay(message: string): boolean {
    const month = /(?:^|[^0-9])(?:1[0-2]|[1-9])\s*월|(?:이번|다음|다다음|지난)\s*(?:달|월)/.test(message);
    if (!month) return false;
    const day = /\d+\s*일|\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[/.]\d{1,2}|오늘|내일|모레|글피|어제|그제|[월화수목금토일]요일|초하루|보름|마지막\s*날/.test(message);
    return !day;
}
