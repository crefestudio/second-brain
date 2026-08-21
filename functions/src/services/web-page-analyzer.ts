import * as cheerio from "cheerio";

import {
    BookEntity,
    ProductEntity,
    WebPageEntity
} from "./assistant-entity";

type WebAnalysisEntity = BookEntity | ProductEntity | WebPageEntity;

interface CommonWebData {
    siteName: string;
    canonicalUrl: string;
    title: string;
    description: string;
    imageUrl: string;
}

export class WebPageAnalyzer {
    async analyze(url: string): Promise<WebAnalysisEntity | null> {
        console.log("[WEB ANALYSIS] start", { url });

        try {
            const urlResult = this.analyzeUrl(url);

            console.log("[WEB ANALYSIS] URL analysis", {
                type: urlResult.type,
                url: urlResult.url
            });

            const fetchedResult = await this.analyzeWebPageWithFetch(url);

            if (fetchedResult) {
                const result = this.mergeEntities(urlResult, fetchedResult);

                console.log("[WEB ANALYSIS] fetch success", {
                    type: result.type,
                    title: result.title
                });

                return result;
            }

            console.log("[WEB ANALYSIS] fetch failed, use URL analysis", { url });

            return urlResult;
        } catch (err) {
            console.error("[WEB ANALYSIS] ERROR", err);
            return null;
        }
    }

    private analyzeUrl(url: string): WebAnalysisEntity {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        const pathname = parsed.pathname;
        const segments = pathname.split("/").filter(Boolean);
        const searchParams = parsed.searchParams;
        const analyzedAt = new Date().toISOString();

        if (hostname === "brand.naver.com" && segments[1] === "products" && segments[2]) {
            return {
                type: "product",
                url,
                metadata: {
                    platform: "naver",
                    storeName: segments[0],
                    productId: segments[2]
                },
                analysis: {
                    status: "partial",
                    analyzedAt
                }
            };
        }

        if (hostname === "smartstore.naver.com" && segments[1] === "products" && segments[2]) {
            return {
                type: "product",
                url,
                metadata: {
                    platform: "naver",
                    storeName: segments[0],
                    productId: segments[2]
                },
                analysis: {
                    status: "partial",
                    analyzedAt
                }
            };
        }

        if ((hostname === "www.coupang.com" || hostname === "coupang.com") &&
            segments[0] === "vp" && segments[1] === "products" && segments[2]) {
            return {
                type: "product",
                url,
                metadata: {
                    platform: "coupang",
                    productId: segments[2],
                    itemId: searchParams.get("itemId") || "",
                    vendorItemId: searchParams.get("vendorItemId") || ""
                },
                analysis: {
                    status: "partial",
                    analyzedAt
                }
            };
        }

        if (hostname === "product.kyobobook.co.kr") {
            const match = pathname.match(/^\/detail\/(S\d+)/i);

            if (match) {
                return {
                    type: "book",
                    url,
                    metadata: {
                        platform: "kyobobook",
                        productId: match[1]
                    },
                    analysis: {
                        status: "partial",
                        analyzedAt
                    }
                };
            }
        }

        if ((hostname === "ssg.com" || hostname === "www.ssg.com") &&
            pathname === "/item/itemView.ssg") {
            const itemId = searchParams.get("itemId");

            if (itemId) {
                return {
                    type: "product",
                    url,
                    metadata: {
                        platform: "ssg",
                        productId: itemId,
                        siteNo: searchParams.get("siteNo") || "",
                        salestrNo: searchParams.get("salestrNo") || ""
                    },
                    analysis: {
                        status: "partial",
                        analyzedAt
                    }
                };
            }
        }

        return {
            type: "webpage",
            url,
            analysis: {
                status: "partial",
                analyzedAt
            }
        };
    }

