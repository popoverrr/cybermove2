// Registry of the 3D service loops; order = homeServices.items (docs/14-rework.md §8).
import React from 'react';
import { A01Audit } from './A01Audit';
import { A02Core } from './A02Core';
import { A03Brand } from './A03Brand';
import { A04Systems } from './A04Systems';
import { A05Social } from './A05Social';
import { A06Funnel } from './A06Funnel';
import { A07Tender } from './A07Tender';
import { A08Sales } from './A08Sales';
import { A09Hr } from './A09Hr';
import { A10Events } from './A10Events';

export type SceneDef = { id: string; index: string; code: string; readouts: string[]; Scene: React.FC };

export const SCENES: SceneDef[] = [
  { id: 'audit', index: '01', code: 'AUDIT · FINANCE · LEGAL', readouts: [], Scene: A01Audit },
  { id: 'brand-core', index: '02', code: 'BRAND CORE · GROWTH', readouts: [], Scene: A02Core },
  { id: 'brand-marketing', index: '03', code: 'BRAND MARKETING', readouts: [], Scene: A03Brand },
  { id: 'systems', index: '04', code: 'CRM · AUTOMATION · AI', readouts: [], Scene: A04Systems },
  { id: 'smm', index: '05', code: 'SMM · OOH · SOCIAL ADS', readouts: [], Scene: A05Social },
  { id: 'promotion', index: '06', code: 'B2B · B2C PROMOTION', readouts: [], Scene: A06Funnel },
  { id: 'tenders', index: '07', code: 'TENDER CONSULTING', readouts: [], Scene: A07Tender },
  { id: 'sales-department', index: '08', code: 'SALES DEPARTMENT', readouts: [], Scene: A08Sales },
  { id: 'hr-consulting', index: '09', code: 'HR · TEAM', readouts: [], Scene: A09Hr },
  { id: 'business-events', index: '10', code: 'EVENTS', readouts: [], Scene: A10Events },
];
