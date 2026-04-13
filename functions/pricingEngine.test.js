const test = require('node:test');
const assert = require('node:assert/strict');
const { computePricingQuote, DEFAULT_PRICING_CONFIG, sanitizePricingSnapshot } = require('./pricingEngine');

test('computes normal quote near baseline for 10 minutes', () => {
  const quote = computePricingQuote({
    minutes: 10,
    subject: 'english',
    signalContext: {
      now: new Date('2026-04-13T10:00:00Z'),
      demandLevel: 'normal',
      availabilityLevel: 'normal',
      timeOfDayBucket: 'morning',
      seasonBucket: 'normal',
    },
    config: DEFAULT_PRICING_CONFIG,
  });

  assert.equal(quote.pricingBand, 'normal');
  assert.ok(quote.totalAmount >= 28 && quote.totalAmount <= 33);
  assert.equal(quote.durationMinutes, 10);
});

test('computes high quote when demand is high and availability low', () => {
  const quote = computePricingQuote({
    minutes: 30,
    subject: 'physics',
    signalContext: {
      now: new Date('2026-05-13T17:30:00Z'),
      demandLevel: 'high',
      availabilityLevel: 'low',
      timeOfDayBucket: 'peak',
      seasonBucket: 'examSeason',
    },
    config: DEFAULT_PRICING_CONFIG,
  });

  assert.equal(quote.pricingBand, 'high');
  assert.ok(quote.combinedMultiplier <= DEFAULT_PRICING_CONFIG.multiplierCaps.max);
  assert.ok(quote.totalAmount > 70);
});

test('sanitizes legacy snapshot safely', () => {
  const sanitized = sanitizePricingSnapshot({
    ratePerMinute: 1.8,
    durationMinutes: 20,
    totalAmount: 48,
  });

  assert.equal(sanitized.durationMinutes, 20);
  assert.equal(sanitized.totalAmount, 48);
  assert.equal(sanitized.pricingBand, 'normal');
});
