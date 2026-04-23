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

    // Invoice details
  title:        string;
  notes?:       string;   // terms, thank you note, etc.
  logoUrl?:     string;   // optional: IPFS URL of logo image

  // Line items (for standard / recurring)
  items?:       LineItem[];
 
  // Milestones (for milestone invoices)
  milestones?:  MilestoneMetadata[];
 