const safeHttpsUrl = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch (_error) {
    return null;
  }
};

export const getDonationProviders = () =>
  [
    {
      id: 'buymeacoffee',
      name: 'Buy Me a Coffee',
      url: safeHttpsUrl(process.env.DONATION_BUYMEACOFFEE_URL)
    },
    {
      id: 'paypal',
      name: 'PayPal',
      url: safeHttpsUrl(process.env.DONATION_PAYPAL_URL)
    }
  ].filter((provider) => provider.url);

export const getDonationCurrency = () => {
  const currency = String(process.env.DONATION_CURRENCY || 'USD')
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : 'USD';
};
