import type { BorderKind } from "./types";

export interface BorderStyle {
  kind: BorderKind;
  label: string;
  color: string; // hex
  pattern: "solid" | "dashed" | "dotted" | "wavy" | "double" | "thin" | "chevron";
  description: string; // for screen readers
}

export const BORDER_STYLES: Record<BorderKind, BorderStyle> = {
  default: {
    kind: "default",
    label: "Default",
    color: "#0a0a0a",
    pattern: "solid",
    description: "Standard post",
  },
  ad: {
    kind: "ad",
    label: "Advertisement",
    color: "#9ca3af",
    pattern: "dashed",
    description: "Advertisement",
  },
  forwarded: {
    kind: "forwarded",
    label: "Forwarded",
    color: "#f5f5f5",
    pattern: "dotted",
    description: "Forwarded post",
  },
  system: {
    kind: "system",
    label: "System",
    color: "#dc2626",
    pattern: "wavy",
    description: "System message",
  },
  direct_contact: {
    kind: "direct_contact",
    label: "Direct contact",
    color: "#15803d",
    pattern: "double",
    description: "Post from a direct contact",
  },
  friend_of_friend: {
    kind: "friend_of_friend",
    label: "Friend of friend",
    color: "#86efac",
    pattern: "thin",
    description: "Post from a friend of a contact",
  },
  merchant: {
    kind: "merchant",
    label: "Merchant",
    color: "#d4af37",
    pattern: "chevron",
    description: "Post from a merchant",
  },
};
