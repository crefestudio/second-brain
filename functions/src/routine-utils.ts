/** Korean calendar boundaries, independent of the server's local timezone. */
export function habitDayRange(date: string): { start: string; end: string } {
    const start = new Date(`${date}T00:00:00+09:00`);
    return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}

/** Count a habit once per day; any completed copy counts as completed. */
export function uniqueHabitLogs(pages: any[]): any[] {
    const logs = new Map<string, any>();
    for (const page of pages) {
        const id = page.properties?.habitId?.rich_text?.map((part: any) => part.plain_text ?? part.text?.content ?? '').join('');
        const key = id || page.id;
        const previous = logs.get(key);
        if (!previous || page.properties?.완료?.checkbox === true) logs.set(key, page);
    }
    return [...logs.values()];
}
