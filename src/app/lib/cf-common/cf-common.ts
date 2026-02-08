/**
 * 공통으로 사용하는 함수들 집합소
 */

//import { environment } from "src/environments/environment";


export const _log = (...args: any[]) => {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    console.log(...args);
  }
};

// log
//export var _log = console.log.bind(window.console);
// if (!environment.isShowLog) {
//     console.log = () => { };
//     _log = () => { };
// }

// _log = () => {};

// slog : _only_slog_mode = true하면 _slog만 나옴
// var _only_slog_mode: boolean = false;
// export var _slog = console.log.bind(window.console);
// if (!environment.isShowLog) {
//     console.log = () => { };
//     _slog = () => { };
// }
// if (_only_slog_mode) {
//     console.log = () => { };
//     _log = () => { };
// }


// 사용법   _flog(this.method, arguments) , method에 함수명, 나머지는 그대로 입력
export var _flog: any = (method: any, args: any) => {
    var _argNames = getParameterNames(method);
    if (!args) {
        _log(`>> ${method.name}`);
        return;
    }
    _log(`>> ${method.name}`);
    _argNames.forEach((name: any, index: number) => {
        if (typeof args[index] === 'object') {
            _log(`${name} : `, args[index]);
        } else {
            _log(`${name}: ${args[index]}`);
        }
    });
    // _argNames.forEach((name: any, index: number) => {
    //     if (typeof args[index] === 'object') {
    //         console.log(`>> ${method.name}::${name}:`, args[index]);
    //     }
    // });

};

// if (environment.production && !environment.isShowLog) {
//     _flog = (method?: any, args?: any) => { };
// }


function getParameterNames(method: any) {
    const paramNames = method.toString()
        .replace(/[\r\n\s]+/g, '')
        .match(/\((.*?)\)/)[1]
        .split(',')
        .map((param: any) => param.split('=')[0].trim());
    return paramNames;
}

// test 
export function _valid(condition: any, message = '') {
    // if (environment.production && !environment.isShowLog) {
    //     return condition;
    // }
    if (!condition) {
        // if (!environment.production) {
        //     alert(`내부오류 : ${message}`);
        // }
        console.assert(false, message);
    } else {
        //console.log('test =>', condition);
    }
    return condition;
}


/* -------------------------------- moment ------------------------------- */
interface ICFLocalDateTIme {
    year: number,
    month: number,
    day: number,
    hours: number,
    minutes: number,
    amPm: string
}

export interface BLGPS {
    lat: number,
    lng: number
}

/* -------------------------------------------------------------------------- */
/*                                   CFDate                                   */
/* -------------------------------------------------------------------------- */

