import { Component, Input } from '@angular/core';
import { CommunityIconComponent } from './community-icon.component';

const COVERS: Record<string, {label?: string; icon?: string; image?: string; background: string; color: string}> = {
    about: {label: 'notionable', background: '#eee6cf', color: '#e4c779'},
    announcements: {icon: 'megaphone', background: '#ffe4d1', color: '#ffb582'},
    events: {icon: 'calendar', background: '#ffe5dc', color: '#ffab91'},
    requests: {icon: 'chat', background: '#dceeea', color: '#8ecbbd'},
    hello: {label: 'hello', background: '#f9d4ec', color: '#ef90c9'},
    questions: {label: 'Q & A', background: '#dce4ff', color: '#9caeff'},
    'member-news': {icon: 'megaphone', background: '#ffead0', color: '#ffc77d'},
    lifeup: {label: 'LIFEUP', background: '#dce9ff', color: '#91b6f4'},
    bizup: {label: 'BIZUP', background: '#e6e1fa', color: '#b6a3e7'},
    notion: {image: '/assets/images/notion_icon.webp', background: '#e9e7e2', color: '#d4d0c6'},
    gtd: {label: 'GTD', background: '#dcefe2', color: '#99d5b0'},
    secondbrain: {icon: 'brain', background: '#e9ddf9', color: '#c6a0ed'},
    'ai-automation': {icon: 'robot', background: '#dceef3', color: '#8ec9da'},
    kakao: {image: '/assets/images/kakaotalk-pattern.svg', background: '#fff4bd', color: '#ffe15e'},
    routines: {icon: 'calendar', background: '#dcefe2', color: '#99d5b0'},
    development: {icon: 'code', background: '#dce4ff', color: '#9caeff'}
};

@Component({selector: 'community-room-cover', standalone: true, imports: [CommunityIconComponent],
    template: `<div class="wall" [style.--paper]="design.background" [style.--ink]="design.color" [class.wordmark]="!!design.label" [attr.data-topic]="roomId" aria-hidden="true">
        <svg class="texture-definitions" width="0" height="0" focusable="false"><defs>
            <filter id="community-pencil" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency=".045 .12" numOctaves="3" seed="8" result="wobble" />
                <feDisplacementMap in="SourceGraphic" in2="wobble" scale="3.8" xChannelSelector="R" yChannelSelector="G" result="rough" />
                <feTurbulence type="fractalNoise" baseFrequency=".65 .32" numOctaves="3" seed="14" result="grain" />
                <feColorMatrix in="grain" type="luminanceToAlpha" />
                <feComponentTransfer result="grainAlpha"><feFuncA type="table" tableValues="0 .08 .55 .95 1" /></feComponentTransfer>
                <feComposite in="rough" in2="grainAlpha" operator="in" />
            </filter>
            <filter id="community-paper"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        </defs></svg>
        <svg class="paper-grain" width="100%" height="100%" focusable="false"><rect width="100%" height="100%" filter="url(#community-paper)" /></svg>
        <div class="pattern">@for (motif of motifs; track motif) {
            <div class="motif">
                @if (design.image) { <img [src]="design.image" alt=""> }
                @else if (design.label) { <span class="word" [class.long]="roomId === 'about'">{{ design.label }}</span> }
                @else { <community-icon [name]="design.icon || 'chat'" [sketch]="true" /> }
            </div>
        }</div>
    </div>`,
    styles: [`
        :host{display:block;height:160px;overflow:hidden}
        .wall{height:100%;position:relative;overflow:hidden;background:var(--paper);color:#292824;pointer-events:none}
        .texture-definitions{position:absolute}.paper-grain{position:absolute;inset:0;opacity:.17;mix-blend-mode:multiply}
        .pattern{position:absolute;left:50%;top:48%;width:2240px;display:grid;grid-template-columns:repeat(8,1fr);gap:12px 28px;transform:translate(-50%,-50%) rotate(-13deg)}
        .motif{height:155px;display:flex;align-items:center;justify-content:center;opacity:.94;filter:url(#community-pencil)}
        .motif:nth-child(2n){transform:translate(24px,12px) rotate(18deg);opacity:.72}
        .motif:nth-child(3n){color:color-mix(in srgb,var(--ink) 60%,#514331);transform:rotate(-12deg) scale(1.09)}
        .motif:nth-child(n+9):nth-child(-n+16){translate:80px 0}
        community-icon{width:156px;height:156px}
        .motif img{width:150px;height:150px;object-fit:contain}
        .wordmark .pattern{width:3200px;gap:8px 36px}
        .word{font-family:Georgia,'Times New Roman',serif;font-size:90px;font-style:italic;font-weight:900;letter-spacing:-5px;white-space:nowrap;-webkit-text-stroke:1.1px currentColor;-webkit-text-fill-color:transparent;background:repeating-linear-gradient(115deg,currentColor 0 1px,transparent 1px 3px);background-clip:text;-webkit-background-clip:text}
        .word.long{font-size:72px;letter-spacing:-4px}
        .wall[data-topic="kakao"] .motif{opacity:1}
        .wall[data-topic="kakao"] .motif:nth-child(2n){opacity:.65}
        @media(max-width:760px){
            :host{height:120px}.pattern{width:1780px;gap:12px 22px}.motif{height:120px}
            community-icon{width:122px;height:122px}.motif img{width:118px;height:118px}
            .wordmark .pattern{width:2500px;gap:8px 24px}.word{font-size:72px}.word.long{font-size:56px;letter-spacing:-3px}
        }
    `]
})
export class CommunityRoomCoverComponent {
    @Input() roomId = '';
    readonly motifs = Array.from({length: 24}, (_, index) => index);
    get design() { return COVERS[this.roomId] || COVERS['requests']; }
}
