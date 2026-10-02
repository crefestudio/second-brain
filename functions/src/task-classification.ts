interface TaskClassificationInput {
    dateData?: { date?: string };
    kinds?: string;
}

// Use the resolved date for both the assistant response and Notion properties.
export function resolveTaskKinds(result: TaskClassificationInput): string {
    return result.dateData?.date ? "일정" : result.kinds ?? "수집함";
}
