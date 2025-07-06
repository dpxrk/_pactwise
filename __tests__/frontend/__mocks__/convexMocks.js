// Mock for convex/_generated/api
const api = new Proxy({}, {
  get: (target, prop) => {
    return new Proxy({}, {
      get: (innerTarget, innerProp) => {
        return `api.${prop}.${innerProp}`;
      }
    });
  }
});

// Mock for convex/_generated/dataModel
const Id = (tableName) => `${tableName}_id_${Math.random().toString(36).substr(2, 9)}`;

// Mock Doc type
const Doc = {};

// Mock TableNames
const TableNames = [
  'contracts',
  'vendors',
  'users',
  'enterprises',
  'departments',
  'categories',
  'workflows',
  'activities',
  'notifications'
];

// Mock types
const DataModel = {};
const QueryCtx = {};
const MutationCtx = {};
const ActionCtx = {};

module.exports = {
  api,
  Id,
  Doc,
  TableNames,
  DataModel,
  QueryCtx,
  MutationCtx,
  ActionCtx,
  default: { api, Id, Doc }
};