import { AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import clsx from "clsx";

const riskConfig = {
  HIGH: {
    className: "badge-high",
    Icon: AlertTriangle,
    label: "High Risk",
  },
  MEDIUM: {
    className: "badge-medium",
    Icon: AlertCircle,
    label: "Medium Risk",
  },
  LOW: {
    className: "badge-low",
    Icon: CheckCircle,
    label: "Low Risk",
  },
};

export default function RiskBadge({ level = "LOW", showLabel = true }) {
  const config = riskConfig[level?.toUpperCase()] || riskConfig.LOW;
  const { className, Icon, label } = config;

  return (
    <span className={className}>
      <Icon size={11} />
      {showLabel && label}
    </span>
  );
}

// Urgency badge for next steps
const urgencyConfig = {
  IMMEDIATE: { className: "badge-high", label: "Immediate" },
  SHORT_TERM: { className: "badge-medium", label: "Short Term" },
  LONG_TERM: { className: "badge-low", label: "Long Term" },
};

export function UrgencyBadge({ level = "LONG_TERM" }) {
  const config = urgencyConfig[level?.toUpperCase()] || urgencyConfig.LONG_TERM;
  return <span className={config.className}>{config.label}</span>;
}

// Confidence badge for Q&A
const confidenceConfig = {
  HIGH: { className: "badge-low", label: "High Confidence" },
  MEDIUM: { className: "badge-medium", label: "Medium Confidence" },
  LOW: { className: "badge-high", label: "Low Confidence" },
};

export function ConfidenceBadge({ level = "MEDIUM" }) {
  const config = confidenceConfig[level?.toUpperCase()] || confidenceConfig.MEDIUM;
  return <span className={config.className}>{config.label}</span>;
}

// Priority badge for checklists
const priorityConfig = {
  HIGH: { className: "badge-high", label: "High Priority" },
  MEDIUM: { className: "badge-medium", label: "Medium Priority" },
  LOW: { className: "badge-low", label: "Low Priority" },
};

export function PriorityBadge({ level = "MEDIUM" }) {
  const config = priorityConfig[level?.toUpperCase()] || priorityConfig.MEDIUM;
  return <span className={config.className}>{config.label}</span>;
}
