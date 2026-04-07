// Shared ZATCA UI helpers — badge styling for submission statuses

export type ZatcaSubmissionStatus = "CLEARED" | "REPORTED" | "PENDING" | "REJECTED" | "WARNING" | "FAILED";

export function getZatcaStatusBadgeProps(status: string) {
  switch (status) {
    case "CLEARED":
      return { className: "bg-green-100 text-green-700 border-green-200", label: "Cleared" };
    case "REPORTED":
      return { className: "bg-green-100 text-green-700 border-green-200", label: "Reported" };
    case "PENDING":
      return { className: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Pending" };
    case "WARNING":
      return { className: "bg-amber-100 text-amber-700 border-amber-200", label: "Warning" };
    case "REJECTED":
      return { className: "bg-red-100 text-red-700 border-red-200", label: "Rejected" };
    case "FAILED":
      return { className: "bg-red-100 text-red-700 border-red-200", label: "Failed" };
    default:
      return { className: "bg-slate-100 text-slate-600 border-slate-200", label: status };
  }
}

export function getZatcaEnvironmentBadgeProps(env: string) {
  switch (env) {
    case "SANDBOX":
      return { className: "bg-orange-100 text-orange-700 border-orange-200", label: "Sandbox" };
    case "SIMULATION":
      return { className: "bg-blue-100 text-blue-700 border-blue-200", label: "Simulation" };
    case "PRODUCTION":
      return { className: "bg-green-100 text-green-700 border-green-200", label: "Production" };
    default:
      return { className: "bg-slate-100 text-slate-600 border-slate-200", label: env };
  }
}

export function isRetryableStatus(status: string): boolean {
  return status === "FAILED" || status === "REJECTED";
}
