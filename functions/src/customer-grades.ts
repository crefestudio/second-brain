import { CUSTOMER_GRADES } from './template-catalog';
export type CustomerGrade = string;

export function normalizedCustomerPhone(value: unknown): string {
    return String(value ?? '').replace(/\D/g, '');
}

export function addCustomerGrade(grades: Map<string, CustomerGrade>, phoneValue: unknown, grade: CustomerGrade | null): void {
    const phone = normalizedCustomerPhone(phoneValue);
    if (!phone || !grade) return;
    const ranks: Record<CustomerGrade, number> = Object.fromEntries(CUSTOMER_GRADES.map(grade => [grade, grade === 'premium' ? 3 : grade === 'standard' ? 2 : 1]));
    const current = grades.get(phone);
    if (!current || ranks[grade] > ranks[current]) grades.set(phone, grade);
}
