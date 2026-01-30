import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { IfMobileDirective, IfDesktopDirective, DeviceClassDirective, ViewModeClassDirective } from './directive/responsive.directive';

import { BLViewComponent } from './components/bl-view/bl-view.component';

import { BLToolbarComponent } from './components/bl-toolbar/bl-toolbar.component';
import { BLToolbarDividerComponent } from './components/bl-toolbar/items/bl-toolbar-divider/bl-toolbar-divider.component';
import { BLTextToolbarItemComponent } from './components/bl-toolbar/items/bl-text-toolbar-item/bl-text-toolbar-item.component';
import { BLButtonToolbarItemComponent } from './components/bl-toolbar/items/bl-button-toolbar-item/bl-button-toolbar-item.component';
import { BLSelectToolbarItemComponent } from './components/bl-toolbar/items/bl-select-toolbar-item/bl-select-toolbar-item.component';
import { BLSpinNumberToolbarItemComponent } from './components/bl-toolbar/items/bl-spin-number-toolbar-item/bl-spin-number-toolbar-item.component';

import { BLToastComponent } from './components/bl-toast/bl-toast.comopnent';
import { BLAlertComponent } from './components/bl-alert/bl-alert.component';
import { BLBottomSheetComponent } from './components/bl-bottom-sheet/bl-bottom-sheet.component';

import { BLPopupComponent } from './components/bl-popup/bl-popup.component';
import { BLModalPopupComponent } from './components/bl-modal-popup/bl-modal-popup.component';
import { BLDialogPopupComponent } from './components/bl-dialog-popup/bl-dialog-popup.component';
import { BLMenuPopupComponent } from './components/bl-menu-popup/bl-menu-popup.component';

import { BLButtonComponent } from './components/bl-button/bl-button.component';
//import { BLPopupButtonComponent } from './components/bl-popup-button/bl-popup-button.component';
import { BLStateButtonComponent } from './components/bl-state-button/bl-state-button.component';
import { BLSpinNumberComponent } from './components/bl-spin-number/bl-spin-number.component';
//import { BLSelectBoxComponent } from './components/bl-select-box/bl-select-box.component';

import { BLMenuItemComponent } from './components/bl-menu-popup/items/bl-menu-item/bl-menu-item.component';
import { BLDividerMenuItemComponent } from './components/bl-menu-popup/items/bl-divider-menu-item/bl-divider-menu-item.component';
import { BLTemplateMenuItemComponent } from './components/bl-menu-popup/items/bl-template-menu-item/bl-template-menu-item.component';
import { BLSubmenuMenuItemComponent } from './components/bl-menu-popup/items/bl-submenu-menu-item/bl-submenu-menu-item.component';

import { BLGridView } from './components/bl-grid-view/bl-grid.view';
import { BLGridItemView } from './components/bl-grid-view/bl-grid-item-view/bl-grid-item.view';
import { BLStateToolbarItemComponent } from './components/bl-toolbar/items/bl-state-toolbar-item/bl-state-toolbar-item.component';
import { BLToggleButtonToolbarItemComponent } from './components/bl-toolbar/items/bl-toggle-button-toolbar-item/bl-toggle-button-toolbar-item.component';
import { BLToggleButtonComponent } from './components/bl-toggle-button/bl-toggle-button.component';
import { BLFileButtonComponent } from './components/bl-file-button/bl-file-button.component';
import { BLPanelComponent } from './components/bl-panel/bl-panel.component';
import { BLNavigationHeaderView } from './components/bl-navigation-panel-container/bl-navigation-header/bl-navigation-header.view'; 
import { BLSegmentButtonView } from './components/bl-segment/items/bl-segment-button/bl-segment-button.view';
import { BLSegmentView } from './components/bl-segment/bl-segment.view';
import { BLSvgImgComponent } from './components/bl-svg-img/bl-svg-img.component';
import { BLNavigationPanelContainerView } from './components/bl-navigation-panel-container/bl-navigation-panel-container.view';
import { BLSwiperItemView } from './components/bl-swiper-view/bl-swiper-item-view/bl-swiper-item.view';
import { BLSwiperView } from './components/bl-swiper-view/bl-swiper.view';

