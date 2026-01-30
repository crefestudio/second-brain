import { CFHelper, _flog, _log, _valid } from "../cf-common/cf-common";
import { fabricObjectType } from "../fabricjs/fabricjs-type";

// js libs
declare const fabric: any;

export class FabricHelper {
    /* -------------------------------------------------------------------------- */
    /*                                    #type                                   */
    /* -------------------------------------------------------------------------- */
    // #todo , getActiveObject, getActiveObjects 그룹처리 다루기
    static isTextTypeOjbect(object: any) {
        return (object.type == fabricObjectType.itext 
            || object.type == fabricObjectType.textbox 
            || object.type == fabricObjectType.textInputBox 
            || object.type == fabricObjectType.currDateTimeText 
            //|| object.type == fabricObjectType.currCalText
        );
    }

    static isImageTypeObject(object: any) {
        return (object.type == fabricObjectType.image);
    }

    static isTemplateTypeObject(object: any) {
        return (object.type == fabricObjectType.textInputBox 
            || object.type == fabricObjectType.imageInputBox 
            || object.type == fabricObjectType.drawingInputBox 
            || object.type == fabricObjectType.stickerGroupInputBox
            || object.type == fabricObjectType.currDateTimeText 
            //|| object.type == fabricObjectType.currCalText
        );
    }

    /* -------------------------------------------------------------------------- */
    /*                                   #canvas                                  */
    /* -------------------------------------------------------------------------- */
    // 배경 적용을 위해서 bkImageUrl 또는 bkSvgImageData를 넣어줘야 함
    static async toSVGFromObjects(canvas: any, objects: Array<any>, bkColor: string, width: number, height: number, bkImageUrl: string = '', bkSvgImageData: string = ''): Promise<string> {
        _flog(this.toSVGFromObjects, arguments);
        
        // this.setBackgroundColor(bkColor, true, canvas); // 이 배경색 설정을 이미지보다 앞에 넣으면 색 갱신이 안되는 버그 수정
        canvas.clear();
        canvas.setWidth(width);
        canvas.setHeight(height);
        FabricHelper.setBackgroundColor(canvas, bkColor, true ); // 이 배경색 설정을 이미지보다 앞에 넣으면 색 갱신이 안되는 버그 수정     
        
        // 배경이 있으면 넣고 없으면 reset
        if ((bkImageUrl && bkImageUrl.length > 0) || (bkSvgImageData && bkSvgImageData.length > 0)) {
            // 배경을 url로 넣기
            if (bkImageUrl && bkImageUrl.length > 0) {
                await FabricHelper.setBackgroundImageFromUrl(canvas, {width: width, height: height}, bkImageUrl, );
            }
            // 배경을 svg로 넣기
            if (bkSvgImageData && bkSvgImageData.length > 0) {
                await FabricHelper.setBackgroundImageFromSvg(bkSvgImageData, canvas,  {width: width, height: height});
            }
        } else {
            await FabricHelper.setBackgroundImageFromSvg('', canvas,  {width: width, height: height});
        }
        return new Promise((resolve, reject) => {
            let json = canvas.toJSON();
            json.objects = objects? objects : [];
            canvas.loadFromJSON(json, () => {
                let svg = canvas.toSVG();
                let _svg = CFHelper.svg.changeSizeInSvgString(svg);
                _svg = CFHelper.svg.fixSvgImageUrl(_svg); // svg에 image tag안에 &를 &amp; 로 교체함 / 안그럼 파싱 오류남 
                resolve(_svg);
            });
        });
    }

    static async setBackgroundImageFromUrl(targetCanvas: any, canvasSize: any, backgourndImageUrl?: string): Promise<any> {
        _log('setBackgroundImage backgourndImageUrl =>', backgourndImageUrl);
        //_valid(backgourndImageUrl);
        let canvas = targetCanvas;
        return new Promise((resolve, reject) => {
            if (backgourndImageUrl) {
                fabric.Image.fromURL(backgourndImageUrl, (image: any, isError: boolean) => {
                    _log('setBackgroundImage2 image =>', image);

                    if (!_valid(image != null)) { throw Error(); }
                    // image.scaleToWidth(canvas.width, false);
                    FabricHelper.fitImageSizeInCanvas(canvasSize, image, 0);
                    // #bgImage
                    canvas.setBackgroundImage(image, (_image: any) => {
                        _log('setBackgroundImage _image =>', _image);
                        canvas.renderAll();
                        resolve({});
                    });
                    //image._element.crossOrigin = 'anonymous';
                }, {
                    erasable: false,
                    crossOrigin: 'anonymous'
                });                
                
            } else {
                // clear
                canvas.setBackgroundImage(null, () => {
                    canvas.renderAll();
                    resolve({});
                });
            }
        });
    }

