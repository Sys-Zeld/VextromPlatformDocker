import { api } from "./client";

export interface Customer {
  id: number;
  name: string;
  customer_type: string | null;
  area: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: number;
  customer_id: number;
  customer_name: string;
  site_name: string;
  site_code: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
}

export interface CustomersPayload {
  customers: Customer[];
  sites: Site[];
}

export interface CustomerInput {
  name: string;
  customerType: string;
  area: string;
  notes: string;
}

export interface SiteInput {
  customerId: number;
  siteName: string;
  siteCode: string;
  location: string;
  latitude: string;
  longitude: string;
  notes: string;
}

export const CUSTOMER_TYPES = ["bank", "datacenter", "industry", "hospital", "others"] as const;

export function listCustomers() {
  return api<CustomersPayload>("/customers");
}

export function createCustomer(input: CustomerInput) {
  return api<Customer>("/customers", { method: "POST", body: JSON.stringify(input) });
}

export function updateCustomer(id: number, input: CustomerInput) {
  return api<Customer>(`/customers/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteCustomer(id: number) {
  return api<void>(`/customers/${id}`, { method: "DELETE" });
}

export function createSite(input: SiteInput) {
  return api<Site>("/sites", { method: "POST", body: JSON.stringify(input) });
}

export function updateSite(id: number, input: Omit<SiteInput, "customerId">) {
  return api<Site>(`/sites/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteSite(id: number) {
  return api<void>(`/sites/${id}`, { method: "DELETE" });
}
