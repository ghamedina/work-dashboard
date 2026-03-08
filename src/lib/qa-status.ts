import type { UnifiedPR } from './types';

export type QaStatus = 'qa' | 'qa-test' | 'qa-ci' | 'qa-success' | 'qa-failed' | 'qa-deployed';

export type QaCircleBadge = 'blue' | 'red' | 'green' | null;

export interface QaStatusResult {
	status: QaStatus;
	circleBadge: QaCircleBadge;
}

export function parseTestedOnStaging(description: string): boolean {
	return /- \[x\] tested on staging/i.test(description);
}

export function computeQaStatus(pr: UnifiedPR): QaStatusResult | null {
	const labels = pr.labels.map((l) => l.toLowerCase());

	if (!labels.includes('qa')) return null;

	if (labels.includes('qa-success')) return { status: 'qa-success', circleBadge: 'green' };
	if (labels.includes('qa-failed')) return { status: 'qa-failed', circleBadge: 'red' };
	if (labels.includes('deployed-to-qa')) return { status: 'qa-deployed', circleBadge: null };

	if (pr.ciStatus === 'running') return { status: 'qa-ci', circleBadge: 'blue' };
	if (pr.ciStatus === 'failed') return { status: 'qa-ci', circleBadge: 'red' };

	if (!parseTestedOnStaging(pr.description)) return { status: 'qa-test', circleBadge: null };

	return { status: 'qa', circleBadge: null };
}