import { BLScrollContainer } from './directive/bl-scroll-container';
import { BLMenuView } from './components/bl-menu-view/bl-menu.view';
import { BLBaseMenuItemView } from './components/bl-menu-view/bl-menu-items/bl-base-menu-item/bl-base-menu-item.view';
import { BLButtonMenuItemView } from './components/bl-menu-view/bl-menu-items/bl-button-menu-item/bl-button-menu-item.view';
import { BLNaviMenuItemView } from './components/bl-menu-view/bl-menu-items/bl-navi-menu-item/bl-navi-menu-item.view';
import { BLSwitchMenuItemView } from './components/bl-menu-view/bl-menu-items/bl-switch-menu-item/bl-switch-menu-item.view';
import { BLPanleGuideView } from './components/bl-panel-guide-view/bl-panel-guide.view';
import { BLInputComponent } from './components/bl-input/bl-input.component';
import { BLSelectView } from './components/bl-select/bl-select.view';
import { BLOptionView } from './components/bl-select/bl-option/bl-option.view';
import { BLResponsiveService } from './service/bl-responsive.service';
import { BLColorPickerPopupComponent } from './components/bl-color-picker-popup/bl-color-picker-popup.component';
import { ColorPickerModule } from 'ngx-color-picker';
import { BLHeaderMenuItemComponent } from './components/bl-menu-popup/items/bl-header-menu-item/bl-header-menu-item.component';
import { BLSliderComponent } from './components/bl-slider/bl-slider.component';
import { NgxSliderModule } from 'ngx-slider-v2';
//import { BLSpinSliderPopupComponent } from './components/bl-spin-slider-popup/bl-spin-slider-popup.component';
import { BLSliderBoxComponent } from './components/bl-slider-box/bl-slider-box.component';
import { BLColorPickerView } from './components/bl-color-picker/bl-color-picker.view';
import { SwiperModule } from 'swiper/angular';
import { BLEditableTextComponent } from './components/bl-editable-text/bl-editable-text.component';
import { BLTooltipComponent } from './components/bl-tooltip/bl-tooltip.component';
import { BLErrorComponent } from './components/bl-error/bl-error.comopnent';
import { BLPasswordInputComponent } from './components/bl-password-input/bl-password-input.component';
import { ReduceTextLengthPipe, SanitizeHtmlPipe } from '../cf-common/pipe/html.pipe';
import { BLCalendarDayItemView } from './components/bl-calendar-view/views/bl-calendar-day-item/bl-calendar-day-item.view';
import { BLCalendarItemContainer } from './components/bl-calendar-view/views/bl-calendar-item-container/bl-calendar-item-container.view';
import { BLCanlendarView } from './components/bl-calendar-view/bl-calendar.view';
import { BLInfitityScrollBaseComponent } from './components/bl-infinity-scroll-base/bl-infinity-scroll-base.component';

