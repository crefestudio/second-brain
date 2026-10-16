export type CustomerGrade = 'standard' | 'premium' | 'scrapbook' | 'planner';

export function normalizedCustomerPhone(value: unknown): string {
    return String(value ?? '').replace(/\D/g, '');
}

export function addCustomerGrade(grades: Map<string, CustomerGrade>, phoneValue: unknown, grade: CustomerGrade | null): void {
    const phone = normalizedCustomerPhone(phoneValue);
    if (!phone || !grade) return;
    const ranks: Record<CustomerGrade, number> = { planner: 1, scrapbook: 1, standard: 2, premium: 3 };
    const current = grades.get(phone);
    if (!current || ranks[grade] > ranks[current]) grades.set(phone, grade);
}
