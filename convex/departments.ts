import { v } from "convex/values";
import { query } from "./_generated/server";
import { getSecurityContext } from "./security/rowLevelSecurity";

// Get departments (mock implementation)
export const getDepartments = query({
  args: {},
  handler: async (ctx) => {
    const securityContext = await getSecurityContext(ctx);
    
    // Mock departments - in production, fetch from departments table
    return [
      { _id: "dept1", name: "Engineering" },
      { _id: "dept2", name: "Marketing" },
      { _id: "dept3", name: "Sales" },
      { _id: "dept4", name: "Operations" },
      { _id: "dept5", name: "Finance" },
      { _id: "dept6", name: "Human Resources" },
      { _id: "dept7", name: "Legal" },
      { _id: "dept8", name: "Customer Success" },
    ];
  },
});