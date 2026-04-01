"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/onboarding");
  }, []);

  return null;
}
