const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parseConsent, channelConsent, resolveChannelConsent, legacyConsentPatch} = require('../lib/marketing-consent');

test('legacy migration copies both positive and negative choices, never unknown', () => {
  for (const value of [true, false]) {
    assert.deepEqual(legacyConsentPatch({marketingConsent:value}), {marketingEmailConsent:value,marketingSmsConsent:value,consentSchemaVersion:2});
  }
  assert.deepEqual(legacyConsentPatch({notificationConsent:'미응답'}), {});
  assert.deepEqual(legacyConsentPatch({notificationConsent:'차단'}), {});
  assert.deepEqual(legacyConsentPatch({consentSchemaVersion:2,marketingEmailConsent:false,marketingSmsConsent:true}), {});
});
test('email and sms remain independent, missing fields are unknown', () => {
  const record={marketingConsentSource:'imweb',consentSchemaVersion:2,marketingEmailConsent:false,marketingSmsConsent:true};
  assert.equal(resolveChannelConsent([record], 'Email'),false);
  assert.equal(resolveChannelConsent([record], 'Sms'),true);
  assert.equal(channelConsent({consentSchemaVersion:2,marketingConsent:true},'Sms'),undefined);
  assert.equal(parseConsent('N'),false); assert.equal(parseConsent('Y'),true);
  assert.equal(parseConsent(''),undefined); assert.equal(parseConsent(null),undefined);
});
test('neither sync nor local opt-in overrides a refusal in the other source', () => {
  const user={marketingConsentSource:'user',marketingEmailConsent:false,marketingSmsConsent:true,consentSchemaVersion:2};
  const remote={marketingConsentSource:'imweb',marketingEmailConsent:true,marketingSmsConsent:false,consentSchemaVersion:2};
  assert.equal(resolveChannelConsent([user,remote],'Email'),false);
  assert.equal(resolveChannelConsent([user,remote],'Sms'),false);
});
