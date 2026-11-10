/**
 * The service-page gate as one object, for the intake UI. The implementation is @jdd/schema's
 * (client-seo's rule, service-page-spec.md §1); lib/intake-todo.ts takes it as a parameter so its
 * tests can pass the same functions without loading the package through the console's CJS path.
 */
import {
  servicePageFacts, qualifiesForServicePage, FACTS_MIN, INCLUDED_MIN, TYPICAL_JOBS_MIN,
} from '@jdd/schema';
import type { ServiceGate } from './intake-todo';

export const SERVICE_GATE: ServiceGate = {
  servicePageFacts, qualifiesForServicePage, FACTS_MIN, INCLUDED_MIN, TYPICAL_JOBS_MIN,
};
