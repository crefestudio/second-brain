export type AssistantEntityType =
    | "text"
    | "image"

    | "youtube"
    | "product"
    | "book"
    | "map"
    | "webpage"
    | "contact";

export interface EntityAnalysis {
    status: "success" | "partial" | "failed";
    analyzedAt?: string;
    error?: string;
}

export interface BaseEntity {
    type: AssistantEntityType;
    analysis?: EntityAnalysis;
}

export interface TextEntity extends BaseEntity {
    type: "text";
}

export interface ImageEntity extends BaseEntity {
    type: "image";
    imageUrl?: string;
    ocrText?: string;
    objects?: string[];
    context?: string;
    hint?: string;
    fileName?: string;
    entityType?: AssistantEntityType
}

export interface YoutubeEntity extends BaseEntity {
    type: "youtube";
    url?: string;
    title?: string;
    channelName?: string;
    channelId?: string;
    description?: string;
    publishedAt?: string;
    categoryId?: string;
    tags?: string[];
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
    duration?: string;
    imageUrl?: string;
    ocrText?: string;
}

export interface ProductEntity extends BaseEntity {
    type: "product";
    url?: string;
    siteName?: string;
    storeName?: string;
    title?: string;
    brand?: string;
    price?: string;
    originalPrice?: string;
    currency?: string;
    imageUrl?: string;
    description?: string;
    category?: string;
    productId?: string;
    metadata?: Record<string, any>;
}

export interface BookEntity extends BaseEntity {
    type: "book";
    url?: string;
    siteName?: string;
    title?: string;
    authors?: string[];
    translators?: string[];
    publisher?: string;
    publishedAt?: string;
    isbn?: string;
    pages?: number | string;
    category?: string;
    price?: string;
    currency?: string;
    imageUrl?: string;
    description?: string;
    metadata?: Record<string, any>;
}

export interface MapEntity extends BaseEntity {
    type: "map";
    url?: string;
    title?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    placeId?: string;
    imageUrl?: string;
    description?: string;
    metadata?: Record<string, any>;
}

export interface WebPageEntity extends BaseEntity {
    type: "webpage";
    url?: string;
    canonicalUrl?: string;
    siteName?: string;
    title?: string;
    description?: string;
    author?: string;
    imageUrl?: string;
    publishedAt?: string;
    content?: string;
    metadata?: Record<string, any>;
}

export interface ContactEntity extends BaseEntity {
    type: "contact";
    name?: string;
    company?: string;
    department?: string;
    position?: string;
    phone?: string;
    mobile?: string;
    fax?: string;
    email?: string;
    address?: string;
    website?: string;
    imageUrl?: string;
    ocrText?: string;
    metadata?: Record<string, any>;
}

export type AssistantEntity =
    | TextEntity
    | ImageEntity
    | YoutubeEntity
    | ProductEntity
    | BookEntity
    | MapEntity
    | WebPageEntity
    | ContactEntity;