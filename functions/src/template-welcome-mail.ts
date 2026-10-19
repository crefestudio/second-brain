import { TEMPLATE_PRODUCTS, TemplateId } from './template-catalog';

export interface WelcomeMailLinks {
    installYoutubeUrl: string;
    reviewUrl: string;
    lifeupbotUrl: string;
    lifeupCareUrl: string;
}

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// HTML and plain text share the same sections and conditional product metadata.
export function templateWelcomeMail(templateId: TemplateId, name: string, links: WelcomeMailLinks, releaseUrl?: string): { subject: string; text: string; html: string } {
    const product = TEMPLATE_PRODUCTS[templateId];
    const config = product.welcome;
    const appUrl = `https://notionable.net/app?templateId=${templateId}`;
    const connectUrl = `https://notionable.net/app?menu=connect&templateId=${templateId}`;
    const pdfUrl = `https://app.notionable.net/templateDownload/${product.pdfFileName}`;
    const divider = '<div style="height:1px;background:#eceef1;margin:32px 0"></div>';
    const paragraph = (value: string, emphasis = '') => {
        let content = escape(value).replace(/\n/g, '<br>');
        if (emphasis) content = content.replace(escape(emphasis), `<strong>${escape(emphasis)}</strong>`);
        return `<p style="margin:0 0 18px;font-size:15px;line-height:1.8;color:#555;">${content}</p>`;
    };
    const button = (label: string, url: string, yellow = false) => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 20px;background:${yellow ? '#fee500' : '#1d4ed8'};border-radius:8px;color:${yellow ? '#191919' : '#ffffff'};font-size:15px;font-weight:700;text-decoration:none;">${escape(label)} →</a>`;
    const greeting = `${name.trim() ? name.trim() + '님,\n' : ''}라이프업과 함께하는 새로운 시작을 환영합니다. 🎉`;
    const intro = '라이프업과 함께 목표부터 프로젝트, 일상과 기록까지 나만의 방식으로 삶을 관리해보세요.';
    const texts = [greeting, intro];
    const sections: string[] = [];
    const section = (icon: string, title: string, body: string, actions: Array<[string, string]> = [], yellow = false, event = false, emphasis = '') => {
        texts.push([title, body, ...actions.map(([label, url]) => `${label}: ${url}`)].join('\n'));
        const content = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;border-collapse:collapse;"><tr><td valign="middle" style="padding:0 8px 0 0;font-size:18px;line-height:24px;">${icon}</td><td valign="middle" style="padding:0;font-size:20px;font-weight:700;line-height:24px;color:#171717;">${escape(title)}</td></tr></table>` + paragraph(body, emphasis) + actions.map(([label, url]) => `<p style="margin:16px 0 0">${button(label, url, yellow)}</p>`).join('');
        sections.push(divider + (event ? `<div style="padding:24px;background:#f8faff;border-radius:12px">${content}</div>` : content));
    };
    const installationTitle = config.displayName + ' 설치';
    const installationText = `아래 버튼을 눌러 ${config.usageName} 템플릿을 설치해 주세요.`;
    const installationUrl = releaseUrl || product.releaseUrl;
    texts.push([installationTitle, installationText, `${config.displayName} 설치하기: ${installationUrl}`, `노션 라이프업 템플릿 설치 안내 영상 보기: ${links.installYoutubeUrl}`].join('\n'));
    sections.push(divider + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;border-collapse:collapse;"><tr><td valign="middle" style="padding:0 8px 0 0;font-size:18px;line-height:24px;">📥</td><td valign="middle" style="padding:0;font-size:20px;font-weight:700;line-height:24px;color:#171717;">${escape(installationTitle)}</td></tr></table>` + paragraph(installationText) + button(config.displayName + ' 설치하기', installationUrl) + `<p style="margin:16px 0 0"><a href="${escape(links.installYoutubeUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:14px;color:#2563eb;text-decoration:none;">노션 라이프업 템플릿 설치 안내 영상 보기 ↗</a></p>`);
    section('📄', '보관용 PDF', '설치 링크와 이용 안내를 담은 보관용 PDF 파일도 함께 전달드립니다.', [['보관용 PDF 열기', pdfUrl]]);
    section('🤖', '라이프봇을 소개합니다', '라이프봇은 라이프업의 다양한 자동화 기능을 편리하게 설정하고 관리하는 공간입니다. 앞으로 추가될 새로운 자동화 기능들도 모두 이곳에서 만나보실 수 있습니다.\n아래 버튼을 눌러 미리 둘러보시고, 카카오톡 연결부터 시작해 보세요!', [['라이프봇 둘러보기', appUrl]], false, false, '카카오톡 연결');
    if (config.introductionVideoUrl) {
        section('🎬', product.nameKoFull + ' 소개 영상', `짧은 소개 영상으로 ${config.usageName} 사용 방법을 확인해 보세요.`, [[config.usageName + ' 소개 영상 보기', config.introductionVideoUrl]]);
    }
    const capture = product.kakaoCaptureScope === 'note' ? '할 일, 메모, 자료와 연락처를 기본 노트로' : product.kakaoCaptureScope === 'task' ? '할 일과 일정' : product.kakaoCaptureScope === 'reference' ? '메모와 자료' : '할 일, 일정, 아이디어와 자료';
    section('💬', '카카오톡 라이프봇', `카카오톡으로 보낸 ${capture}를 AI가 정리해 내 노션 템플릿에 저장합니다.\n카카오톡 라이프봇을 연결하고, 생각나는 순간마다 간편하게 기록해 보세요.`, [['카카오톡 라이프봇 연결하기', connectUrl]], true);
    section('🛡️', '라이프업 케어', '사용 문의, 오류 신고, 업데이트 소식과 활용 상담을 한곳에서 확인하세요.', [['라이프업 케어로 이동하기', links.lifeupCareUrl]]);
    if (config.reviewEvent === 'review') {
        section('🎁', '리뷰 작성하고 라이프봇 1년 무료 이용권 받기', `${config.displayName} 구매 후 솔직한 사용 후기를 남겨주세요. (~12/31)\n정식 오픈 후 라이프봇을 1년 동안 무료로 이용하실 수 있습니다.`, [['리뷰 남기러 가기', links.reviewUrl]], false, true);
    } else if (config.reviewEvent === 'lifeup-review') {
        section('🎁', '리뷰 작성하고 라이프봇 1년 무료 이용권 선물 받기', `${config.displayName}를 구매해주신 분들께 감사의 마음을 담아, 라이프봇 1년 무료 이용권을 선물로 드립니다.(~12/31)\n라이프봇은 라이프업 템플릿을 더 편리하게 사용하고 꾸준히 활용할 수 있도록 도와드리는 자동화 서비스입니다.\n${config.displayName}를 직접 사용해보신 후 상품 페이지에 솔직한 리뷰를 남겨주세요.\n라이프업을 사용한 화면을 사진으로 함께 남겨주시면, 다른 분들께도 큰 도움이 됩니다. 😊\n⚠️ 결제처 ‘래피드’가 아닌, 아래 버튼으로 이동한 노셔너블 홈페이지 상품에 리뷰를 남겨주세요.`, [['라이프봇 알아보기', links.lifeupbotUrl], [config.displayName + ' 리뷰 작성하기', links.reviewUrl]], false, true);
    }
    return {
        subject: config.displayName + ' 구매 안내 및 보관용 PDF를 보내드립니다',
        text: texts.join('\n\n'),
        html: `<div style="margin:0;background:#f5f6f8;padding:32px 16px;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#24292f;box-sizing:border-box"><div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden"><div style="padding:32px 32px 40px"><p style="margin:0 0 24px;font-size:18px;font-weight:700"><a href="https://notionable.net" style="color:#ec4899;text-decoration:none">🧠 Notionable</a></p><h1 style="margin:0 0 16px;font-size:26px;line-height:1.45;color:#171717">${escape(greeting).replace(/\n/g, '<br>')}</h1>${paragraph(intro)}${sections.join('')}</div></div></div>`
    };
}
