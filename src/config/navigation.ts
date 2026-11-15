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
  IconUsers,
  IconFileInvoice,
  IconMail,
  IconBell,
  IconHelpCircle,
  type Icon,
} from "@tabler/icons-react";
import type { Feature } from "./plans";
import { CUSTOMERS_FEATURE, CUSTOMER_PERMISSIONS } from "./customers";

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
  | "manageMessages"
  | "viewCustomers"
  | "manageCustomers";

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

// Desktop sidebar, in Figma order (1889:1781; Customers per 09.01).
export const SIDEBAR_NAV: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: IconLayoutDashboard, permission: "viewDashboard" },
  { label: "Inventory", to: "/inventory", icon: IconPackage, feature: "inventory" },
  { label: "Sales", to: "/sales", icon: IconChartBar, feature: "orders", permission: "viewAnalytics" },
  { label: "Orders", to: "/orders", icon: IconReceipt, feature: "orders" },
  { label: "Customers", to: "/customers", icon: IconUsers, feature: CUSTOMERS_FEATURE, permission: CUSTOMER_PERMISSIONS.view },
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

export interface MoreGroup {
  title: string;
  items: Array<NavItem & { description: string }>;
}

// Mobile "More" tab: every section that isn't in the tab bar, grouped.
// Same icons, plan and permission rules as the sidebar.
export const MORE_MENU: MoreGroup[] = [
  {
    title: "Sell and track",
    items: [
      { label: "Customers", to: "/customers", icon: IconUsers, feature: CUSTOMERS_FEATURE, permission: CUSTOMER_PERMISSIONS.view, description: "Contacts, history and quick orders" },
      { label: "Inventory", to: "/inventory", icon: IconPackage, feature: "inventory", description: "Products, stock and barcodes" },
      { label: "Sales", to: "/sales", icon: IconChartBar, feature: "orders", permission: "viewAnalytics", description: "Sales overview" },
      { label: "Invoices", to: "/invoices", icon: IconFileInvoice, feature: "invoices", permission: "manageInvoices", description: "Bill customers and track payment" },
      { label: "Reports", to: "/reports", icon: IconReportAnalytics, feature: "analytics", permission: "viewAnalytics", description: "Sales, stock and invoice reports" },
      { label: "Online Store", to: "/store", icon: IconBuildingStore, feature: "store", description: "Your shop, products and online orders" },
      { label: "BiSupplyNet", to: "/bisupplynet", icon: IconTruckDelivery, feature: "bisupplynet", permission: ["accessBiSupplyNet", "sellOnBiSupplyNet"], description: "Buy from trusted suppliers" },
    ],
  },
  {
    title: "Work together",
    items: [
      { label: "Projects", to: "/projects", icon: IconLayoutKanban, feature: "projects", description: "Boards, tasks and calendar" },
      { label: "Team", to: "/settings/team", icon: IconUsersGroup, permission: "manageTeam", description: "Invite people and set access" },
      { label: "Messages", to: "/messages", icon: IconMail, description: "Customer and supplier chats" },
      { label: "Notifications", to: "/notifications", icon: IconBell, description: "Alerts and updates" },
      { label: "FELI AI", to: "/feli", icon: IconSparkles, description: "Your business assistant" },
      { label: "Social media", to: "/social", icon: IconSpeakerphone, description: "Plan your posts" },
    ],
  },
  {
    title: "Money and account",
    items: [
      { label: "Wallet", to: "/wallet", icon: IconWallet, ownerOnly: true, description: "Balance, payouts and transactions" },
      { label: "Subscription", to: "/subscription", icon: IconCreditCard, ownerOnly: true, description: "Plan, credits and billing" },
      { label: "Settings", to: "/settings", icon: IconSettings, description: "Business, profile and security" },
      { label: "Support", to: "/support", icon: IconLifebuoy, description: "Tickets and service requests" },
      { label: "Help", to: "/support/help", icon: IconHelpCircle, description: "Guides and answers" },
    ],
  },
];
