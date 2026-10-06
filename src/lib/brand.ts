export const brand = {
  name: "VELORA",
  tagline: "A world beyond ordinary.",
  currency: "EUR",
  support: "support@example.invalid",
};
export const money = (cents: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: brand.currency,
  }).format(cents / 100);
