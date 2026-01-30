//import { BLNotesService } from "src/app/service/bl-notes.service";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore/lite";
import { CFHelper, _flog, _log, _valid } from "../cf-common/cf-common";
import { INPImage, NPNoteContent, NPPage, NPPageTemplate, CFNoteAPI } from "../fb-noteapi/cf-noteapi";
import { FabricHelper } from "./fabric.helper";
import { fabricObjectType } from '../fabricjs/fabricjs-type';

import { environment } from '../../environments/environment';

export class NoteRendererLib {

    // static renderPreviewPages(noteContent: any) {
    //     throw new Error('Method not implemented.');
    // }
    public noteApi: CFNoteAPI;
    public canvas: any;

    constructor(canvas: any) {
        _valid(canvas);
        this.canvas = canvas;

        let app = initializeApp(environment.firebaseConfig); //
        const db2 = getFirestore(app);
        this.noteApi = new CFNoteAPI(app, db2);
    }

    public getCanvas() {
        return this.canvas;
    }

    // await this.appService.renderPreviewPage(this.noteItemState.noteContent, page, false, null); // hidden canvas에 페이지를 render함
    // let imageDataUrl = this.appService.noteRenderer.getImageUrlFromCanvas();

    getImageUrlFromCanvas() {
        return this.canvas.toDataURL({ format: 'png' });
    }

    /* -------------------------------------------------------------------------- */
    /*                                  #preview                                  */
    /* -------------------------------------------------------------------------- */
    public async renderPreviewPages(noteContent: NPNoteContent, isReverse: boolean = false, isRemoveBg: boolean = false,
        removeObjectType?: fabricObjectType | null | undefined) {
        _flog(this.renderPreviewPages, arguments);
        _valid(noteContent.pages);

        let pages = isReverse ? noteContent.pages.slice().reverse() : noteContent.pages;
        await this.renderPreviewPagesWithPages(noteContent, pages, isRemoveBg, removeObjectType);
        // for(let page of pages) {
        //     if (!page.objects || page.objects.length == 0) { continue; }
        //     await this.renderPreviewPage(noteContent, page, isRemoveBg, removeObjectType);
        //     // let _template: NPPageTemplate | undefined = noteContent.templates.find(item => item._key == page.templateKey);
        //     // _log('renderPagesPreview _template =>', _template);

        //     // // render를 빠르게 한다고 await를 뺐는데 그럼 canvas하나가지고 돌려쓰기 때문에 문제가 됨
        //     // if (_template) {
        //     //     let svg = await this._renderPreviewPage(canvas, page, _template.width, _template.height, _template);
        //     //     if (svg) {
        //     //         page.previewCacheSvg = svg;
        //     //     }    
        //     // }
        // }
    }

    public async renderPreviewPagesWithPages(noteContent: NPNoteContent, pages: NPPage[], isRemoveBg: boolean = false,
        removeObjectType?: fabricObjectType | null | undefined) {
        _flog(this.renderPreviewPagesWithPages, arguments);
        _valid(pages);
        for (let page of pages) {
            if (!page.objects || page.objects.length == 0) { continue; }
            await this.renderPreviewPage(noteContent, page, isRemoveBg, removeObjectType);
        }
    }

    // render => page.previewCacheSvg에 svg 세팅
    public async renderPreviewPage(noteContent: NPNoteContent, page: NPPage, isRemoveBg: boolean = false,
        removeObjectType?: fabricObjectType | null | undefined, isChangeInnerPreviewCacheSvg: boolean = true) {
        _flog(this.renderPreviewPage, arguments);
        if (!noteContent) { return; }
        if (!page.objects || page.objects.length == 0) {
            _log('renderPreviewPage page.objects =>', page.objects);
            return;
        }
        //let template: NPPageTemplate | undefined = noteContent.templates.find(item => item._key == page.templateKey);
        let resp: { pageTemplate: NPPageTemplate | undefined, isRepaired: boolean } = await this.noteApi.getPageTemplateByPageAndRepairAsync(noteContent, page);
        let template = resp.pageTemplate;
        _log('renderPagesPreview template =>', template);
        // render를 빠르게 한다고 await를 뺐는데 그럼 canvas하나가지고 돌려쓰기 때문에 문제가 됨
        _valid(template);
        if (!template) { return; }

        let svg = await this._renderPreviewPage(page, template.width, template.height, template, isRemoveBg, removeObjectType);
        _valid(svg);
        if (!svg) { return; }

        if (isChangeInnerPreviewCacheSvg) {
            page.previewCacheSvg = svg;
        }
        return svg;
    }

