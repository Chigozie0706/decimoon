import { sdk } from "@farcaster/miniapp-sdk";

export function initFarcaster() {
  try {

    sdk.actions.ready();
    return true;
  } catch {
    return false;
  }
}