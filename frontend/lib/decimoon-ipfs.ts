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
  sellerName?:   string;
  sellerEmail?: string;
  clientName?:   string;
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
  const res = await fetch("/api/upload-metadata", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Pinata upload failed: ${error}`);
  }

  const data = await res.json();
  return data.cid as string;
}

/**
 * Fetch invoice metadata from IPFS via Pinata gateway.
 *
 * @param cid  IPFS CID stored on-chain
 * @returns    Parsed InvoiceMetadata object
 */


export async function fetchMetadataFromIPFS(
  cid: string
): Promise<InvoiceMetadata> {
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? "https://gateway.pinata.cloud";
  const url     = `${gateway}/ipfs/${cid}`;
 
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata for CID: ${cid}`);
  }
 
  return response.json() as Promise<InvoiceMetadata>;
}


export async function prepareAndUploadMetadata(
  params: Omit<InvoiceMetadata, "version" | "createdAt">
): Promise<string> {
  const metadata: InvoiceMetadata = {
    ...params,
    version:   "1.0",
    createdAt: new Date().toISOString(),
  };
 
  return uploadMetadataToPinata(metadata);
}


//  Total amount helper — computes on-chain `amount` from line items

import { parseUnits } from "viem";

/**
 * Compute the total amount to pass to createInvoice() on-chain.
 * Sums all line item totals and converts to token units.
 *
 * @param items     Line items from the form
 * @param decimals  Token decimals (18 for cUSD, 6 for USDC)
 * @returns         BigInt amount in token smallest unit
 */
export function computeOnChainAmount(
  items:    LineItem[],
  decimals: number
): bigint {
  const total = items.reduce((sum, item) => sum + parseFloat(item.total), 0);
  return parseUnits(total.toFixed(decimals > 6 ? 6 : decimals), decimals);
}


/**
 * Compute milestone amounts array to pass to createMilestoneInvoice().
 *
 * @param amounts   Human-readable amounts per milestone e.g. ["300", "200", "500"]
 * @param decimals  Token decimals
 * @returns         Array of BigInts in token smallest unit
 */

export function computeMilestoneAmounts(
  amounts:  string[],
  decimals: number
): bigint[] {
  return amounts.map((a) => parseUnits(a, decimals));
}
 



























