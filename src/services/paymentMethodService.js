import { updateUserProfile } from './userService';

function detectCardBrand(cardNumber = '') {
  const normalized = cardNumber.replace(/\s+/g, '');
  if (/^4/.test(normalized)) return 'Visa';
  if (/^5[1-5]/.test(normalized)) return 'Mastercard';
  if (/^3[47]/.test(normalized)) return 'American Express';
  return 'Card';
}

function isLuhnValid(input = '') {
  const digits = input.replace(/\D/g, '');
  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return digits.length >= 12 && sum % 10 === 0;
}

function sanitizeMethods(methods) {
  return methods.map((method) => ({
    id: method.id,
    nickname: method.nickname,
    brand: method.brand,
    last4: method.last4,
    paystackAuthorizationCode: method.paystackAuthorizationCode,
    isDefault: Boolean(method.isDefault),
    createdAt: method.createdAt || new Date().toISOString(),
  }));
}

export async function addPaymentMethod(user, payload) {
  const rawCardNumber = payload.cardNumber?.trim() || '';

  if (!isLuhnValid(rawCardNumber)) {
    throw new Error('Enter a valid card number.');
  }

  const nextMethod = {
    id: crypto.randomUUID(),
    nickname: payload.nickname?.trim() || 'My Card',
    brand: detectCardBrand(rawCardNumber),
    last4: rawCardNumber.replace(/\D/g, '').slice(-4),
    paystackAuthorizationCode: payload.paystackAuthorizationCode?.trim() || `paystack_auth_${crypto.randomUUID().slice(0, 8)}`,
    isDefault: (user?.paymentMethods || []).length === 0,
    createdAt: new Date().toISOString(),
  };

  const existing = sanitizeMethods(user?.paymentMethods || []);
  const paymentMethods = [...existing, nextMethod];

  return updateUserProfile(user.uid, { paymentMethods });
}

export async function setDefaultPaymentMethod(user, methodId) {
  const paymentMethods = sanitizeMethods((user?.paymentMethods || []).map((method) => ({
    ...method,
    isDefault: method.id === methodId,
  })));

  return updateUserProfile(user.uid, { paymentMethods });
}

export async function removePaymentMethod(user, methodId) {
  const existing = sanitizeMethods((user?.paymentMethods || []).filter((method) => method.id !== methodId));

  if (existing.length && !existing.some((method) => method.isDefault)) {
    existing[0].isDefault = true;
  }

  return updateUserProfile(user.uid, { paymentMethods: existing });
}