    public repairObjects(objects: Array<any>, pageWidth: number, pageHeight: number) {
        let _objects: Array<any> = [];
        for (let object of objects) {
            let _object = this._repairObject(object, pageWidth, pageHeight);
            if (_object) {
                _objects.push(_object);
            }
        }
        return _objects;
    }

    public repairObjectOutOfbounds(object: any, pageWidth: number, pageHeight: number) {
        _flog(this.repairObjectOutOfbounds, arguments);
        let isChanged: boolean = false;
        // 버그패치 : 크기가 없이 들어오는 경우가 있음 / 이때는 그냥 보정을 안하는 것으로 함
        if (!pageWidth || !pageHeight) { return isChanged; }

        // scale 보정
        let gap: number = 34;
        if (!object.scaleX || object.scaleX == 0) {
            object.scaleX = 1;
        }
        if (!object.scaleY || object.scaleY == 0) {
            object.scaleY = 1;
        }

        let objectWidth: number = object.width * object.scaleX;
        let objectHeight: number = object.height * object.scaleY;

        // min-scale : 이미지의 경우만
        if (FabricHelper.isImageTypeObject(object)) {
            if (objectWidth < 10) {
                object.scaleX = 10 / object.width;
            }
            if (objectHeight < 10) {
                object.scaleY = 10 / object.height;
            }
        }

        // object.left 경계선 밖으로 나갔을때 
        if (object.left + objectWidth <= 5) { // left가 마이너스일 때
            object.left = gap - objectWidth;
            isChanged = true;
        } else if (object.left >= pageWidth - 5) {
            object.left = pageWidth - gap;
            isChanged = true;
        }

        // object.top 경계선 밖으로 나갔을때 
        if (object.top + objectHeight <= 5) {
            object.top = gap - objectHeight;
            isChanged = true;
        } else if (object.top >= pageHeight - 5) {
            object.top = pageHeight - gap;
            isChanged = true;
        }

        _log('repairObjectOutOfbounds object, object.left, gap, object.width =>', object, object.left, gap, object.width);
        return isChanged;
    }

    // 이 함수는 실제 template backgourndColor, backgroundImageURI 를 사용하여 svg를 만들고 있음
    // 
    private async _renderPreviewPage(page: NPPage, pageWidth: number, pageHeight: number, template?: NPPageTemplate,
        isRemoveBg: boolean = false, removeObjectType?: fabricObjectType | null | undefined) {
        _log('_renderPreviewPage template =>', template);
        let _page = this.noteApi.clonePage(page);
        let svg: string = '';
        // render template
        let bkImageUrl: string = '';
        let bkSvgData: string = '';
        let bkColor: string = _page.backgroundColor; ////'#ffffff';
        if (template) {
            bkColor = template.isPopupColorPicker && _page.backgroundColor ? _page.backgroundColor : template.backgroundColor;
            // 배경이미지로 사용할 필드를 결정, previewSVG를 쓰냐 아니면 배경이미지를 그대로 쓰냐
            let backgroundImageURI = this._getBackgroundImageURIFromTemplate(template);
            _log('_renderPreviewPage backgroundImageURI =>', backgroundImageURI);
            [bkImageUrl, bkSvgData] = await this.getResourceDataUrl(backgroundImageURI);
            _log('_renderPreviewPage bkImageUrl, bkSvgData =>', bkImageUrl, bkSvgData);
        }
        _log('_renderPreviewPage bkImageUrl, bkSvgData, bkColor =>', bkImageUrl, bkSvgData, bkColor);
        try {
            let objects = this.repairObjects(_page.objects, pageWidth, pageHeight);
            let result = this.repairPreviewSvgObjects(objects, bkImageUrl, bkSvgData, isRemoveBg, removeObjectType);
            _log('_renderPreviewPage objects, result, isRemoveBg =>', objects, result, isRemoveBg);
            _valid(this.canvas);
            svg = await FabricHelper.toSVGFromObjects(this.canvas, result.objects, bkColor, pageWidth, pageHeight, result.bkImageUrl, result.bkSvgData);
        } catch (e) {
            svg = '';
        }
        _log('_renderPreviewPage object svg =>', svg);
        return svg;
    }