    // static async setBackgroundImageFromUrl( targetCanvas: any, canvasSize: any, backgourndImageUrl?: string): Promise<any> {
    //     _log('setBackgroundImage backgourndImageUrl =>', backgourndImageUrl);
    //     //_valid(backgourndImageUrl);
    //     let canvas = targetCanvas;
    //     return new Promise((resolve, reject) => {
    //         if (backgourndImageUrl) {
    //             fabric.Image.fromURL(backgourndImageUrl, (image: any, isError: boolean) => {
    //                 _log('setBackgroundImage2 image =>', image);

    //                 if (!_valid(image != null)) { throw Error(); }
    //                 // image.scaleToWidth(canvas.width, false);
    //                 FabricHelper.fitImageSizeInCanvas(canvasSize, image, 0);
    //                 canvas.setBackgroundImage(image, (_image: any) => {
    //                     _log('setBackgroundImage _image =>', _image);
    //                     canvas.renderAll();
    //                     resolve({});
    //                 });
    //             }, {
    //                 erasable: false,
    //                 // width: canvas.width,
    //                 // height: canvas.height
    //             });                
                
    //         } else {
    //             // clear
    //             canvas.setBackgroundImage(null, () => {
    //                 canvas.renderAll();
    //                 resolve({});
    //             });
    //         }
    //     });
    // }

    static async setBackgroundImageFromSvg(svgData: string, targetCanvas: any, canvasSize: any): Promise<any> {
        _log('setBackgroundImageFromSvg svgData =>', svgData);
        //_valid(svgData);
        let canvas = targetCanvas;
        _log('setBackgroundImageFromSvg canvas.width, canvas.height, canvas.zoom =>', canvasSize.width, canvasSize.height, canvas.getZoom());
        svgData = CFHelper.svg.convertPercentToPixelInSVGString(svgData, canvasSize.width, canvasSize.height);

        return new Promise((resolve, reject) => {
            if (svgData) { 
                // rect width: 100%, height: 100% 변환이 제대로 안됨
                fabric.loadSVGFromString(svgData, (objects: any, options: any) => {
                    _log('setBackgroundImageFromSvg objects, options.width, options.height =>', 
                        objects, options.width, options.height);

                    const image = fabric.util.groupSVGElements(objects, options);
                    image.set( { 
                        erasable: false, 
                        width: canvasSize.width, 
                        height: canvasSize.height
                    });
                    _log('setBackgroundImageFromSvg image =>', image);

                    if (!_valid(image != null)) { throw Error(); }
                    FabricHelper.fitImageSizeInCanvas(canvasSize, image, 0);
                   
                    canvas.setBackgroundImage(image, (_image: any) => {
                        _log('setBackgroundImageFromSvg _image =>', _image);
                        canvas.renderAll();
                        resolve({});
                    });
                }, (item: any, object: any) => {
                    _log('setBackgroundImageFromSvg::reviver item, object =>', item, object);
                    // object.set('top', object.top + 400);
                    // object.set('left', object.left + 300);
                });                
            } else {
                // clear
                canvas.setBackgroundImage(null, () => {
                    canvas.renderAll();
                    resolve({});
                });
            }
        });
    }

    // static async setBackgroundImageFromSvg(svgData: string, targetCanvas: any, canvasSize: any): Promise<any> {
    //     _log('setBackgroundImageFromSvg svgData =>', svgData);
    //     //_valid(svgData);
    //     let canvas = targetCanvas;
    //     _log('setBackgroundImageFromSvg canvas.width, canvas.height, canvas.zoom =>', canvasSize.width, canvasSize.height, canvas.getZoom());
    //     svgData = CFHelper.svg.convertPercentToPixelInSVGString(svgData, canvasSize.width, canvasSize.height);

