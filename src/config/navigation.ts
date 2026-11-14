import {
  IconLayoutDashboard,
  IconPackage,
  IconChartBar,
  IconReceipt,
  IconLayoutKanban,
  IconUsersGroup,
  IconBuildingStore,
  IconTruckDelivery,
  IconWallet,
  IconSparkles,
  IconLifebuoy,
  IconCreditCard,
  IconSettings,
  IconHome,
  IconActivity,
  IconChecklist,
  IconDots,
  IconReportAnalytics,
  IconSpeakerphone,
  type Icon,
} from "@tabler/icons-react";
import type { Feature } from "./plans";

export type Permission =
  | "viewDashboard"
  | "manageInventory"
  | "createOrders"
  | "deleteOrders"
  | "manageProjects"
  | "viewAnalytics"
  | "manageTeam"
  | "manageInvoices"
  | "accessBiSupplyNet"
  | "sellOnBiSupplyNet"
  | "manageSettings"
  | "manageMessages";

export interface NavItem {
  label: string;
  to: string;
  icon: Icon;
  /** Hidden from team members who lack this permission (with a list: lack all of them). */
  permission?: Permission | Permission[];
  /** Shown with a lock when the plan doesn't include it (the page explains the upgrade). */
  feature?: Feature;
  /** Owner only (billing). */
  ownerOnly?: boolean;
}

// Desktop sidebar, in Figma order (1889:1781). "Customers" is in the design
// but has no backend endpoint yet, so it is left out until the API exists.
export const SIDEBAR_NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: IconLayoutDashboard, permission: "viewDashboard" },
  { label: "Inventory", to: "/inventory", icon: IconPackage, feature: "inventory" },
  { label: "Sales", to: "/sales", icon: IconChartBar, feature: "orders", permission: "viewAnalytics" },
  { label: "Orders", to: "/orders", icon: IconReceipt, feature: "orders" },
  { label: "Reports", to: "/reports", icon: IconReportAnalytics, feature: "analytics", permission: "viewAnalytics" },
  { label: "Projects", to: "/projects", icon: IconLayoutKanban, feature: "projects" },
  { label: "Team", to: "/settings/team", icon: IconUsersGroup, permission: "manageTeam" },
  { label: "Online Store", to: "/store", icon: IconBuildingStore, feature: "store" },
  { label: "BiSupplyNet", to: "/bisupplynet", icon: IconTruckDelivery, feature: "bisupplynet", permission: ["accessBiSupplyNet", "sellOnBiSupplyNet"] },
  { label: "Wallet", to: "/wallet", icon: IconWallet, ownerOnly: true },
  { label: "FELI AI", to: "/feli", icon: IconSparkles },
  { label: "Social media", to: "/social", icon: IconSpeakerphone },
  { label: "Support", to: "/support", icon: IconLifebuoy },
  { label: "Subscription", to: "/subscription", icon: IconCreditCard, ownerOnly: true },
  { label: "Settings", to: "/settings", icon: IconSettings },
];

// Mobile tab bar (1924:1387): Home, Activity, Tasks, More.
export const MOBILE_TABS: NavItem[] = [
  { label: "Home", to: "/dashboard", icon: IconHome },
  { label: "Activity", to: "/orders", icon: IconActivity },
  { label: "Tasks", to: "/projects", icon: IconChecklist },
  { label: "More", to: "/more", icon: IconDots },
];
