export const toPaise = (value) => Math.round(Number(value) * 100);
export const fromPaise = (value) => (value / 100).toFixed(2);

const currencyMap = {
  INR: { locale: 'en-IN', currency: 'INR' },
  USD: { locale: 'en-US', currency: 'USD' },
  EUR: { locale: 'de-DE', currency: 'EUR' },
  GBP: { locale: 'en-GB', currency: 'GBP' }
};

export const formatMoney = (value, currencyCode = 'INR') => {
  const config = currencyMap[currencyCode] || currencyMap.INR;
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    maximumFractionDigits: 0
  }).format((value || 0) / 100);
};

export const formatMoneyPrecise = (value, currencyCode = 'INR') => {
  const config = currencyMap[currencyCode] || currencyMap.INR;
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format((value || 0) / 100);
};

export const getCurrencySymbol = (currencyCode = 'INR') => {
  switch (currencyCode) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'INR':
    default: return '₹';
  }
};
