export function StatusBadge({
  status,
}: {
  status: "paid" | "unpaid" | "overdue" | "cancelled";
}) {
  const config = {
    paid: {
      label: "Paid",
      className: "bg-green-100 text-green-700 border border-green-200",
    },
    unpaid: {
      label: "Unpaid",
      className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
    },
    overdue: {
      label: "Overdue",
      className: "bg-red-100 text-red-700 border border-red-200",
    },
    cancelled: {
      label: "Cancelled",
      className: "bg-gray-100 text-gray-500 border border-gray-200",
    },
  };

  const { label, className } = config[status] ?? config.unpaid;

  return (
    <span
      className={`text-xs px-2.5 py-1 rounded-full ${className}`}
      style={{ fontWeight: 600 }}
    >
      {label}
    </span>
  );
}
