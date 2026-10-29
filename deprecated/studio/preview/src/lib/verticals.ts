import type { SiteContent } from '@/data/site';
import { CONTENT as hvacContent } from '@/data/verticals/hvac';
import { CONTENT as roofingContent } from '@/data/verticals/roofing';
import { CONTENT as plumbingContent } from '@/data/verticals/plumbing';
import { CONTENT as lawnCareContent } from '@/data/verticals/lawn-care';
import { CONTENT as carDetailingContent } from '@/data/verticals/car-detailing';

export type VerticalId = 'hvac' | 'roofing' | 'plumbing' | 'lawn-care' | 'car-detailing';

export interface Vertical {
  id: VerticalId;
  label: string;
}

export const VERTICALS: Vertical[] = [
  { id: 'hvac',          label: 'HVAC' },
  { id: 'roofing',       label: 'Roofing' },
  { id: 'plumbing',      label: 'Plumbing' },
  { id: 'lawn-care',     label: 'Lawn Care' },
  { id: 'car-detailing', label: 'Car Detailing' },
];

export const VERTICAL_PRESETS: Record<VerticalId, SiteContent> = {
  'hvac':          hvacContent,
  'roofing':       roofingContent,
  'plumbing':      plumbingContent,
  'lawn-care':     lawnCareContent,
  'car-detailing': carDetailingContent,
};