export const CFDate = {
    nowAsString: () => {
        const now = new Date();
        const isoString = now.toISOString();
        return isoString;
    },
    // 지역시를 기준으로 00:00로 설정한다.
    resetTimeToMidnight: (date: Date): Date => {
        date.setHours(0, 0, 0, 0); // 시간을 0시 0분 0초 0밀리초로 설정
        return date;
    },
    toStringAsToday: (_date: any): string => {
        const today = CFDate.getLocalTime(new Date());
        const date = CFDate.getLocalTime(new Date(_date));
        const isBeforeToday = today.year == date.year && today.month == date.month && today.day == date.day;

        return isBeforeToday ? CFDate.formatDate(new Date(_date), 'today ampm hh:mm') : CFDate.formatDate(new Date(_date), 'YYYY.MM.DD');
    },
    getLocalTime: (date: Date): ICFLocalDateTIme => {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours() % 12 || 12;
        const minutes = date.getMinutes();
        const amPm = date.getHours() < 12 ? '오전' : '오후';

        return { year: year, month: month, day: day, hours: hours, minutes: minutes, amPm: amPm }
    },
    //'YYYY.MM.DD': '2023.05.25', 'today ampm hh:mm': '오늘 오전/오후 11:23'
    formatDate: (date: Date, format: string) => {
        let a = CFDate.getLocalTime(date);
        let stringDate = '';
        if (format == 'YYYY.MM.DD') {
            stringDate = `${a.year}.${CFDate.padZero(a.month)}.${CFDate.padZero(a.day)}`
        } else if (format == 'today ampm hh:mm') {
            stringDate = `오늘 ${a.amPm} ${CFDate.padZero(a.hours)}:${CFDate.padZero(a.minutes)}`
        }

        return stringDate;
    },
    isToday: (_date: Date) => {
        let today = new Date();
        return _date.getFullYear() === today.getFullYear() && _date.getMonth() === today.getMonth() && _date.getDate() === today.getDate();
    },
    padZero: (value: number): string => {
        return value.toString().padStart(2, '0');
    },
    dateToInputDateTimeString: (date: Date) => {
        // 연도, 월, 일, 시, 분을 각각 2자리로 포맷하여 문자열로 만듦
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        // `datetime-local` 형식 문자열로 변환
        const dateTimeString = `${year}-${month}-${day}T${hours}:${minutes}`;
        return dateTimeString;
    },
    generateTimestamp: () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // 01~12
        const day = String(now.getDate()).padStart(2, '0'); // 01~31
        const hours = String(now.getHours()).padStart(2, '0'); // 00~23
        const minutes = String(now.getMinutes()).padStart(2, '0'); // 00~59
      
        return `${year}${month}${day}${hours}${minutes}`;
    },
    dateTimeStringToDate: (dateTimeString: string): Date => {
        // `datetime-local` 형식의 문자열을 `Date` 객체로 변환
        return new Date(dateTimeString);
    },
    /**
     * 지역 시간(EXIF 형식)을 UTC ISO 8601 형식으로 변환하는 함수
     * @param {string} localDateTime - 지역 시간 형식의 EXIF 날짜 (예: '2024:07:02 11:32:55')
     * @returns {string} - ISO 8601 형식의 UTC 시간 (예: '2024-07-02T02:32:55.000Z')
     */
    convertLocalToUTC: (localDateTimeString: string) => {
        if (!localDateTimeString || typeof localDateTimeString !== 'string') {
            throw new Error('유효한 날짜 문자열을 입력해야 합니다.');
        }

        // 날짜와 시간 부분 분리
        const [datePart, timePart] = localDateTimeString.split(' ');

        if (!datePart || !timePart) {
            throw new Error('입력 문자열 형식이 잘못되었습니다. (예: YYYY:MM:DD HH:mm:ss)');
        }

        // 날짜 부분의 ':'을 '-'로 변환
        const isoDatePart = datePart.replace(/:/g, '-');

        // ISO 8601 형식으로 지역 시간 생성
        const localISOString = `${isoDatePart}T${timePart}`;

        // 지역 시간으로 Date 객체 생성
        const localDate = new Date(localISOString);

        if (isNaN(localDate.getTime())) {
            throw new Error('유효하지 않은 날짜 형식입니다.');
        }

        // UTC ISO 8601 형식으로 반환
        return localDate.toISOString();
    },

    // dateToInputDateString: (date: Date): string => {
    //     _valid(date);
    //     if (!date) {
    //         throw new Error();
    //     }
    //     return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    // },
    // dateStringToDate: (dateString: string): Date => {
    //     // dateString 지역시
    //     const [year, month, day] = dateString.split('-').map(Number);

    //     // date 지역 시분초
    //     const hours = date.getHours();
    //     const minutes = date.getMinutes();
    //     const seconds = date.getSeconds();
    //     const milliseconds = date.getMilliseconds();

    //     // 새로운 날짜로 Date 객체 생성
    //     const updatedDate = new Date(year, month - 1, day, hours, minutes, seconds, milliseconds); // month는 0부터 시작
    //     _log('updateDateWithNewString date =>', this.date, this.date.toISOString());
    //     return updatedDate;
    // },

    format: (format: CFDateFormat = CFDateFormat.YYYYMMDD, dateString?: string) => {
        const weekdaysShortEng = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        const weekdaysKr = ['일', '월', '화', '수', '목', '금', '토'];
        const monthTextEng = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
            "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
        var _date: Date;
        if (dateString) {
            _date = new Date(dateString); // 날짜
        } else {
            _date = new Date();
        }

        if (!_date) { return ''; }

        var year = _date.getFullYear(); // 년
        var month = _date.getMonth() + 1; // 월
        var day = _date.getDate(); // 일
        var weekDayKr = weekdaysKr[_date.getDay()]; // 요일
        var weekDayShortEng = weekdaysShortEng[_date.getDay()]; // Mon
        var monthEng = monthTextEng[_date.getMonth()]; // January
        var hour = _date.getHours();
        var minute = _date.getMinutes();
        var second = _date.getSeconds();
        var amPm = '오전';

        switch (format) {
            case CFDateFormat.YYYY:
                return `${year}`;
            case CFDateFormat.MM:
                return CFDate.padZero(month);
            case CFDateFormat.DD:
                return CFDate.padZero(day);
            case CFDateFormat.dd:
                return `${day}`;
            case CFDateFormat.HHmm:
                return `${CFDate.padZero(hour)}:${CFDate.padZero(minute)}`;
            case CFDateFormat.YYYYMM:
                return `${year}. ${CFDate.padZero(month)}`;
            case CFDateFormat.YYYYMMDD:
                return `${year}. ${CFDate.padZero(month)}. ${CFDate.padZero(day)}`;
            case CFDateFormat.YYMMDD:
                return `${year.toString().slice(-2)}. ${CFDate.padZero(month)}. ${CFDate.padZero(day)}`;
            case CFDateFormat.YYMMDD2:
                return `${year.toString().slice(-2)}${CFDate.padZero(month)}${CFDate.padZero(day)}`;
            case CFDateFormat.MMM:
                return monthEng;
            case CFDateFormat.MMDDW:
                return `${CFDate.padZero(month)}. ${CFDate.padZero(day)} ${weekDayShortEng}`;
            case CFDateFormat.amhhmm:
                if (hour > 12) {
                    hour -= 12;
                    amPm = '오후'
                }
                return `${amPm} ${CFDate.padZero(hour)}:${CFDate.padZero(minute)}`;
            case CFDateFormat.YYMMDDHHmm:
                return `${year.toString().slice(-2)}.${CFDate.padZero(month)}.${CFDate.padZero(day)} ${CFDate.padZero(hour)}:${CFDate.padZero(minute)}`;
            case CFDateFormat.YY_MM_DD_AMPM_HHmm:
                if (hour > 12) {
                    hour -= 12;
                    amPm = '오후'
                }
                return `${year.toString().slice(-2)}. ${CFDate.padZero(month)}. ${CFDate.padZero(day)}  ${amPm} ${CFDate.padZero(hour)}:${CFDate.padZero(minute)}`
            case CFDateFormat.YYYY_MM_DD_AMPM_HHmm:
                if (hour > 12) {
                    hour -= 12;
                    amPm = '오후'
                }
                return `${year.toString()}. ${CFDate.padZero(month)}. ${CFDate.padZero(day)}  ${amPm} ${CFDate.padZero(hour)}:${CFDate.padZero(minute)}`
            case CFDateFormat.YYYYMMDDHHmm:
                return `${year.toString()}.${CFDate.padZero(month)}.${CFDate.padZero(day)} ${CFDate.padZero(hour)}:${CFDate.padZero(minute)}`;
            case CFDateFormat.YYYY년MM월DD일:
                return `${year}년 ${CFDate.padZero(month)}월 ${CFDate.padZero(day)}일`;
            case CFDateFormat.MM월DD일W요일 :
                    return `${CFDate.padZero(month)}월 ${CFDate.padZero(day)}일 ${weekDayKr}요일`;
            case CFDateFormat.YYYY년MM월DD일W요일:
                return `${year}년 ${CFDate.padZero(month)}월 ${CFDate.padZero(day)}일 ${weekDayKr}요일`;

            case CFDateFormat.MM월DD일amhhmm: {
                if (hour > 12) {
                    hour -= 12;
                    amPm = '오후'
                }
                return `${CFDate.padZero(month)}. ${CFDate.padZero(day)} ${amPm} ${CFDate.padZero(hour)}:${CFDate.padZero(minute)}`;
            }
            case CFDateFormat.YYYY년MM월DD일24hour:
                return `${year}년 ${CFDate.padZero(month)}월 ${CFDate.padZero(day)}일 ${CFDate.padZero(hour)}:${CFDate.padZero(minute)}`;
        }
        return '';
    },
    // calendar: () => {
    //     let _calendar = '';

    //     const today = new Date();
    //     const currYear = today.getFullYear();
    //     const currMonth = today.getMonth();

    //     let daysInMonth = new Date(currYear, currMonth + 1, 0).getDate(); // 해당 월 총 일수
    //     let dayOfWeek = new Date(currYear, currMonth, 1).getDay(); // 해당 월 시작하는 일.

    //     // 전 달 빈칸 채우기
    //     for(let i = 0; i < dayOfWeek; i++) {
    //         _calendar += '____';
    //     }

    //     let weekCount = 0;
    //     for(let day = 1; day <= daysInMonth; day++) {
    //         if(day < 10) {
    //             _calendar +=  `__${day}_`;
    //         } else {
    //             _calendar +=  `_${day}_`;
    //         }
    //         dayOfWeek = (dayOfWeek + 1) % 7;

    //         if(dayOfWeek === 0) {                
    //             _calendar += '\n';
    //             weekCount++;
    //         }
    //     }

    //     // 마지막 주의 빈칸 채우기
    //     for (let i = dayOfWeek; i < 7; i++) {
    //         _calendar += '____' ;
    //     }

    //     // 공백 더하기
    //     for(let i = weekCount + 1; i <= 5; i++) {
    //         _calendar +='\n';
    //     }

    //     console.log('cfhelper calendar currMonth, weekCount, daysInMonth, dayOfWeek, _calendar =>', currMonth, weekCount, daysInMonth, dayOfWeek, _calendar);

    //     return _calendar;
    // },
    calendarInfo: (currDate?: Date) => {
        let _calendar = {
            year: 2024,
            month: 1,
            date: 1,
            dayName: "월",

            dayCountInMonth: 31,
            weekOfFirstDay: 1,
            weekOfLastDay: 1,
            lastDateOfPrevMonth: 31, // 전달의 마지막 일
            weekCount: 5,

            prevYear: 1,
            prevMonth: 1,
            nextYear: 1,
            nextMonth: 1
        };
        const today = currDate ? currDate : new Date();

        // 날짜와 시간을 원하는 형식으로 출력하기
        _calendar.year = today.getFullYear(); // 연도
        _calendar.month = today.getMonth() + 1; // 월 (0부터 시작하므로 1을 더함)
        _calendar.date = today.getDate(); // 일
        const day = today.getDay(); // 요일 (0: 일요일, 1: 월요일, ..., 6: 토요일)

        // 요일을 텍스트로 변환하기
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        _calendar.dayName = dayNames[day];

        _calendar.dayCountInMonth = new Date(_calendar.year, _calendar.month, 0).getDate(); // 해당 월 총 일수
        _calendar.weekOfFirstDay = new Date(_calendar.year, _calendar.month - 1, 1).getDay(); // 해당 월 시작하는 요일.
        _calendar.weekOfLastDay = (_calendar.weekOfFirstDay + _calendar.dayCountInMonth) % 7;
        _calendar.weekCount = Math.ceil((_calendar.weekOfFirstDay + _calendar.dayCountInMonth) / 7);

        // prev
        const prevMonth = new Date(_calendar.year, _calendar.month - 1, 0);
        _calendar.lastDateOfPrevMonth = prevMonth.getDate(); // 전달 총 일수
        _calendar.prevYear = prevMonth.getFullYear();
        _calendar.prevMonth = prevMonth.getMonth() + 1;

        // next 
        const nextMonth = new Date(_calendar.year, _calendar.month + 1, 0);
        _calendar.nextYear = nextMonth.getFullYear();
        _calendar.nextMonth = nextMonth.getMonth() + 1;

        return _calendar;
    },
    getPrevMonth: ({ year, month }: { year: number; month: number }) => {
        if (month === 1) {
            return { year: year - 1, month: 12 };
        } else {
            return { year, month: month - 1 };
        }
    },
    getNextMonth: ({ year, month }: { year: number; month: number }) => {
        if (month === 12) {
            return { year: year + 1, month: 1 };
        } else {
            return { year, month: month + 1 };
        }
    }
}

