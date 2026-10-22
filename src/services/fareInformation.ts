import type {MapRoute} from '../data/roadRoutes';

// Verified/estimated are reserved classifications, not supported provider claims.
export type FareClassification = 'verified' | 'estimated' | 'demo' | 'unavailable';
export type FareInformation = {classification: FareClassification; amount?: number; currency?: string};
export const fareDisclosure = 'Demo fares are hand-authored samples, not verified prices or booking/payment quotes. Actual fares are unavailable.';
export const validFareAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER / 100;
const cents = (amount: number) => Math.round(amount * 100);

export function fareForRoute(route: MapRoute): FareInformation {
  if ('kind' in route || !validFareAmount(route.fare)) return {classification: 'unavailable'};
  return {classification: 'demo', amount: route.fare, currency: 'PHP'};
}
export function formatPeso(value: unknown): string | null {
  if (!validFareAmount(value)) return null;
  const amount = cents(value) / 100;
  return `₱${amount.toLocaleString('en-US', {minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2})}`;
}
function comparableDemo(value: FareInformation) {
  return value.classification === 'demo' && value.currency === 'PHP' && validFareAmount(value.amount);
}
export function fareLabel(fare: FareInformation): string {
  return comparableDemo(fare) ? `Demo fare ${formatPeso(fare.amount)}` : 'Fare unavailable';
}
export function demoFareDifference(fare: FareInformation, alternatives: readonly FareInformation[]): string | null {
  // Fail closed for mixed reliability/currency: never rank an official fare
  // against a sample, nor imply support for a future provider's assumptions.
  if (!comparableDemo(fare) || alternatives.some(item => item.classification !== 'unavailable' && !comparableDemo(item))) return null;
  const comparable = alternatives.filter(comparableDemo);
  if (comparable.length < 2) return null;
  const difference = cents(fare.amount!) - Math.min(...comparable.map(item => cents(item.amount!)));
  if (difference < 0) return null;
  return difference === 0
    ? comparable.filter(item => cents(item.amount!) === cents(fare.amount!)).length > 1 ? 'Equal lowest demo fare' : 'Lowest demo fare'
    : `${formatPeso(difference / 100)} more than lowest demo fare`;
}
