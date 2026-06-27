import { api } from "./client";
import type { Customer, Site } from "./customers";

export interface Order {
  id: number;
  os_number: string | null;
  customer_id: number;
  customer_name: string;
  site_id: number | null;
  site_name: string | null;
  title: string | null;
  proposal_number: string | null;
  status: string | null;
  opening_date: string | null;
  closing_date: string | null;
  created_at: string;
}

export interface Technician {
  id: number;
  name: string;
}

export interface OrdersPayload {
  orders: Order[];
  customers: Customer[];
  sites: Site[];
  technicians: Technician[];
  technicianIdsByOrder: Record<string, number[]>;
}

export const ORDER_STATUSES = [
  "draft",
  "valid",
  "in_progress",
  "waiting_review",
  "approved",
  "issued",
  "closed",
  "cancelled"
] as const;

export interface OrderInput {
  customerId: number | "";
  siteId: number | "";
  title: string;
  proposalNumber: string;
  description: string;
  status: string;
  openingDate: string;
  technicianIds: number[];
}

export function listOrders() {
  return api<OrdersPayload>("/orders");
}

export function createOrder(input: OrderInput) {
  return api<Order>("/orders", { method: "POST", body: JSON.stringify(input) });
}

export function updateOrder(id: number, input: OrderInput) {
  return api<Order>(`/orders/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteOrder(id: number) {
  return api<void>(`/orders/${id}`, { method: "DELETE" });
}
