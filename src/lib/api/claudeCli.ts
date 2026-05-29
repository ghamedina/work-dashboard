import { spawn } from 'child_process';

export interface ClaudeCliConfig {
	binary: string;
	model: string;
}

/**
 * Spawn `claude -p` with the given prompt and return stdout.
 * Throws if the process exits non-zero or if the binary is not found.
 */
export function runClaudePrompt(
	cfg: ClaudeCliConfig,
	systemPrompt: string,
	userPrompt: string
): Promise<string> {
	return new Promise((resolve, reject) => {
		const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
		const child = spawn(cfg.binary, ['-p', combinedPrompt, '--model', cfg.model], {
			env: process.env
		});

		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString('utf-8');
		});
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString('utf-8');
		});

		child.on('error', (err) => {
			reject(new Error(`Failed to spawn '${cfg.binary}': ${err.message}`));
		});

		child.on('close', (code) => {
			if (code === 0) {
				resolve(stdout.trim());
			} else {
				reject(new Error(`'${cfg.binary} -p' exited with code ${code}: ${stderr.trim() || '(no stderr)'}`));
			}
		});
	});
}
