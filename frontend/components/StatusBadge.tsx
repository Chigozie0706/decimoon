import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | "default"
    | "success"
    | "warning"
    | "error"
    | "disputed"
    | "neutral"
    | "blue"
    | "purple"
    | "amber";
  className?: string;
}

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  const variants: Record<string, string> = {
    default: "bg-yellow-100 text-yellow-700 border border-yellow-200",
    success: "bg-green-100  text-green-700  border border-green-200",
    warning: "bg-orange-100 text-orange-700 border border-orange-200",
    error: "bg-red-100    text-red-700    border border-red-200",
    disputed: "bg-purple-100 text-purple-700 border border-purple-200",
    neutral: "bg-gray-100   text-gray-500   border border-gray-200",
    blue: "bg-blue-100   text-blue-700   border border-blue-200",
    purple: "bg-purple-100 text-purple-700 border border-purple-200",
    amber: "bg-amber-100  text-amber-700  border border-amber-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

//  Compound badges

export function StatusBadge({
  status,
}: {
  status:
    | "paid"
    | "unpaid"
    | "overdue"
    | "cancelled"
    | "Paid"
    | "Unpaid"
    | "Overdue"
    | "Disputed"
    | "Cancelled";
}) {
  const variants: Record<string, BadgeProps["variant"]> = {
    // lowercase (your convention)
    paid: "success",
    unpaid: "default",
    overdue: "error",
    cancelled: "neutral",
    // title-case (Figma convention)
    Paid: "success",
    Unpaid: "default",
    Overdue: "error",
    Disputed: "disputed",
    Cancelled: "neutral",
  };

  const labels: Record<string, string> = {
    paid: "Paid",
    unpaid: "Unpaid",
    overdue: "Overdue",
    cancelled: "Cancelled",
    Paid: "Paid",
    Unpaid: "Unpaid",
    Overdue: "Overdue",
    Disputed: "Disputed",
    Cancelled: "Cancelled",
  };

  return (
    <Badge variant={variants[status] ?? "default"}>
      {labels[status] ?? status}
    </Badge>
  );
}

export function TokenBadge({ token }: { token: string }) {
  const variants: Record<string, BadgeProps["variant"]> = {
    cUSD: "success",
    cEUR: "blue",
    cKES: "amber",
    USDC: "neutral",
  };

  return <Badge variant={variants[token] ?? "neutral"}>{token}</Badge>;
}

export function TypeBadge({ type }: { type: string }) {
  const variants: Record<string, BadgeProps["variant"]> = {
    Standard: "neutral",
    Recurring: "blue",
    Milestone: "purple",
  };

  return <Badge variant={variants[type] ?? "neutral"}>{type}</Badge>;
}