// export class CFDate {
//     static nowAsString() {
//         const now = new Date();
//         const isoString = now.toISOString();
//         return isoString;
//     }

//     static toStringAsToday(_date: any) {
//         const today = CFDate.getLocalTime(new Date());
//         const date = CFDate.getLocalTime(new Date(_date));
//         const isBeforeToday = CFDate.isToday(today, date); 

//         return isBeforeToday ? CFDate.formatDate(new Date(_date), 'today ampm hh:mm') : CFDate.formatDate(new Date(_date), 'YYYY.MM.DD');
//     }

//     static getLocalTime(date: Date): ICFLocalDateTIme {
//         const year = date.getFullYear();
//         const month = date.getMonth() + 1;
//         const day = date.getDate();
//         const hours = date.getHours() % 12 || 12;
//         const minutes = date.getMinutes();
//         const amPm = date.getHours() < 12 ? '오전' : '오후';

//         return {year: year, month: month, day: day, hours: hours, minutes: minutes, amPm: amPm}
//     }

//     //'YYYY.MM.DD': '2023.05.25', 'today ampm hh:mm': '오늘 오전/오후 11:23'
//     static formatDate(date: Date, format: string) {
//         let a = CFDate.getLocalTime(date);
//         let stringDate = '';
//         if(format == 'YYYY.MM.DD') {
//             stringDate = `${a.year}.${CFDate.padZero(a.month)}.${CFDate.padZero(a.day)}`
//         } else if(format == 'today ampm hh:mm') {
//             stringDate = `오늘 ${a.amPm} ${CFDate.padZero(a.hours)}:${CFDate.padZero(a.minutes)}`
//         }

