import { json } from '@sveltejs/kit';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

export const POST: RequestHandler = async ({ request }) => {
	let filePath: string;
	try {
		({ filePath } = await request.json());
	} catch {
		return json({ ok: false, error: 'Invalid request body' }, { status: 400 });
	}

	if (!filePath) {
		return json({ ok: false, error: 'Missing filePath' }, { status: 400 });
	}

	await execAsync(`code "${filePath}"`);
	return json({ ok: true });
};
