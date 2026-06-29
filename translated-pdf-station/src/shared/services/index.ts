/**
 * @file index.ts
 * @description Public barrel for shared service infrastructure.
 *
 * Features should consume cross-cutting service concerns (config, base
 * types, shared error classes) through this barrel only, never via deep
 * subpaths.
 */

// =================================================================================================
// Exports
// =================================================================================================

export { serviceConfig } from './config/serviceConfig';
export type { ServiceConfig } from './config/serviceConfig';
