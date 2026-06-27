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
}

export function listOrders() {
  return api<OrdersPayload>("/orders");
}

export function deleteOrder(id: number) {
  return api<void>(`/orders/${id}`, { method: "DELETE" });
}