@NgModule({
    declarations: [
        // directive
        IfMobileDirective, IfDesktopDirective,  DeviceClassDirective, ViewModeClassDirective, 
        //IfTabletDirective,

        SanitizeHtmlPipe,
        ReduceTextLengthPipe,

        BLViewComponent,
        BLInfitityScrollBaseComponent,
        //BLViewContainerComponent,

        BLNavigationHeaderView,

        BLToolbarComponent,
        BLToolbarDividerComponent,
        BLTextToolbarItemComponent,
        BLButtonToolbarItemComponent,
        BLSelectToolbarItemComponent,
        BLStateToolbarItemComponent,
        BLSpinNumberToolbarItemComponent,
        BLToggleButtonToolbarItemComponent,
        
        BLButtonComponent,
        BLFileButtonComponent,
        BLToggleButtonComponent,
        BLSpinNumberComponent,
        //BLSelectBoxComponent,
        BLStateButtonComponent,
        //BLPopupButtonComponent,
        BLPopupComponent,
        BLPanelComponent,
        BLBottomSheetComponent,

        BLMenuPopupComponent,
        BLHeaderMenuItemComponent,
        BLMenuItemComponent,
        BLDividerMenuItemComponent,
        BLTemplateMenuItemComponent,
        BLSubmenuMenuItemComponent,
        BLColorPickerPopupComponent,
        BLColorPickerView,

        BLGridView,
        BLGridItemView,
        BLSwiperView,
        BLSwiperItemView,
        BLMenuView,
        BLBaseMenuItemView,
        BLButtonMenuItemView,
        BLNaviMenuItemView,
        BLSwitchMenuItemView,

        BLSegmentView,
        BLSegmentButtonView,
        BLSelectView,
        BLOptionView,

        BLNavigationPanelContainerView,

        BLModalPopupComponent,
        BLDialogPopupComponent,
        
        BLAlertComponent,
        BLToastComponent,
        BLErrorComponent,

        BLPanleGuideView,
        BLSvgImgComponent,
        BLInputComponent,
        BLTooltipComponent,
        BLSliderComponent,
        //BLSpinSliderPopupComponent,
        BLSliderBoxComponent,

        BLScrollContainer,
        BLEditableTextComponent,
        BLPasswordInputComponent,

        BLCalendarDayItemView,
        BLCalendarItemContainer,
        BLCanlendarView
    ],
    imports: [
        CommonModule,
        FormsModule,
        SwiperModule,
        ColorPickerModule,
        NgxSliderModule,
    ],
    exports: [
        IfMobileDirective, IfDesktopDirective, DeviceClassDirective, ViewModeClassDirective, 
        //IfTabletDirective, 
        SanitizeHtmlPipe,
        ReduceTextLengthPipe,

        BLViewComponent,
        BLInfitityScrollBaseComponent,
        //BLViewContainerComponent,

        BLNavigationHeaderView,
        
        BLToolbarComponent,
        BLToolbarDividerComponent,
        BLTextToolbarItemComponent,
        BLButtonToolbarItemComponent,
        BLSelectToolbarItemComponent,
        BLStateToolbarItemComponent,
        BLSpinNumberToolbarItemComponent,
        BLToggleButtonToolbarItemComponent,

        BLButtonComponent,
        BLFileButtonComponent,
        BLToggleButtonComponent,
        BLSpinNumberComponent,
        //BLSelectBoxComponent,
        BLStateButtonComponent,
        //BLPopupButtonComponent,
        BLPopupComponent,
        BLPanelComponent,
        BLBottomSheetComponent,        

        BLMenuPopupComponent,
        BLHeaderMenuItemComponent,
        BLMenuItemComponent,
        BLDividerMenuItemComponent,
        BLTemplateMenuItemComponent,
        BLSubmenuMenuItemComponent,
        BLColorPickerPopupComponent,
        BLColorPickerView,

        BLGridView,
        BLGridItemView,
        BLSwiperView,
        BLSwiperItemView,
        BLMenuView,
        BLBaseMenuItemView,
        BLButtonMenuItemView,
        BLNaviMenuItemView,
        BLSwitchMenuItemView,
        
        BLSegmentView,
        BLSegmentButtonView,
        BLSelectView,
        BLOptionView,
        
        BLNavigationPanelContainerView,

        BLModalPopupComponent,
        BLDialogPopupComponent,

        BLAlertComponent,
        BLToastComponent,
        BLErrorComponent,

        BLPanleGuideView,
        BLSvgImgComponent,
        BLInputComponent,
        BLTooltipComponent,
        BLSliderComponent,
        //BLSpinSliderPopupComponent,
        BLSliderBoxComponent,

        BLScrollContainer,
        BLEditableTextComponent,
        BLPasswordInputComponent,

        BLCalendarDayItemView,
        BLCalendarItemContainer,
        BLCanlendarView
    ],
    providers: [
        BLResponsiveService,
    ]
})
export class BLUIModule { }
