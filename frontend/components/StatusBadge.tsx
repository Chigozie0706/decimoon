"use client";

interface StatusBadgeProps {
  status: "paid" | "unpaid" | "overdue" | "active" | "paused";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    paid: "bg-[#22C55E]/10 text-[#22C55E]",
    unpaid: "bg-[#F59E0B]/10 text-[#F59E0B]",
    overdue: "bg-[#EF4444]/10 text-[#EF4444]",
    active: "bg-[#22C55E]/10 text-[#22C55E]",
    paused: "bg-gray-200 text-gray-600",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
