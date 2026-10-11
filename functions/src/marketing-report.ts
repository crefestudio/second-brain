export type MarketingGoals = { revenue: number; averagePrice: number; trafficConversion: number; purchaseConversion: number };
function kstCalendar(date: Date): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
    return { year: value('year'), month: value('month'), day: value('day') };
}
export function marketingReport(summary: { month: string; totalViews: number; productSales: Record<string, { count: number; revenue: number }>; sources: Array<{ count: number; sourceViews: number | null }> }, goals: MarketingGoals, now = new Date()) {
    if (!goals || ![goals.revenue, goals.averagePrice, goals.trafficConversion, goals.purchaseConversion].every(v => typeof v === 'number' && Number.isFinite(v) && v > 0) || goals.trafficConversion > 100 || goals.purchaseConversion > 100) throw new Error('INVALID_GOALS');
    const purchases = Object.values(summary.productSales).reduce((n, p) => n + p.count, 0);
    const measured = summary.sources.filter(s => typeof s.sourceViews === 'number' && Number.isFinite(s.sourceViews) && s.sourceViews >= 0);
    const views = measured.length ? measured.reduce((n, s) => n + s.sourceViews!, 0) : null;
    const calendar = kstCalendar(now);
    const [summaryYear, summaryMonth] = summary.month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(summaryYear, summaryMonth, 0)).getUTCDate();
    const elapsedDays = summaryYear === calendar.year && summaryMonth === calendar.month ? calendar.day : daysInMonth;
    const monthlyPurchases = goals.revenue / goals.averagePrice;
    const monthlyInflows = monthlyPurchases / (goals.purchaseConversion / 100);
    const targetInflows = Math.ceil(monthlyInflows * elapsedDays / daysInMonth);
    const targetSourceViews = Math.ceil(monthlyInflows / (goals.trafficConversion / 100) * elapsedDays / daysInMonth);
    const inflows = targetInflows;
    const values = [
        { name: '소스 조회수', actual: views, target: Math.ceil(inflows / (goals.trafficConversion / 100)), unit: '회', lever: '콘텐츠 노출', action: '영상 주제·제목·썸네일과 배포 채널을 점검해 콘텐츠 노출을 늘리세요.' },
        { name: '유입 전환율', actual: views && views > 0 ? measured.reduce((n, s) => n + s.count, 0) / views * 100 : null, target: goals.trafficConversion, unit: '%', lever: '콘텐츠 설득 구조·유인 요소', action: '콘텐츠의 문제 제기, 해결 가치, 행동 유도 문구와 링크 혜택을 개선하세요.' },
        { name: '상품 유입수', actual: summary.totalViews, target: inflows, unit: '회', lever: '콘텐츠 종합·기타 노출·광고·프로모션', action: '유입 소스를 점검하고 콘텐츠 개선, 추가 노출, 광고·프로모션 실험으로 상품 방문을 늘리세요.' },
        { name: '구매 전환율', actual: summary.totalViews > 0 ? purchases / summary.totalViews * 100 : null, target: goals.purchaseConversion, unit: '%', lever: '상품 구매력·상세 페이지 설득 구조·리뷰 관리', action: '상품의 가치와 가격, 후기·증거, 상세 페이지 설득 구조와 구매 흐름을 점검하세요.' }
    ];
    values[0].target = targetSourceViews;
    values[2].target = targetInflows;
    const warnings = ['월 누적 실적과 월 전체 목표를 비교합니다. 월중 부족분은 최종 실패를 뜻하지 않습니다.', '구매는 전체 구매자 기록, 유입은 추적 링크 방문 기준으로 서로 연결된 구매 퍼널이 아닙니다. 구매 전환율은 참고 비율이며 원인이나 채널별 구매 성과를 단정할 수 없습니다.', '유입은 중복 방문을 포함하며, 초기화 이전 구매와 이후 유입의 집계 기간이 다를 수 있습니다.'];
    if (measured.length < summary.sources.length || views === null) warnings.push('YouTube 조회수가 미연결되었거나 일부 소스만 연결되었습니다. 미확인 조회수는 0으로 취급하지 않습니다.');
    if (summary.totalViews < 100 || purchases < 10) warnings.push('표본이 작아 전환율 변동이 큽니다. 개선 우선순위는 검증할 가설로 해석하세요.');
    return { month: summary.month, generatedAt: new Date().toISOString(), goals, purchases, totalInflows: summary.totalViews, warnings, metrics: values.map(m => ({ ...m, gap: m.actual === null ? null : m.target - m.actual, status: m.actual === null ? '측정 필요' : m.actual < m.target ? '목표 미달' : '목표 달성' })) };
}
