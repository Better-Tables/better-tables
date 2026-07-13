/**
 * @fileoverview Main entry point for the ORM-agnostic adapter toolkit
 * @module @better-tables/adapters-toolkit
 *
 * @description
 * Shared, ORM-agnostic primitives for building Better Tables adapters:
 * relationship-path aliasing, schema introspection ports, primary-table
 * resolution, flat-to-nested data transformation, filter operator
 * classification/routing, and safe SQL identifier escaping.
 *
 * Concrete ORM adapters (e.g. `@better-tables/adapters-drizzle`) implement
 * small ORM-specific "ports" and compose them with these primitives instead
 * of re-implementing this logic from scratch.
 */