//         return  stringDate;
//     }

//     static isToday(a: ICFLocalDateTIme, b: ICFLocalDateTIme) {
//         return a.year == b.year && a.month == b.month && a.day == b.day;
//     }

//     static padZero(value: number): string {
//         return value.toString().padStart(2, '0');
//     }
// }

/* ------------------------------- 이름 중복체크 함수 ------------------------------- */
export function generateNewName(name: string, existingNames: Array<string>) {
    let count = 0;
    for (let temp of existingNames) {
        if (temp == name) {
            count++;
        }
    }
    return count == 0 ? name : `${name}(${count})`;
}

/* ---------------------------- 문자열에서 링크로 변환 ---------------------------- */
export function convertLinkedString(text: string) {
    let links = text.match(/(https?|www)\S+/g); // 배열로 저장.
    if (links && links.length > 0) {
        for (let link of links) {
            let keyword = link;
            if (link.substring(0, 4).toUpperCase() !== 'HTTP') {
                keyword = 'https://' + link;
            }
            link = link.replace(link, `<a  href=${keyword} class='link-tag' target='_blank'>$&</a>`);
        }
    }

    return text;
}
/*
    짧은 UUID를 생성 하는 모듈
    1. nanoid 설치 
    2. index.js 에 import 'react-native-get-random-values'; 코드 추가 
        
    사용법 
        generateUUID()
*/
import { nanoid } from 'nanoid'
// import { assert } from "console";
// import { ColorFormats } from "ngx-color-picker/lib/formats";
// export function generateUUID() {
//     return nanoid();
// }

////////////////////////////////////////////////////////////
// image
export interface ICFImage {
    name: string,
    size: number,
    type: string,
    uri: string
}

export async function getImagesBlob(images: Array<ICFImage>) {
    let blobs = [];
    for (let image of images) {
        let blob = await (await fetch(image.uri)).blob();
        blobs.push(blob);
    }
    return blobs;
}

////////////////////////////////////////////////////////////
// 
export function isJSON(item: any) {
    item = typeof item !== "string"
        ? JSON.stringify(item)
        : item;

    try {
        item = JSON.parse(item);
    } catch (e) {
        return false;
    }

    if (typeof item === "object" && item !== null) {
        return true;
    }

    return false;
}

export function isArrayOfStrings(value: any): boolean {
    return Array.isArray(value) && value.every(item => typeof item === "string");
}

export function getTextLength(str: any) {
    var len = 0;
    for (var i = 0; i < str.length; i++) {
        if (escape(str.charAt(i)).length == 6) {
            len++;
        }
        len++;
    }
    return len;
}

// export function debounce(cbFunction: any, duration = 1000) {
//     return _.debounce(() => {
//         cbFunction();
//     }, duration, { leading: true, trailing: false })
// }

///////////////////////////////////////////
//

export function safeArray(arr: any): any[] {
    if (!arr) {
        return [];
    }

    if (Array.isArray(arr)) {
        return arr;
    }

    return [arr];
}

export function safeString(str: any) {
    if (str === null || str === undefined) {
        return '';
    }

    if (typeof (str) != 'string') {
        return String(str);
    }

    return str;
}

export function safeSplit(str: string, delimiter: string | RegExp, trim = false) {
    let result: string[] = [];

    if (str) {
        let sp: string[] = str.split(delimiter);
        for (let i = 0; i < sp.length; ++i) {
            let v = sp[i];
            if (v) {
                if (trim) {
                    v = v.trim();
                }
                result.push(v);
            }
        }
    }

    return result;
}

export function safeJoin(str: string[], delimiter: string) {
    let result: string = '';

    if (str) {
        if (Array.isArray(str)) {
            let sp: string[] = [];
            for (let i = 0; i < str.length; ++i) {
                if (str[i]) {
                    sp.push(str[i]);
                }
            }

            result = sp.join(delimiter);
        }
        else {
            result = str;
        }
    }

    return result;
}

