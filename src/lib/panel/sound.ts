/**
 * Aviso sonoro sin archivos de audio: un "ding-dong" fuerte con Web Audio.
 * Los navegadores exigen un toque del usuario antes de sonar: llamá a unlock() desde un click.
 */
let ctx: AudioContext | null = null;

export async function unlock(): Promise<boolean> {
	try {
		ctx ??= new AudioContext();
		if (ctx.state === 'suspended') await ctx.resume();
		return ctx.state === 'running';
	} catch {
		return false;
	}
}

export function isUnlocked() {
	return ctx?.state === 'running';
}

function tone(freq: number, start: number, duration: number, gain = 0.6) {
	if (!ctx) return;
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.type = 'triangle';
	osc.frequency.value = freq;
	g.gain.setValueAtTime(0.0001, start);
	g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
	g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
	osc.connect(g).connect(ctx.destination);
	osc.start(start);
	osc.stop(start + duration + 0.05);
}

/** Pedido nuevo: dos notas ascendentes. Llamado al mozo: tres notas rápidas. */
export function chime(kind: 'order' | 'call' = 'order') {
	if (!ctx || ctx.state !== 'running') return;
	const t = ctx.currentTime;
	if (kind === 'order') {
		tone(880, t, 0.35);
		tone(1318.5, t + 0.22, 0.6);
	} else {
		tone(1046.5, t, 0.18);
		tone(1046.5, t + 0.22, 0.18);
		tone(1568, t + 0.44, 0.4);
	}
}
