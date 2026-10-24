import { describe, it, expect } from "vitest";
import { resolveSafeLandingRoute } from "../../../app/navigation/navigation.resolver";
import { AuthUser } from "../types/auth.types";

describe("resolveSafeLandingRoute", () => {
  const superUser: AuthUser = {
    id: 1,
    username: "admin",
    email: "admin@mapar.com",
    name: "Super Admin",
    role: "SUPER_ADMIN",
    role_name: "Super Administrator",
    is_superuser: true,
    first_name: "Super",
    last_name: "Admin",
    accessible_modules: [
      "management",
      "organization",
      "uploads",
      "slides",
      "operations",
      "workflow",
      "workforce",
      "governance",
      "audit",
      "documents",
      "finance",
      "reports",
      "kpi",
      "admin",
    ],
  };

  const auditeeUser: AuthUser = {
    id: 2,
    username: "amit.barman",
    email: "amit.barman@telecrats.in",
    name: "Amit Barman",
    role: "CBH",
    role_name: "Circle Business Head",
    is_superuser: false,
    first_name: "Amit",
    last_name: "Barman",
    accessible_modules: ["audit", "documents"],
  };

  const docsOnlyUser: AuthUser = {
    id: 3,
    username: "doc.user",
    email: "doc.user@telecrats.in",
    name: "Doc User",
    role: "CBH",
    role_name: "Circle Business Head",
    is_superuser: false,
    first_name: "Doc",
    last_name: "User",
    accessible_modules: ["documents"],
  };

  const managementUser: AuthUser = {
    id: 4,
    username: "mgmt.user",
    email: "mgmt@telecrats.in",
    name: "Mgmt User",
    role: "MANAGEMENT",
    role_name: "Management",
    is_superuser: false,
    first_name: "Mgmt",
    last_name: "User",
    accessible_modules: ["management", "organization"],
  };

  it("permits superuser to access any target path unchanged", () => {
    expect(resolveSafeLandingRoute("/governance/tasks/1", superUser)).toBe("/governance/tasks/1");
    expect(resolveSafeLandingRoute("/", superUser)).toBe("/");
    expect(resolveSafeLandingRoute("/admin", superUser)).toBe("/admin");
  });

  it("rewrites /governance/tasks/:id to /audit/tasks/:id when user has audit permission", () => {
    expect(resolveSafeLandingRoute("/governance/tasks/1", auditeeUser)).toBe("/audit/tasks/1");
    expect(resolveSafeLandingRoute("/governance/tasks/42", auditeeUser)).toBe("/audit/tasks/42");
  });

  it("rewrites /governance/tasks/:id to /documents/tasks/:id when user only has documents permission", () => {
    expect(resolveSafeLandingRoute("/governance/tasks/1", docsOnlyUser)).toBe("/documents/tasks/1");
  });

  it("redirects unauthorized / route to user primary allowed module", () => {
    expect(resolveSafeLandingRoute("/", auditeeUser)).toBe("/audit");
    expect(resolveSafeLandingRoute("", auditeeUser)).toBe("/audit");
    expect(resolveSafeLandingRoute("/", docsOnlyUser)).toBe("/documents");
  });

  it("permits root / when user possesses management module", () => {
    expect(resolveSafeLandingRoute("/", managementUser)).toBe("/");
  });

  it("redirects restricted module route to user primary allowed module", () => {
    expect(resolveSafeLandingRoute("/operations", auditeeUser)).toBe("/audit");
    expect(resolveSafeLandingRoute("/governance", auditeeUser)).toBe("/audit");
    expect(resolveSafeLandingRoute("/users", auditeeUser)).toBe("/audit");
  });
});
