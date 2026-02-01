export class StaticCommonHelper {
   static generateShortId(): string {
        return 'id_' +
            Math.random().toString(36).slice(2, 10) +
            Math.random().toString(36).slice(2, 6);
        }
    }