    private async analyzeWebPageWithFetch(url: string): Promise<WebAnalysisEntity | null> {
        console.log("[WEB] analyze start", { url });

        try {
            const fetched = await this.fetchWebPage(url);

            if (!fetched) {
                return null;
            }

            const { $, finalUrl, contentType } = fetched;
            const jsonLd = this.extractJsonLd($);
            const common = this.extractCommonWebData($, jsonLd, finalUrl);

            const book = this.analyzeBook($, jsonLd, common, url, contentType);

            if (book) {
                return book;
            }

            const product = this.analyzeProduct($, jsonLd, common, url, contentType);

            if (product) {
                return product;
            }

            return this.analyzeGenericWebPage(common, url, contentType);
        } catch (err) {
            console.error("[WEB] analyze error", { url, err });
            return null;
        }
    }

    private mergeEntities(urlResult: WebAnalysisEntity, fetchedResult: WebAnalysisEntity): WebAnalysisEntity {
        if (urlResult.type !== fetchedResult.type) {
            return fetchedResult;
        }

        return {
            ...urlResult,
            ...fetchedResult,
            url: fetchedResult.url || urlResult.url,
            metadata: {
                ...(urlResult.metadata || {}),
                ...(fetchedResult.metadata || {})
            }
        } as WebAnalysisEntity;
    }