/**
 * arr가 배열이고, 빈 배열이 아닐 경우 true, 배열이 아니거나 빈 배열이면 false를 리턴
 * @param arr 
 * @returns boolean
 */
export function isNonEmptyArray(arr: any): boolean {
    return Array.isArray(arr) && arr.length > 0;
}

/**
 * list에서 key에 해당하는 요소만을 뽑아서 새로운 array를 리턴한다.
 * @param list 
 * @param key 
 */
export function arrayObjectToValue<T = any>(list: any[], key: string) {
    let array: T[] = [];
    if (Array.isArray(list)) for (let one of list) {
        if (one[key]) {
            array.push(one[key]);
        }
    }

    return array;
}

export function arrayToMap(arr: [], key: string) {
    let map = {};
    if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; ++i) {
            map[arr[i][key]] = arr[i];
        }
    }
    return map;
}


// 천단위 콤마 표시
export function stringWithComma(num: number) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// html tag 제거
export function stringByRemoveTag(str: string) {
    str = str.replace(/<(\/)?([a-zA-Z]*)(\s[a-zA-Z]*=[^>]*)?(\s)*(\/)?>/ig, "");
    str = str.replace('&nbsp;', '');
    str = str.replace('<!DOCTYPE html>', '');
    str = str.trim();
    return str;
}

export enum readFileType {
    dataUrl = 'dataUrl',
    text = 'text'
}
export enum ReadFileError {
    unknown = 'unknown',
    notAllowType = 'notAllowType'
}
export function readFile(file: any, type: readFileType = readFileType.dataUrl, allowExts: Array<string> = [], limitExts: Array<string> = []): Promise<string> {
    _log('readAsDataURL file =>', file);
    _valid(file);
    return new Promise((resolve, reject) => {
        try {
            let types: any = {
                svg: 'image/svg+xml'
            }
            // allow Exts
            for (let ext of allowExts) {
                let type = types[ext];
                if (type && file.type !== type) {
                    reject(ReadFileError.notAllowType);
                }
            }

            const reader = new FileReader();
            reader.onload = (readerEvent: any) => {
                let imageUrl = readerEvent.target.result;
                resolve(imageUrl);
            };

            if (type == readFileType.dataUrl) {
                // base64
                reader.readAsDataURL(file);
            } else if (type == readFileType.text) {
                reader.readAsText(file);
            }
        } catch (e) {
            reject(ReadFileError.unknown);
        }
    });
}


export function _pixelFromMM(mm: number) {
    return Math.round(3.77 * mm);
}

//const moment = require('moment');
export enum CFDateFormat {
    YYYY = 'YYYY',
    MM = 'MM',
    DD = 'DD',
    dd = 'dd',
    YYYYMM = 'YYYY.MM',
    YYYYMMDD = 'YYYY.MM.DD',
    YYMMDD = 'YY.MM.DD',
    YYMMDD2 = 'YYMMDD',
    MMDDW = 'MM.DD.W',
    MMM = 'MMM',
    HHmm = 'HH mm',
    amhhmm = 'amhhmm',
    YYMMDDHHmm = 'YYMMDD HH:mm',
    YY_MM_DD_AMPM_HHmm = 'YY.MM.DD AM/PM hh:mm',
    YYYY_MM_DD_AMPM_HHmm = 'YYYY.MM.DD AM/PM hh:mm',
    YYYYMMDDHHmm = 'YYYYMMDD HH:mm',
    YYYY년MM월DD일 = 'YYYY년 MM월 DD일',
    MM월DD일W요일 = 'MM월DD일W요일',
    YYYY년MM월DD일W요일 = 'YYYY년 MM월 DD일 W요일',
    MM월DD일amhhmm = 'MM월 DD일 AM/PM hh:mm',
    YYYY년MM월DD일24hour = 'YYYY년 MM월 DD일 HH:mm'

}

var inPreventDoubleClicks: boolean = false;
var ___seq = 0;
var generateSeq = function () {
    return ___seq++;
}

export class Debouncer {
    private debounceTimer: any = null;

    // debounceTimer 함수
    debounce(fn: Function, delay: number): void {
        // 이전 타이머가 있으면 취소
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        // 주어진 delay 시간 후에 마지막 함수를 실행
        this.debounceTimer = setTimeout(() => {
            fn(); // 실행할 함수 호출
        }, delay);
    }
}

