export enum fabricObjectType {
    itext = 'i-text',
    textbox = 'textbox',
    image = 'image',

    photo = 'photo',        // image 확장타입 extType = 'photo', fileSize, thumbImageUrl
    sticker = 'sticker',    // photo 확장타입 extType = 'sticker'

    circle = 'circle',
    triangle = 'triangle',

    //////////////////////////////////////
    // template

    // 입력
    textInputBox = 'textInputBox',      //  title, content => title은 아직, content로 고정
    imageInputBox = 'imageInputBox',    //  photo 
    drawingInputBox = 'drawingInputBox',
    stickerGroupInputBox = 'stickerGroupInputBox',

    checkbox = 'checkbox',              //  checkItem { text: done: }

    // 표시
    currDateTimeText = 'currDateTimeText',   // object 가 생성된 시점에서 현재 날짜 / 시간 
 //   currCalText = 'currCalText'

}

/*
    medai : image, imageInputBox
*/