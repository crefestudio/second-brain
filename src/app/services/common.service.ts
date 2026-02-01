export class NACommonService {
    static async encrypt(text: string): Promise<string> {
        const SECRET_KEY = 'notionable-encrypt-key'; // 서버와 동일해야 함

        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(SECRET_KEY),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            {
            name: 'PBKDF2',
            salt: enc.encode('notionable'),
            iterations: 100000,
            hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            enc.encode(text)
        );

        // iv + encrypted → base64
        const combined = new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
        return btoa(String.fromCharCode(...combined));
    }

    static async decrypt(token: string): Promise<string> {
        const SECRET_KEY = 'notionable-encrypt-key'; // encrypt 때와 동일
        const enc = new TextEncoder();
        const dec = new TextDecoder();

        // 1. base64 → Uint8Array
        const data = Uint8Array.from(atob(token), c => c.charCodeAt(0));

        // 2. iv(12바이트) + 암호문 분리
        const iv = data.slice(0, 12);
        const encrypted = data.slice(12);

        // 3. 키 생성
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(SECRET_KEY),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const key = await crypto.subtle.deriveKey(
            {
            name: 'PBKDF2',
            salt: enc.encode('notionable'),
            iterations: 100000,
            hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        // 4. 복호화
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );

        return dec.decode(decrypted);
    }
}
