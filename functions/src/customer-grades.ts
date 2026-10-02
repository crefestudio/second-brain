export type CustomerGrade = 'standard' | 'premium';

export function normalizedCustomerPhone(value: unknown): string {
    return String(value ?? '').replace(/\D/g, '');
}

export function addCustomerGrade(grades: Map<string, CustomerGrade>, phoneValue: unknown, grade: CustomerGrade | null): void {
    const phone = normalizedCustomerPhone(phoneValue);
    if (!phone || !grade || grades.get(phone) === 'premium') return;
    grades.set(phone, grade);
}