    ///////////////////////////////////////////////////////////////////////////////////////
    // private 
    //


    // preview svg이미지를 만들때 objects에서 컨트롤 이미지를 제거하거나 앱별 예외사항을 처리한다.
    private repairPreviewSvgObjects(objects: Array<any>, bkImageUrl: string, bkSvgData: string, isRemoveBg: boolean = false,
        removeObjectType?: fabricObjectType | null | undefined) {
        _flog(this.repairPreviewSvgObjects, arguments)
        let _objects = [];
        for (let object of objects) {
            if (object.type == fabricObjectType.stickerGroupInputBox ||
                object.type == fabricObjectType.drawingInputBox ||
                object.type == fabricObjectType.imageInputBox) {
                // 하위 object에서 key가 없는 값을 reder에서 제외한다.
                if (object.objects) {
                    let subObjs = [];
                    _log('_renderPreviewPage object.objects =>', object.objects);
                    for (let _object of object.objects) {
                        if (!_object._key) { continue; }
                        subObjs.push(_object);
                    }
                    object.objects = subObjs;
                }
                _log('_renderPreviewPage object.objects2 =>', object.objects);
            }
            _objects.push(object);
        }
        _log('_renderPreviewPage _objects, isRemoveBg =>', _objects, isRemoveBg);
        // objects에서 imageInput, stickerInput에 guideImage, rect는 제외 한다.
        // drawingCalendar의 경우 템플릿 요소중에 currentDate, 배경이미지 제외한다.
        // isRemoveBg : 전체 보기에서는 배경을 제외한다.
        if (isRemoveBg) {
            _log('repairPreviewSvgObjects isRemoveBg =>', isRemoveBg)
            // 배경 이미지 제거 
            bkImageUrl = '';
            bkSvgData = '';

        } else {
            // bkImageUrl = '';
            // bkSvgData = '';
            _log('repairPreviewSvgObjects bkImageUrl, _objects =>', bkImageUrl, _objects);
        }

        // currentDate 제거
        if (removeObjectType) {
            _objects = _objects.filter(item => item.type !== removeObjectType); //fabricObjectType.currDateTimeText
        }

        return { objects: _objects, bkImageUrl: bkImageUrl, bkSvgData: bkSvgData };
    }


    // 템플릿에 배경을 가져오는 함수
    // 템플릿에 템플릿 object를 제외하고 object가  하나도 없다면 template.backgroundImageURI를 사용하고 아닐때만 previewSvgURI를 사용한다.
    // 이유는 previewSvgURI가 확대시 화질이 좋지 않다. 
    private _getBackgroundImageURIFromTemplate(template: NPPageTemplate) {
        _valid(template);
        if (!template) { throw new Error(); }

        let hasObjectForBg: boolean = false;
        for (let object of template.objects) {
            if (object._data) {
                let _data = JSON.parse(object._data);
                Object.assign(object, _data);
            }
            if (!FabricHelper.isTemplateTypeObject(object)) {
                hasObjectForBg = true;
                _log('_getBackgroundImageURIFromTemplate object =>', object);
                break;
            }
        }
        _log('_getBackgroundImageURIFromTemplate hasObjectForBg =>', hasObjectForBg);
        return hasObjectForBg ? template.previewSvgURI : template.backgroundImageURI;
    }