    //     return new Promise((resolve, reject) => {
    //         if (svgData) {
    //             // rect width: 100%, height: 100% 변환이 제대로 안됨
    //             fabric.loadSVGFromString(svgData, (objects: any, options: any) => {
    //                 _log('setBackgroundImageFromSvg objects, options.width, options.height =>', objects, options.width, options.height);

    //                 const image = fabric.util.groupSVGElements(objects, options);
    //                 image.set( { erasable: false, width: canvasSize.width, height: canvasSize.height });

    //                 if (!_valid(image != null)) { throw Error(); }
    //                 FabricHelper.fitImageSizeInCanvas(canvasSize, image, 0, 0);
                
    //                 canvas.setBackgroundImage(image, (_image: any) => {
    //                     _log('setBackgroundImageFromSvg _image =>', _image);
    //                     canvas.renderAll();
    //                     resolve({});
    //                 });
    //             }, (item: any, object: any) => {
    //                 _log('setBackgroundImageFromSvg::reviver item, object =>', item, object);
    //                 // object.set('top', object.top + 400);
    //                 // object.set('left', object.left + 300);
    //             });                
    //         } else {
    //             // clear
    //             canvas.setBackgroundImage(null, () => {
    //                 canvas.renderAll();
    //                 resolve({});
    //             });
    //         }
    //     });
    // }

    static fitImageSizeInCanvas(canvasSize: any, image: any, gap = 30, delta: number = 0) {
        _log('fitImageSizeInCanvas1 image =>', image.width, image.height, image.scaleX, image.scaleY);
        let imageWidth: number = image.width * image.scaleX;
        let imageHeight: number = image.height * image.scaleY;

        // 가로
        if(imageWidth > canvasSize.width) {
            image.scaleToWidth(canvasSize.width - gap, false); // scaleX,Y가 바뀜.
        }
        _log('fitImageSizeInCanvas2 image =>', image.width, image.height, image.scaleX, image.scaleY);

        // scaleToWidth함수가 이미지가 화면 밖으로 가는 버그가 있어서 이렇게 보정해줌
        image.scaleX = image.scaleX.toFixed(6);
        image.scaleY = image.scaleY.toFixed(6);

        imageWidth = image.width * image.scaleX;
        imageHeight = image.height * image.scaleY;

        // 세로
        if(imageHeight > canvasSize.height) {
            image.scaleToHeight(canvasSize.height - gap, false); // scaleX,Y가 바뀜.
        }
        
        imageWidth = image.width * image.scaleX;
        imageHeight = image.height * image.scaleY;
        
        image.left += (canvasSize.width - imageWidth) / 2 + delta;
        image.top += (canvasSize.height - imageHeight) / 2  + delta;

        _log('fitImageSizeInCanvas3 image =>', image.width, image.height, image.scaleX, image.scaleY, image.left, image.top);
    }

    // static fitImageSizeInCanvas(canvasSize: any, image: any, gap = 30, delta: number = 0) {
    //     _log('fitImageSizeInCanvas1 image =>', image.width, image.height, image.scaleX, image.scaleY);
    //     let imageWidth: number = image.width * image.scaleX;
    //     let imageHeight: number = image.height * image.scaleY;

    //     // 가로
    //     if(imageWidth > canvasSize.width) {
    //         image.scaleToWidth(canvasSize.width - gap, false); // scaleX,Y가 바뀜.
    //     }
    //     _log('fitImageSizeInCanvas2 image =>', image.width, image.height, image.scaleX, image.scaleY);
        
    //     imageWidth = image.width * image.scaleX;
    //     imageHeight = image.height * image.scaleY;

    //     // 세로
    //     if(imageHeight > canvasSize.height) {
    //         image.scaleToHeight(canvasSize.height - gap, false); // scaleX,Y가 바뀜.
    //     }
    //     _log('fitImageSizeInCanvas3 image =>', image.width, image.height, image.scaleX, image.scaleY);

    //     imageWidth = image.width * image.scaleX;
    //     imageHeight = image.height * image.scaleY;

    //     image.left += (canvasSize.width - imageWidth) / 2 + delta;
    //     image.top += (canvasSize.height - imageHeight) / 2  + delta;
    // }

    static setBackgroundColor(canvas: any, color?: string, refresh: boolean = true) {
        if (!color) { 
            color = 'rgba(255,255,255,0)';
        };
        canvas.backgroundColor = color;
        
        if (refresh) {
            canvas.renderAll();
        }
    }
}