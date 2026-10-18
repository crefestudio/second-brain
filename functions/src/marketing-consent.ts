export type MarketingChannel = 'Email' | 'Sms';
export type ConsentRecord = Record<string, unknown>;

export function parseConsent(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;
    const text = String(value).trim().toLowerCase();
    if (['y', 'yes', 'true', '1', '예'].includes(text)) return true;
    if (['n', 'no', 'false', '0', '아니오'].includes(text)) return false;
    return undefined;
}

export function channelConsent(data: ConsentRecord, channel: MarketingChannel): boolean | undefined {
    const value = data[`marketing${channel}Consent`];
    if (typeof value === 'boolean') return value;
    // Once migrated, a missing channel is unknown, not the other channel's value.
    if (data.consentSchemaVersion === 2) return undefined;
    return parseConsent(data.marketingConsent) ?? parseConsent(data.notificationConsent);
}

export function resolveChannelConsent(records: ConsentRecord[], channel: MarketingChannel): boolean | undefined {
    const values = records.filter(data => data.marketingConsentSource === 'user' || data.marketingConsentSource === 'imweb')
        .map(data => channelConsent(data, channel)).filter(value => value !== undefined);
    // A remote snapshot must never undo an app opt-out (or vice versa).
    return values.includes(false) ? false : values.includes(true) ? true : undefined;
}

export function legacyConsentPatch(data: ConsentRecord): ConsentRecord {
    if (data.consentSchemaVersion === 2) return {};
    const value = parseConsent(data.marketingConsent) ?? parseConsent(data.notificationConsent);
    if (value === undefined) return {};
    return {
        ...(typeof data.marketingEmailConsent !== 'boolean' ? { marketingEmailConsent: value } : {}),
        ...(typeof data.marketingSmsConsent !== 'boolean' ? { marketingSmsConsent: value } : {}),
        consentSchemaVersion: 2
    };
}