export const CFHelper = {
    date: CFDate, // CFHelper.date는 CFDate로 통합한다.
    generate: {
        newName: (name: string, seed: string, existingNames: Array<string>, count: number = 0) => {
            return '';
        }
    },
    fn: {
        createDebouncer: (): Debouncer => {
            return new Debouncer;
        },
        preventDoubleClicks: (fn: any, delay: number = 1000) => {
            if (!inPreventDoubleClicks) {
                inPreventDoubleClicks = true;
                fn();
            }

            setTimeout(() => {
                inPreventDoubleClicks = false;
            }, delay);
        },
        intervalCall: (fn: any, limitTime: number, intervalTime: number) => {
            let interval: any;
            interval = setInterval(() => {
                fn();
            }, intervalTime);
            setTimeout(() => {
                clearInterval(interval);
            }, limitTime);
        },
        wait: async (ms = 1000): Promise<void> => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve();
                }, ms);
            });
        },

    },
    version: {
        compareVersions: (appVersionOfMe:string, appVersionMin: string) => {
            const arr1 = appVersionOfMe.split('.').map(Number);
            const arr2 = appVersionMin.split('.').map(Number);
        
            for (let i = 0; i < Math.max(arr1.length, arr2.length); i++) {
                const num1 = arr1[i] || 0; // undefined 방지
                const num2 = arr2[i] || 0;
                if (num1 < num2) return -1; // appVersionOfMe가 낮음 → 업데이트 필요
                if (num1 > num2) return 1;  // appVersionOfMe가 높음
            }
            return 0; // 같음
        },
    },
    id: {
        // "202304111307223-6bfqu"
        generateIdDateType: () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0'); // 월은 0부터 시작하므로 1을 더해줌
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const second = String(now.getSeconds()).padStart(2, '0');
            const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

            const formattedDate = `${year}${month}${day}${hour}${minute}${second}${milliseconds}`;
            const randomStr = Math.random().toString(36).substring(2, 7);
            const id = `${formattedDate}${randomStr}`;
            return id;
        },
        generateUUID: () => {
            return nanoid();
        }
    },
    svg: {
        updateViewBox: (svgString: string, rect: { left: number, top: number, width: number, height: number }) => {
            const { left, top, width, height } = rect;
            return svgString.replace(
              /viewBox="[^"]*"/,
              `viewBox="${left} ${top} ${width} ${height}"`
            );
        },
        // svgToImageUrl: (svgString: string): Promise<string> => {
        //     return new Promise((resolve, reject) => {
        //       const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
        //       const url = URL.createObjectURL(svgBlob);
          
        //       const img = new Image();
        //       img.onload = () => {
        //         const canvas = document.createElement('canvas');
        //         canvas.width = img.width;
        //         canvas.height = img.height;
          
        //         const ctx = canvas.getContext('2d');
        //         if (!ctx) return reject('Canvas context error');
          
        //         ctx.drawImage(img, 0, 0);
        //         const dataUrl = canvas.toDataURL('image/png');
          
        //         URL.revokeObjectURL(url); // 메모리 해제
        //         resolve(dataUrl);
        //       };
          
        //       img.onerror = (e) => {
        //         reject('SVG image load failed');
        //       };
          
        //       img.src = url;
        //     });
        // },
        // 이 함수는 안에 외부링크가 없을 경우 사용한다.
        svgStringToDataUrl: (svg: string) => {
            return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
        },
        // svg에서 %를 pixel로 변환한다. 배경변환 안되는 버그 수정을 위해서
        convertPercentToPixelInSVGString: (svgString: string, canvasWidth: number, canvasHeight: number) => {
            // SVG 문자열을 파싱합니다.
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(svgString, 'image/svg+xml');

            // 모든 요소를 선택합니다.
            const elements = xmlDoc.querySelectorAll('*');

            // 각 요소에 대해 작업을 수행합니다.
            elements.forEach((element) => {
                // width와 height 속성 값을 가져옵니다.
                const widthAttribute = element.getAttribute('width');
                const heightAttribute = element.getAttribute('height');

                // width와 height 값이 '%'로 끝나는지 확인합니다.
                if (widthAttribute && widthAttribute.endsWith('%')) {
                    // '%'로 끝난다면 canvasWidth를 기준으로 변환합니다.
                    const percentage = parseFloat(widthAttribute) / 100;
                    const newWidth: number = canvasWidth * percentage;

                    // 새로운 값으로 속성을 업데이트합니다.
                    element.setAttribute('width', newWidth.toString());
                }

                if (heightAttribute && heightAttribute.endsWith('%')) {
                    // '%'로 끝난다면 canvasHeight를 기준으로 변환합니다.
                    const percentage = parseFloat(heightAttribute) / 100;
                    const newHeight: number = canvasHeight * percentage;

                    // 새로운 값으로 속성을 업데이트합니다.
                    element.setAttribute('height', newHeight.toString());
                }
            });

            // 업데이트된 SVG 문자열을 반환합니다.
            return new XMLSerializer().serializeToString(xmlDoc);
        },
        changeSizeInSvgString: (svgString: string, width?: number, height?: number) => {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
            const svgRoot = svgDoc.documentElement;

            // viewbox 
            const viewBoxArr = svgRoot.getAttribute("viewBox")?.split(" ");
            if (!viewBoxArr || viewBoxArr.length < 4) { return svgString; }
            let _width: number;
            let _height: number;
            if (width === undefined) {
                _width = parseFloat(viewBoxArr[2]);
            } else {
                _width = width;
            }
            if (height === undefined) {
                _height = parseFloat(viewBoxArr[3]);
            } else {
                _height = height;
            }
            svgRoot.setAttribute("width", _width.toString());
            svgRoot.setAttribute("height", _height.toString());
            const respSvgString = new XMLSerializer().serializeToString(svgDoc);
            return respSvgString;
        },
        // url 주소에 &를 &amp; 로 변환 / 바른 방법
        fixSvgImageUrl: (svg: string) => {
            let result = svg.replace(/xlink:href="([^"]*)"/g, (match, p1) => {
                var modifiedHref = p1.replace(/&amp;/g, "&").replace(/&/g, "&amp;");
                return 'xlink:href="' + modifiedHref + '"';
            });
            //_log('fixSvgImageUrl svg, result =>', svg, result);
            return result;
        },
        convertToUniqueClassName: (svg: string, uid: string = 'svgu' + generateSeq()) => {
            _log('convertToUniqueClassName svg =>', svg);
            var modifiedSvgCode;
            try {
                // SVG 코드 문자열
                var svgCode = svg; // 여기에 SVG 코드를 넣으세요.

                // DOMParser를 사용하여 SVG 코드를 파싱합니다.
                var parser = new DOMParser();
                _log('convertToUniqueClassName2 parser =>', parser);

                var svgDoc = parser.parseFromString(svgCode, "image/svg+xml");
                _log('convertToUniqueClassName2 svgDoc =>', svgDoc);

                var styleTags = svgDoc.querySelectorAll("style");
                _log('convertToUniqueClassName2 styleTags =>', styleTags, styleTags.length);

                if (styleTags.length == 0) {
                    return svg;
                }

                if (styleTags[0].textContent?.includes('parsererror')) {
                    throw new Error();
                }
                styleTags.forEach(function (styleTag) {
                    let styleText: any = styleTag.textContent;
                    styleText = styleText.replace(/\.([a-zA-Z0-9_-]+)/g, '.$1.' + uid);
                    styleTag.textContent = styleText;
                });

                // Find all style elements in the SVG
                // var styleElements = svgDoc.getElementsByTagName('style');
                // if(styleElements.length == 0 || ) {
                //     throw new Error();
                // }
                // _log('convertToUniqueClassName2 styleElements =>', styleElements);

                // // Iterate through each style element
                // for (var i = 0; i < styleElements.length; i++) {
                //     var style = styleElements[i];

                //     // Extract the text content of the style element
                //     var styleContent = style.textContent;

                //     // Use a regular expression to find and replace class names
                //     if(styleContent) {
                //         var modifiedStyle = styleContent.replace(/\.([a-zA-Z0-9_-]+)/g, '.$1.' + uid);
                //         style.textContent = modifiedStyle;
                //     }

                //     // Update the style element with the modified content
                // }

                // 모든 클래스를 가진 요소를 선택합니다.
                var allElements = svgDoc.querySelectorAll("[class]");
                allElements.forEach(function (element) {
                    let currentClasses: any = element.getAttribute("class");
                    var newClasses = currentClasses.split(' ').map(function (className: any) {
                        return className + ` ${uid}`;
                    }).join(' ');
                    element.setAttribute("class", newClasses);
                });
                // 수정된 SVG 코드를 문자열로 얻습니다.
                modifiedSvgCode = new XMLSerializer().serializeToString(svgDoc);
                _log('convertToUniqueClassName2 modifiedSvgCode =>', modifiedSvgCode);

            } catch (e) {
                _log('convertToUniqueClassName2 e =>', e);
                modifiedSvgCode = svg;
            }

            return modifiedSvgCode;
        }
        // &token= 이부분을 날리는 버전
        // fixSvgImageUrl: (svg: string) => {
        //     let result = svg.replace(/xlink:href="([^"]*)"/g, (match, p1) => {
        //         var modifiedHref = p1.replace(/&.*/g, "");
        //         return 'xlink:href="' + modifiedHref + '"';
        //     });
        //     _log('fixSvgImageUrl svg, result =>', svg, result);
        //     return result;
        // }

    },
    json: {
        // json으로 변환하기 떄문에 함수는 사라진다.
        deepClone: (object: any) => {
            let _object;
            try {
                _object = JSON.parse(JSON.stringify(object));
            } catch (e) {
                _log('cfhelper.json.deepClone e =>', e);
            }
            return _object;
        },
    },
    object: {
        isEmpty(obj: any) {
            return Object.keys(obj).length === 0;
        },
        // 이 함수는 새로운 object를 만들어서 전달하는게 아니라 있는 값끼리 복사함 
        // 1 depth까지만 복사됨
        copyValue: (targetObj: any, srcObj: any, expertKey?: string) => {
            for (let key of Object.keys(targetObj)) {
                if (srcObj[key] !== undefined && key !== expertKey) {
                    targetObj[key] = srcObj[key];
                }
            }
        },
        clone: (object: any) => {
            return Object.assign({}, object);
        },
        /** 두개의 json array를 받아서 다른 object의 index array를 return함 */
        differIndexFromList: (list1: any, list2: any) => {
            var indexList = [];
            // var jsonArray1 = JSON.parse(JSON.stringify(json1));
            // var jsonArray2 = JSON.parse(JSON.stringify(json2));

            for (var i = 0; i < list1.length; i++) {
                var isEqual = true;

                for (var key in list1[i]) {
                    if (list1[i][key] !== list2[i][key]) {
                        isEqual = false;
                        break;
                    }
                }

                if (!isEqual) {
                    indexList.push(i);
                }
            }
            return indexList;
        },
        // checkUndefined: (obj: any) => {
        //     // for (var key in obj) {
        //     //     if (obj.hasOwnProperty(key)) {
        //     //         if (typeof obj[key] === 'undefined') {
        //     //             return true;
        //     //         } else if (typeof obj[key] === 'object') {
        //     //             if (CFHelper.object.checkUndefined(obj[key])) {
        //     //                 return true;
        //     //             }
        //     //         }
        //     //     }
        //     // }
        //     return false;
        // },
        replaceUndefinedWithValue: (obj: any, value: any) => {
            _log('replaceUndefinedWithValue obj,value =>', obj, value);
            // for (var key in obj) {
            //     if (obj.hasOwnProperty(key)) {
            //         if (typeof obj[key] === 'undefined') {
            //             obj[key] = value;
            //         } else if (typeof obj[key] === 'object') {
            //             CFHelper.object.replaceUndefinedWithValue(obj[key], value);
            //         }
            //     }
            // }
            return obj;
        },
        replaceObject: (list: Array<any>, object: any, keyFiledName: string) => {
            let index = 0;
            for (let _object of list) {
                if (_object[keyFiledName] == object[keyFiledName]) {
                    list[index] = object;
                    return;
                }
                index++;
            }
        }
    },
    calc: {
        fit: (containerWidth: number, containerHeight: number, width: number, height: number, padding: number = 0) => {
            _log('calc.fit containerWidth, containerHeight =>', containerWidth, containerHeight)
            let availableWidth = containerWidth - padding * 2;
            let availableHeight = containerHeight - padding * 2;
            let _width, _height;
            if (width / height > availableWidth / availableHeight) {
                _width = availableWidth;
                _height = height * availableWidth / width;
            } else {
                _height = availableHeight;
                _width = width * availableHeight / height;
            }

            // 계산 결과에 padding 값을 추가하여 반환
            let result = {
                width: _width,
                height: _height,
            };
            return result;
        }
    },
    element: {
        select: (el: any) => {
            // handle iOS as a special case
            if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {

                // save current contentEditable/readOnly status
                var editable = el.contentEditable;
                var readOnly = el.readOnly;

                // convert to editable with readonly to stop iOS keyboard opening
                el.contentEditable = true;
                el.readOnly = true;

                // create a selectable range
                var range = document.createRange();
                range.selectNodeContents(el);

                // select the range
                var selection: any = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                el.setSelectionRange(0, 999999);

                // restore contentEditable/readOnly to original state
                el.contentEditable = editable;
                el.readOnly = readOnly;
            }
            else {
                el.select();
            }
        }
    },
    url: {
        getFrontUrl: () => {
            let url = '';
            let protocol = window.location.href.split('//')[0];
            if (protocol && protocol.length > 0) {
                url = `${protocol}//`;
            }
            let host = window.location.host;
            url += `${host}`;
            return url;
        },
        getFileExtensionFromUrl(url: string) {
            // 물음표를 기준으로 URL을 나누어 배열로 저장
            const urlParts = url.split('?');

            // 배열의 마지막 부분을 가져와서 파일 이름을 추출
            const fileName = urlParts[urlParts.length - 1];

            // 파일 이름에서 마지막 점을 찾아서 확장자를 추출
            const lastDotIndex = fileName.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                const extension = fileName.substring(lastDotIndex + 1);
                return extension.toUpperCase(); // 대문자로 변환하여 반환
            } else {
                return null; // 확장자를 찾을 수 없는 경우
            }
        }
    },
    convert: {
        pxToRem: (px: number) => {
            const bodyStyles = window.getComputedStyle(document.body);
            const defaultFontSize = bodyStyles.getPropertyValue('font-size');
            let fontSize = parseInt(defaultFontSize);
            return px / fontSize;
        }
    },
    array: {
        pushUniqueItemInArray: (item: any, array: Array<any>) => {
            if (array.findIndex((_item) => _item._key == item._key) == -1) {
                array.push(item);
            }
        },
        // dateFieldName : isoDate string
        removeDuplicates(list: any[], targetFieldName: string, dateFieldName: string): any[] {
            _log('removeDuplicates list, targetFieldName, dateFieldName =>', list, targetFieldName, dateFieldName);
            let result = Object.values(
                list.reduce((acc: any, item) => {
                    // 기존에 같은 id가 없거나, 더 최신 updateDate가 있다면 업데이트
                    if (!acc[item[targetFieldName]] || new Date(item[dateFieldName]) > new Date(acc[item[targetFieldName]][dateFieldName])) {
                        acc[item[targetFieldName]] = item;
                    }
                    return acc;
                }, {})
            );
            _log('removeDuplicates result =>', result);
            return result;
        }
    },
    file: {
        formatBytes: (bytes: number) => {
            if (bytes === 0) return '0 Bytes';

            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(1024));

            const value = bytes / Math.pow(1024, i);

            // 뒤에 00은 있을 때만 붙이기
            const formattedValue = value % 1 === 0 ? value.toFixed(0) : value.toFixed(2);

            return `${formattedValue} ${sizes[i]}`;
        }
    },
    map: {
        // 거리 계산 함수 (Haversine 공식 사용)
        getDistance: (lat1: number, lng1: number, lat2: number, lng2: number) => {
            const R = 6371e3; // 지구 반지름 (미터)
            const toRad = (value: number) => (value * Math.PI) / 180;
            const dLat = toRad(lat2 - lat1);
            const dLng = toRad(lng2 - lng1);
            const a =
                Math.sin(dLat / 2) ** 2 +
                Math.cos(toRad(lat1)) *
                Math.cos(toRad(lat2)) *
                Math.sin(dLng / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c; // 거리 (미터)
        }
    }
    // text: {
    //     reduceTextLength: (text?: string, length: number = 15) => {
    //         let _text = text;
    //         if( text &&  text.length > length) {
    //             _text = text.slice(0,length) + '...';
    //         }
    //         return _text;
    //     }    
    // }
};

CFHelper.generate = {
    newName: (name: string, seed: string, existingNames: Array<string>, count: number = 0): any => {
        count++;
        let exist: boolean = false;
        for (let _name of existingNames) {
            if (_name == name) {
                exist = true;
                break;
            }
        }
        if (exist) {
            let _name = `${seed}(${count})`;
            let result = CFHelper.generate.newName(_name, seed, existingNames, count);
            return result;
        }
        return name;
    }
};


///////////////////////////////////////////////
// 사용하지 않음

// CFHelper.object.checkUndefined = (obj: any) => {
//     for (var key in obj) {
//         if (obj.hasOwnProperty(key)) {
//             if (typeof obj[key] === 'undefined') {
//                 return true;
//             } else if (typeof obj[key] === 'object') {
//                 if (CFHelper.object.checkUndefined(obj[key])) {
//                     return true;
//                 }
//             }
//         }
//     }
//     return false;
// };


