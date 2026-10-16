import { HierarchyLevel, HierarchyLevelConfig } from "../types/organization.types";

export const HIERARCHY_CONFIG: Record<HierarchyLevel, HierarchyLevelConfig> = {
  MAIN_COMPANY: {
    level: "MAIN_COMPANY",
    name: "Main Company",
    plural_name: "Main Companies",
    parent_level: null,
    child_level: "SUB_COMPANY",
    badge_color: "purple",
    icon: "Business",
    can_create_root: true,
  },
  SUB_COMPANY: {
    level: "SUB_COMPANY",
    name: "Sub Company",
    plural_name: "Sub Companies",
    parent_level: "MAIN_COMPANY",
    child_level: "PROJECT",
    badge_color: "indigo",
    icon: "Domain",
    can_create_root: false,
  },
  PROJECT: {
    level: "PROJECT",
    name: "Project",
    plural_name: "Projects",
    parent_level: "SUB_COMPANY",
    child_level: "CIRCLE",
    badge_color: "blue",
    icon: "Work",
    can_create_root: false,
  },
  CIRCLE: {
    level: "CIRCLE",
    name: "Circle",
    plural_name: "Circles",
    parent_level: "PROJECT",
    child_level: "DOMAIN",
    badge_color: "cyan",
    icon: "Public",
    can_create_root: false,
  },
  DOMAIN: {
    level: "DOMAIN",
    name: "Domain",
    plural_name: "Domains",
    parent_level: "CIRCLE",
    child_level: "DEPARTMENT",
    badge_color: "emerald",
    icon: "Security",
    can_create_root: false,
  },
  DEPARTMENT: {
    level: "DEPARTMENT",
    name: "Department",
    plural_name: "Departments",
    parent_level: "DOMAIN",
    child_level: "SUB_DEPARTMENT",
    badge_color: "amber",
    icon: "Groups",
    can_create_root: false,
  },
  SUB_DEPARTMENT: {
    level: "SUB_DEPARTMENT",
    name: "Team",
    plural_name: "Teams",
    parent_level: "DEPARTMENT",
    child_level: "USER",
    badge_color: "rose",
    icon: "AccountTree",
    can_create_root: false,
  },
  TEAM: {
    level: "TEAM",
    name: "Team",
    plural_name: "Teams",
    parent_level: "DEPARTMENT",
    child_level: "USER",
    badge_color: "rose",
    icon: "AccountTree",
    can_create_root: false,
  },
  USER: {
    level: "USER",
    name: "User",
    plural_name: "Users",
    parent_level: "SUB_DEPARTMENT",
    child_level: null,
    badge_color: "teal",
    icon: "Person",
    can_create_root: false,
  },
};

export const HIERARCHY_ORDER: HierarchyLevel[] = [
  "MAIN_COMPANY",
  "SUB_COMPANY",
  "PROJECT",
  "CIRCLE",
  "DOMAIN",
  "DEPARTMENT",
  "SUB_DEPARTMENT",
  "USER",
];

export function getNextChildLevel(level: HierarchyLevel): HierarchyLevel | null {
  return HIERARCHY_CONFIG[level]?.child_level || null;
}

export function getAddChildButtonLabel(level: HierarchyLevel): string {
  const childLevel = getNextChildLevel(level);
  if (!childLevel) return "Add Child";
  return `+ Add ${HIERARCHY_CONFIG[childLevel]?.name || childLevel}`;
}

export function getLevelBadgeColor(level: HierarchyLevel): string {
  const colorMap: Record<HierarchyLevel, string> = {
    MAIN_COMPANY: "#7e22ce",
    SUB_COMPANY: "#4338ca",
    PROJECT: "#1d4ed8",
    CIRCLE: "#0e7490",
    DOMAIN: "#047857",
    DEPARTMENT: "#b45309",
    SUB_DEPARTMENT: "#be123c",
    TEAM: "#be123c",
    USER: "#0f766e",
  };
  return colorMap[level] || "#475569";
}

export function getLevelBadgeBg(level: HierarchyLevel): string {
  const bgMap: Record<HierarchyLevel, string> = {
    MAIN_COMPANY: "#f3e8ff",
    SUB_COMPANY: "#e0e7ff",
    PROJECT: "#dbeafe",
    CIRCLE: "#cffafe",
    DOMAIN: "#d1fae5",
    DEPARTMENT: "#fef3c7",
    SUB_DEPARTMENT: "#ffe4e6",
    TEAM: "#ffe4e6",
    USER: "#ccfbf1",
  };
  return bgMap[level] || "#f1f5f9";
}

