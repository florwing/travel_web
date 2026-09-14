export type AppTab = 'schedule' | 'bookings' | 'expense' | 'planning' | 'photos';

export type ItineraryCategory = 'sight' | 'food' | 'transport' | 'hotel';

export interface Trip {
  title: string;
  startDate: string;
  endDate: string;
  destinations: string[];
  members: string[];
}

export interface ItineraryItem {
  id: string;
  date: string;
  time: string;
  title: string;
  location: string;
  category: ItineraryCategory;
  note: string;
  mapUrl: string;
}

export type WeatherKind = 'sunny' | 'cloudy' | 'rainy';

export interface WeatherDay {
  date: string;
  kind: WeatherKind;
  condition: string;
  high: number;
  low: number;
}

export interface FlightBooking {
  airline: string;
  flightNo: string;
  fromCode: string;
  fromCity: string;
  toCode: string;
  toCity: string;
  outboundAt: string;
  returnAt: string;
  gate: string;
}

export interface AccommodationBooking {
  name: string;
  checkIn: string;
  checkOut: string;
  address: string;
  totalHkd: number;
}

export interface CarRentalBooking {
  company: string;
  pickupAt: string;
  pickupLocation: string;
  returnAt: string;
  returnLocation: string;
}

export interface Voucher {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  dataUrl: string;
  storagePath?: string;
}

export interface TripPhoto {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  createdAt: string;
  dataUrl: string;
  storagePath?: string;
}

export type ExpenseCategory = 'food' | 'transport' | 'hotel' | 'shopping' | 'ticket';
export type Currency = 'HKD' | 'JPY' | 'USD';

export interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: Currency;
  rateToHkd: number;
  category: ExpenseCategory;
  payer: string;
  splitWith: string[];
}

export type ChecklistKind = 'todo' | 'packing' | 'shopping';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export type Checklists = Record<ChecklistKind, ChecklistItem[]>;

export interface TravelState {
  version: 1;
  trip: Trip;
  itinerary: ItineraryItem[];
  weather: WeatherDay[];
  flight: FlightBooking;
  accommodation: AccommodationBooking;
  carRental: CarRentalBooking;
  vouchers: Voucher[];
  photos: TripPhoto[];
  expenses: Expense[];
  exchangeRates: Record<Currency, number>;
  checklists: Checklists;
}