    // async _renderPreviewPage(canvas: any, page: NPPage, pageWidth: number, pageHeight: number, template?: NPPageTemplate) {
    //     _log('_renderPreviewPage template =>', template);
    //     let svg: string = '';
    //     // render template
    //     let bkImageUrl: string = '';
    //     let bkSvgData: string = '';
    //     let bkColor: string = page.backgroundColor; ////'#ffffff';
    //     if (template) {
    //         bkColor = template.isPopupColorPicker && page.backgroundColor? page.backgroundColor : template.backgroundColor;
    //         if (template.previewSvgURI) {
    //             [bkImageUrl, bkSvgData] = await this.getResourceDataUrl(template.previewSvgURI);
    //         }
    //     }
    //     _log('_renderPreviewPage bkImageUrl, bkColor =>', bkImageUrl, bkColor);
    //     try {
    //         let objects = this.repairObjects(page.objects, pageWidth, pageHeight);
    //         _log('_renderPreviewPage objects =>', objects);
    //         svg = await FabricHelper.toSVGFromObjects(canvas, objects, bkColor, pageWidth, pageHeight, bkImageUrl, bkSvgData);    
    //     } catch(e) {
    //         svg = '';
    //     }
    //     _log('_renderPreviewPage object svg =>', svg);
    //     return svg;
    // }


    private _repairObject(object: any, pageWidth: number, pageHeight: number) {
        _flog(this._repairObject, arguments);

        if (!object._key || object._key.length == 0) {
            object._key = CFHelper.id.generateUUID();
        }

        if (object.width == 0) { return null; }
        if (object.width < 1) {
            object.wait = 10;
        }
        if (object.height < 1) {
            object.height = 10;
        }
        if (FabricHelper.isTextTypeOjbect(object) && !object.lineHeight) {
            object.lineHeight = 1;
        }
        this.repairObjectOutOfbounds(object, pageWidth, pageHeight);
        return object;
    }

    // repairObjectOutOfbounds(object: any, pageWidth: number, pageHeight: number) {
    //     let isChanged: boolean = false;

    //     // scale
    //     let gap: number = 35;
    //     if(!object.scaleX || object.scaleX == 0) {
    //         object.scaleX = 1;
    //     }
    //     if(!object.scaleY || object.scaleY == 0) {
    //         object.scaleY = 1;
    //     }

    //     let objectWidth: number = object.width * object.scaleX;
    //     let objectHeight: number = object.height * object.scaleY;

    //     // min-scale : 이미지의 경우만
    //     if (FabricHelper.isImageTypeObject(object)) {
    //         if (objectWidth < 10) {
    //             object.scaleX = 10 / object.width;
    //         }
    //         if (objectHeight < 10) {
    //             object.scaleY = 10 / object.height;
    //         }
    //     }

    //     // object.left 경계선 밖으로 나갔을때 
    //     if(object.left + objectWidth <= 5) { // left가 마이너스일 때
    //         object.left = gap - objectWidth;
    //         isChanged = true;
    //     } else if(object.left >= pageWidth - 5) {
    //         object.left = pageWidth - gap;
    //         isChanged = true;
    //     }

    //     // object.top 경계선 밖으로 나갔을때 
    //     if(object.top + objectHeight <= 5) {
    //         object.top = gap - objectHeight;
    //         isChanged = true;
    //     } else if(object.top >= pageHeight - 5) {
    //         object.top = pageHeight - gap;
    //         isChanged = true;
    //     }

    //     _log('=========> object, object.left, gap, object.width =>', object, object.left, gap, object.width);
    //     return isChanged;
    // }

    async getResourceDataUrl(resURI: string, toUrl: boolean = false): Promise<Array<string>> {
        let image: INPImage = await this.noteApi.parseURI(resURI);
        _log('getResourceDataUrl resURI, image =>', resURI, image);
        let imageUrl: string = '', svgData: string = '';
        if (image.type == 'svg') {
            let svg = CFHelper.svg.changeSizeInSvgString(image.data);
            svg = CFHelper.svg.fixSvgImageUrl(svg);
            if (toUrl) {
                imageUrl = CFHelper.svg.svgStringToDataUrl(svg);
            } else {
                svgData = svg;    // 이미지 안에 외부 링크 이미지가 있으면 표시가 안되는 문제 떄문에 이렇게 했는데 그럼 또 basic_memo 가 안보여서 
            }
        } else {
            imageUrl = resURI;
        }
        _log('getResourceDataUrl imageUrl, svgData =>', imageUrl, svgData);
        return [imageUrl, svgData];
    }
}