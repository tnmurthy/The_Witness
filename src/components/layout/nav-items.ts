import {
  LayoutDashboard,
  Newspaper,
  FileEdit,
  Sparkles,
  BookOpen,
  Share2,
  Search,
  BarChart3,
  Shield,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * The eight Application Modules from the Solution Architecture Design
 * Document, in the same order they're listed there. Kept as one shared
 * array (rather than duplicated per Sidebar/mobile-nav/breadcrumbs) so
 * adding a module later is a one-line change reflected everywhere.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Publications", href: "/publications", icon: Newspaper },
  { label: "Issue Builder", href: "/dashboard/issues", icon: FileEdit },
  { label: "AI Workspace", href: "/dashboard/ai-workspace", icon: Sparkles },
  { label: "Wisdom Engine", href: "/dashboard/wisdom", icon: BookOpen },
  { label: "Knowledge Graph", href: "/dashboard/knowledge-graph", icon: Share2 },
  { label: "Search", href: "/dashboard/search", icon: Search },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
];

/**
 * Shown only to Super Admin (Milestone 2's Admin: Users & Roles screen).
 * Kept separate from NAV_ITEMS rather than folded in with a `roles`
 * filter field per item, since this is currently the only role-gated nav
 * entry — a generic per-item visibility system can be introduced if a
 * second one shows up rather than speculatively built now.
 */
export const ADMIN_NAV_ITEM: NavItem = { label: "Users & Roles", href: "/admin/users", icon: Shield };
