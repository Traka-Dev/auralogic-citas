export interface Business {
  id: string;
  name: string;
  timezone: string;
  currency: string;
}
export interface Client {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  email: string;
  tags: string;
  source: string;
  archived: number;
  created_at: string;
}
export interface Staff {
  id: string;
  name: string;
  color: string;
  active: number;
}
export interface Service {
  id: string;
  name: string;
  duration: number;
  buffer: number;
  price_cents: number;
  active: number;
}
export type AppointmentStatus =
  'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export interface Appointment {
  id: string;
  client_id: string;
  service_id: string;
  staff_id: string;
  starts_at: string;
  ends_at: string;
  busy_until: string;
  price_cents: number;
  status: AppointmentStatus;
  notes: string;
  client_name: string;
  service_name: string;
  staff_name: string;
  color: string;
}
export interface Task {
  id: string;
  title: string;
  due_at: string;
  done: number;
  client_id: string;
  client_name: string;
  author_name: string;
}
export interface Conversation {
  id: string;
  client_id: string;
  client_name: string;
  jid: string;
  status: string;
  assigned_to: string | null;
  updated_at: string;
}
export interface Message {
  id: string;
  body: string;
  direction: 'in' | 'out';
  status: string;
  created_at: string;
}
