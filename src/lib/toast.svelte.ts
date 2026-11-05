export type Toast = { id: number; text: string; kind: 'ok' | 'error' };

let next = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Un solo aviso a la vez, arriba de la pantalla: no tapa botones ni hojas. */
export const toasts = $state<Toast[]>([]);

export function toast(text: string, kind: Toast['kind'] = 'ok', ms = 2800) {
	clearTimeout(timer);
	toasts.splice(0, toasts.length, { id: ++next, text, kind });
	timer = setTimeout(() => toasts.splice(0, toasts.length), ms);
}