    private async fetchWebPage(url: string): Promise<{
        $: cheerio.CheerioAPI;
        finalUrl: string;
        contentType: string;
    } | null> {
        console.log("[WEB FETCH] start", { url });

        try {
            const response = await fetch(url, {
                method: "GET",
                redirect: "follow",
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Cache-Control": "no-cache",
                    "Pragma": "no-cache",
                    "Upgrade-Insecure-Requests": "1",
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Sec-Fetch-User": "?1"
                }
            });

            const finalUrl = response.url || url;
            const contentType = response.headers.get("content-type") || "";
            const contentLength = response.headers.get("content-length") || "";

            console.log("[WEB FETCH] response", {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok,
                redirected: response.redirected,
                finalUrl,
                contentType,
                contentLength
            });

            const html = await response.text();

            console.log("[WEB FETCH] body", {
                length: html.length,
                preview: html.substring(0, 500).replace(/\s+/g, " ").trim()
            });

            if (!response.ok) {
                console.error("[WEB FETCH] HTTP error", {
                    status: response.status,
                    statusText: response.statusText,
                    contentType,
                    contentLength,
                    finalUrl,
                    bodyLength: html.length,
                    bodyPreview: html.substring(0, 1000).replace(/\s+/g, " ").trim()
                });

                return null;
            }

            if (!html.trim()) {
                console.error("[WEB FETCH] empty body", {
                    status: response.status,
                    contentType,
                    finalUrl
                });

                return null;
            }

            const trimmedHtml = html.trim().toLowerCase();

            const looksLikeHtml =
                trimmedHtml.startsWith("<!doctype html") ||
                trimmedHtml.startsWith("<html") ||
                trimmedHtml.includes("<html") ||
                trimmedHtml.includes("<head") ||
                trimmedHtml.includes("<body") ||
                trimmedHtml.includes("<meta") ||
                trimmedHtml.includes("<title");

            if (!looksLikeHtml) {
                console.error("[WEB FETCH] response is not HTML", {
                    status: response.status,
                    contentType,
                    finalUrl,
                    bodyLength: html.length,
                    bodyPreview: html.substring(0, 1000).replace(/\s+/g, " ").trim()
                });

                return null;
            }

            if (!contentType) {
                console.warn("[WEB FETCH] missing content-type, use HTML body", {
                    status: response.status,
                    finalUrl,
                    bodyLength: html.length
                });
            } else if (!contentType.includes("text/html") &&
                !contentType.includes("application/xhtml+xml") &&
                !contentType.includes("application/xml")) {
                console.warn("[WEB FETCH] unexpected content-type, use HTML body", {
                    contentType,
                    finalUrl,
                    bodyLength: html.length
                });
            }

            const $ = cheerio.load(html);

            console.log("[WEB FETCH] HTML parsed", {
                finalUrl,
                title: $("title").first().text().replace(/\s+/g, " ").trim(),
                htmlLength: html.length,
                scriptCount: $("script").length,
                metaCount: $("meta").length
            });

            return {
                $,
                finalUrl,
                contentType
            };
        } catch (err) {
            console.error("[WEB FETCH] exception", {
                url,
                error: err instanceof Error
                    ? {
                        name: err.name,
                        message: err.message,
                        stack: err.stack
                    }
                    : err
            });

            return null;
        }
    }

    private extractJsonLd($: cheerio.CheerioAPI): any[] {
        const jsonLd: any[] = [];

        $("script[type='application/ld+json']").each((_, element) => {
            const text = $(element).text().trim();

            if (!text) {
                return;
            }

            try {
                const data = JSON.parse(text);

                if (Array.isArray(data)) {
                    jsonLd.push(...data);
                } else if (Array.isArray(data?.["@graph"])) {
                    jsonLd.push(...data["@graph"]);
                } else if (data) {
                    jsonLd.push(data);
                }
            } catch {
                // 잘못된 JSON-LD는 무시
            }
        });

        console.log("[WEB] JSON-LD", { count: jsonLd.length });

        return jsonLd;
    }

    private extractCommonWebData($: cheerio.CheerioAPI, jsonLd: any[], finalUrl: string): CommonWebData {
        const getMeta = (...names: string[]): string | undefined => {
            for (const name of names) {
                const propertyValue = $(`meta[property="${name}"]`).attr("content");
                const nameValue = $(`meta[name="${name}"]`).attr("content");
                const value = propertyValue ?? nameValue;

                if (value?.trim()) {
                    return value.trim();
                }
            }

            return undefined;
        };

        const ogTitle = getMeta("og:title", "twitter:title");
        const ogDescription = getMeta("og:description", "twitter:description", "description");
        const canonicalUrl = $("link[rel='canonical']").attr("href")?.trim() || getMeta("og:url") || finalUrl;

        let canonical = finalUrl;

        try {
            canonical = new URL(canonicalUrl, finalUrl).href;
        } catch {
            canonical = finalUrl;
        }

        return {
            siteName: this.extractSiteName($, jsonLd, finalUrl) || "",
            canonicalUrl: canonical,
            title: ogTitle || $("title").first().text().replace(/\s+/g, " ").trim(),
            description: ogDescription || "",
            imageUrl: getMeta("og:image", "twitter:image") || ""
        };
    }

    private analyzeBook(
        $: cheerio.CheerioAPI,
        jsonLd: any[],
        common: CommonWebData,
        url: string,
        contentType: string
    ): BookEntity | null {
        const book = this.extractBookData($, jsonLd);

        if (!book) {
            return null;
        }

        return {
            type: "book",
            url,
            title: book.name || common.title || "",
            authors: Array.isArray(book.authors)
                ? book.authors
                : typeof book.authors === "string" && book.authors
                    ? [book.authors]
                    : [],
            translators: Array.isArray(book.translators)
                ? book.translators
                : typeof book.translators === "string" && book.translators
                    ? [book.translators]
                    : [],
            publisher: book.publisher || "",
            publishedAt: book.publishedAt || "",
            isbn: book.isbn || "",
            pages: book.pages || "",
            category: book.category || "",
            price: book.price != null ? String(book.price) : "",
            currency: book.currency || "",
            imageUrl: book.imageUrl || common.imageUrl || "",
            description: book.description || common.description || "",
            metadata: {
                siteName: common.siteName,
                canonicalUrl: common.canonicalUrl,
                contentType,
                availability: book.availability || ""
            },
            analysis: {
                status: "success",
                analyzedAt: new Date().toISOString()
            }
        };
    }

    private analyzeProduct(
        $: cheerio.CheerioAPI,
        jsonLd: any[],
        common: CommonWebData,
        url: string,
        contentType: string
    ): ProductEntity | null {
        const product = this.extractProductData($, jsonLd);

        if (!product) {
            return null;
        }

        return {
            type: "product",
            url,
            title: product.name || common.title,
            brand: product.brand || "",
            price: product.price || "",
            currency: product.currency || "",
            imageUrl: product.imageUrl || common.imageUrl,
            description: product.description || common.description,
            metadata: {
                siteName: common.siteName,
                canonicalUrl: common.canonicalUrl,
                contentType,
                sku: product.sku || "",
                productId: product.productId || "",
                availability: product.availability || ""
            },
            analysis: {
                status: "success",
                analyzedAt: new Date().toISOString()
            }
        };
    }

    private analyzeGenericWebPage(common: CommonWebData, url: string, contentType: string): WebPageEntity {
        return {
            type: "webpage",
            url,
            canonicalUrl: common.canonicalUrl,
            siteName: common.siteName,
            title: common.title,
            description: common.description,
            imageUrl: common.imageUrl,
            metadata: {
                contentType
            },
            analysis: {
                status: "success",
                analyzedAt: new Date().toISOString()
            }
        };
    }

    private extractBookData($: cheerio.CheerioAPI, jsonLd: any[]): Record<string, any> | null {
        const isType = (item: any, target: string): boolean => {
            const type = item?.["@type"];

            if (Array.isArray(type)) {
                return type.some(value => String(value).toLowerCase() === target);
            }

            return String(type || "").toLowerCase() === target;
        };

        const getName = (value: any): string => {
            if (typeof value === "string") {
                return value.trim();
            }

            return typeof value?.name === "string" ? value.name.trim() : "";
        };

        const getNames = (value: any): string[] => {
            const values = Array.isArray(value) ? value : value ? [value] : [];

            return values.map(getName).filter(Boolean);
        };

        const getImage = (value: any): string => {
            if (Array.isArray(value)) {
                return getImage(value[0]);
            }

            if (typeof value === "string") {
                return value.trim();
            }

            return typeof value?.url === "string" ? value.url.trim() : "";
        };

        const getOffer = (value: any): any => {
            return Array.isArray(value) ? value[0] : value;
        };

        const book = jsonLd.find(item => isType(item, "book"));

        if (book) {
            const offer = getOffer(book.offers);

            return {
                name: getName(book.name),
                description: typeof book.description === "string" ? book.description.trim() : "",
                imageUrl: getImage(book.image),
                authors: getNames(book.author),
                translators: getNames(book.translator),
                publisher: getName(book.publisher),
                publishedAt: book.datePublished || book.releaseDate || "",
                isbn: book.isbn || book.isbn13 || book.isbn10 || "",
                pages: book.numberOfPages || "",
                category: getName(book.genre),
                price: offer?.price || "",
                currency: offer?.priceCurrency || "",
                availability: offer?.availability || ""
            };
        }

        const product = jsonLd.find(item => isType(item, "product"));

        if (product) {
            const offer = getOffer(product.offers);
            const isbn = product.isbn || product.isbn13 || product.isbn10 || "";
            const authors = getNames(product.author);
            const publisher = getName(product.publisher);
            const pages = product.numberOfPages || "";

            const bookSignalCount = [
                !!isbn,
                authors.length > 0,
                !!publisher,
                !!pages
            ].filter(Boolean).length;

            if (isbn || bookSignalCount >= 2) {
                return {
                    name: getName(product.name),
                    description: typeof product.description === "string"
                        ? product.description.trim()
                        : "",
                    imageUrl: getImage(product.image),
                    authors,
                    translators: getNames(product.translator),
                    publisher,
                    publishedAt: product.datePublished || product.releaseDate || "",
                    isbn,
                    pages,
                    category: getName(product.genre),
                    price: offer?.price || "",
                    currency: offer?.priceCurrency || "",
                    availability: offer?.availability || ""
                };
            }
        }

        return this.extractBookDataFromHtml($);
    }

    private extractBookDataFromHtml($: cheerio.CheerioAPI): Record<string, any> | null {
        const getMeta = (...names: string[]): string => {
            for (const name of names) {
                const value = $(`meta[property="${name}"], meta[name="${name}"]`).attr("content")?.trim();

                if (value) {
                    return value;
                }
            }

            return "";
        };

        const getText = (...selectors: string[]): string => {
            for (const selector of selectors) {
                const value = $(selector).first().text().replace(/\s+/g, " ").trim();

                if (value) {
                    return value;
                }
            }

            return "";
        };

        const name = getMeta("book:title") || getMeta("og:title") || getText("h1");
        const author = getMeta("book:author") || getMeta("author");
        const publisher = getMeta("book:publisher");
        const publishedAt = getMeta("book:release_date", "datePublished");
        const isbn = getMeta("book:isbn", "isbn", "isbn13", "isbn10");
        const pages = getMeta("book:numberOfPages", "numberOfPages");
        const description = getMeta("og:description", "description");
        const imageUrl = getMeta("og:image", "twitter:image");
        const price = getMeta("product:price:amount");
        const currency = getMeta("product:price:currency");

        const hasBookSignals = !!isbn || !!author || !!publisher || !!pages;

        if (!hasBookSignals) {
            return null;
        }

        return {
            name,
            description,
            imageUrl,
            authors: author ? [author] : [],
            translators: [],
            publisher,
            publishedAt,
            isbn,
            pages,
            category: "",
            price,
            currency,
            availability: ""
        };
    }

    private extractSiteName($: cheerio.CheerioAPI, jsonLd: any[], finalUrl: string): string {
        const getMeta = (name: string): string => {
            return $(`meta[property="${name}"], meta[name="${name}"]`).attr("content")?.trim() || "";
        };

        const metaSiteName = getMeta("og:site_name");

        if (metaSiteName) {
            return metaSiteName;
        }

        for (const item of jsonLd) {
            const type = item?.["@type"];

            if (type === "WebSite" && item.name) {
                return String(item.name).trim();
            }

            if (type === "Organization" && item.name) {
                return String(item.name).trim();
            }
        }

        const title = $("title").first().text().replace(/\s+/g, " ").trim();

        if (title) {
            const parts = title.split(/\s+[|｜-]\s+/);

            if (parts.length > 1) {
                return parts[parts.length - 1].trim();
            }
        }

        try {
            return new URL(finalUrl).hostname.replace(/^www\./, "");
        } catch {
            return "";
        }
    }

    private extractProductData($: cheerio.CheerioAPI, jsonLd: any[]): Record<string, any> | null {
        const products = jsonLd.filter(item => {
            const type = item?.["@type"];

            if (Array.isArray(type)) {
                return type.some(value => String(value).toLowerCase() === "product");
            }

            return String(type || "").toLowerCase() === "product";
        });

        const product = products[0];

        if (product) {
            const image = Array.isArray(product.image) ? product.image[0] : product.image;
            const brand = typeof product.brand === "string" ? product.brand : product.brand?.name;
            const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;

            return {
                name: product.name || "",
                description: product.description || "",
                imageUrl: image || "",
                brand: brand || "",
                sku: product.sku || "",
                productId: product.productID || product.productId || "",
                price: offers?.price || "",
                currency: offers?.priceCurrency || "",
                availability: offers?.availability || ""
            };
        }

        const name = $("meta[property='product:name'], meta[name='product:name']").attr("content")?.trim() || "";
        const price = $("meta[property='product:price:amount'], meta[name='product:price:amount']").attr("content")?.trim() || "";
        const currency = $("meta[property='product:price:currency'], meta[name='product:price:currency']").attr("content")?.trim() || "";
        const availability = $("meta[property='product:availability'], meta[name='product:availability']").attr("content")?.trim() || "";

        if (name || price || currency || availability) {
            return {
                name,
                description: "",
                imageUrl: "",
                brand: "",
                sku: "",
                productId: "",
                price,
                currency,
                availability
            };
        }

        return null;
    }
}