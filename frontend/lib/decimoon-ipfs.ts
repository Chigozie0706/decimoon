// Decimoon — IPFS Metadata Schema + Pinata Upload Utility


export interface LineItem {
  name:        string;   // e.g. "Frontend Development"
  description?: string;  // optional detail
  quantity:    number;   // e.g. 1, 2, 0.5
  unitPrice:   string;   // in human-readable token units e.g. "500"
  total:       string;   // quantity * unitPrice e.g. "500"
}

export interface MilestoneMetadata {
  index:       number;   
  description: string;    
}

export interface InvoiceMetadata {
  // Parties
  sellerName:   string;
  sellerEmail?: string;
  clientName:   string;
  clientEmail?: string;
