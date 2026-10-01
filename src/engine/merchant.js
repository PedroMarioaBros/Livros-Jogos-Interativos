function purchaseFlag(reference, item) {
  return `merchant_${Number(reference)}_bought_${item}`;
}

function hasFlag(character, flag) {
  return Boolean(character?.flags?.includes(flag));
}

export function merchantItemSold(
  reference,
  item,
  participants = []
) {
  const flag = purchaseFlag(reference, item);
  return participants.some(character => hasFlag(character, flag));
}

export function purchaseMerchantItem({
  reference,
  item,
  price,
  buyer,
  participants = [],
  sharedUniqueStock = false
}) {
  if (!buyer || !item) {
    return { ok: false, reason: "invalid-purchase" };
  }

  const normalizedPrice = Math.max(0, Number(price || 0));
  const stockParticipants = sharedUniqueStock
    ? participants
    : [buyer];

  if (
    merchantItemSold(
      reference,
      item,
      stockParticipants.length ? stockParticipants : [buyer]
    )
  ) {
    return { ok: false, reason: "sold" };
  }

  if (buyer.gold < normalizedPrice) {
    return { ok: false, reason: "insufficient-gold" };
  }

  if (buyer.items.includes(item)) {
    return { ok: false, reason: "already-owned" };
  }

  buyer.gold -= normalizedPrice;
  buyer.items.push(item);
  buyer.flags ||= [];
  buyer.flags.push(purchaseFlag(reference, item));

  return {
    ok: true,
    item,
    price: normalizedPrice,
    goldAfter: buyer.gold
  };
}
