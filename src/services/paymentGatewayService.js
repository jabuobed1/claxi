export async function chargeCard({ amount, card }) {
  if (!card) {
    return {
      ok: false,
      status: 'failed',
      reason: 'no_card_selected',
      transactionId: null,
    };
  }

  const marker = `${card.nickname || ''} ${card.paystackAuthorizationCode || ''}`.toLowerCase();
  const shouldDecline = marker.includes('decline') || marker.includes('fail');

  if (shouldDecline) {
    return {
      ok: false,
      status: 'failed',
      reason: 'gateway_declined',
      transactionId: null,
    };
  }

  return {
    ok: true,
    status: 'paid',
    provider: 'paystack',
    amount,
    transactionId: `paystack_txn_${crypto.randomUUID().slice(0, 12)}`,
  };
}

export async function fundWalletWithCard({ amount, card }) {
  return chargeCard({ amount, card });
}
