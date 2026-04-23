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
 
    // Currency display
  tokenSymbol:  string; 
  tokenDecimals: number;  
 
  // Version for future schema changes
  version:      string;   // "1.0"
  createdAt:    string;   // ISO date string
}


const PINATA_API_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

/**
 * Upload invoice metadata to IPFS via Pinata.
 * Returns the CID to store on-chain in metadataCID.
 *
 * @param metadata  Invoice metadata object
 * @returns         IPFS CID string e.g. "QmXyz..."
 */


export async function uploadMetadataToPinata(
  metadata: InvoiceMetadata
): Promise<string> {
  const apiKey    = process.env.NEXT_PUBLIC_PINATA_API_KEY;
  const apiSecret = process.env.PINATA_API_SECRET;

    if (!apiKey || !apiSecret) {
    throw new Error("Pinata API keys not configured");
  }

    const body = {
    pinataContent: metadata,
    pinataMetadata: {
      name: `decimoon-invoice-${metadata.title}-${Date.now()}`,
    },
    pinataOptions: {
      cidVersion: 1,
    },
  };

  const response = await fetch(PINATA_API_URL, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      pinata_api_key:        apiKey,
      pinata_secret_api_key: apiSecret,
    },
    body: JSON.stringify(body),
  });
 
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pinata upload failed: ${error}`);
  }
 
  const data = await response.json();
  return data.IpfsHash as string;
}