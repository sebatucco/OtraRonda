/** Traduce los códigos que lanzan las funciones de la base a mensajes para humanos. */
const MESSAGES: Record<string, string> = {
	QR_INVALIDO: 'Este QR ya no es válido. Pedile al mozo uno nuevo.',
	PEDIDOS_DESACTIVADOS: 'El bar pausó los pedidos por el celular. Pedile al mozo.',
	PEDIDO_VACIO: 'Tu pedido está vacío.',
	PEDIDO_DEMASIADO_GRANDE: 'El pedido es muy grande. Dividilo en dos.',
	PRODUCTO_NO_DISPONIBLE: 'Algo de tu pedido se acaba de agotar. Revisalo y volvé a enviar.',
	CANTIDAD_INVALIDA: 'Revisá las cantidades.',
	OPCIONES_INVALIDAS: 'Falta elegir una opción en',
	NO_AUTENTICADO: 'Tu sesión expiró. Volvé a entrar.',
	SIN_PERMISO: 'No tenés permiso para hacer eso.'
};

export function friendlyError(err: unknown): string {
	const raw =
		typeof err === 'object' && err && 'message' in err ? String(err.message) : String(err ?? '');
	const [code, detail] = raw.split(':');
	if (code === 'OPCIONES_INVALIDAS' && detail) return `${MESSAGES[code]} ${detail}.`;
	if (MESSAGES[code]) return MESSAGES[code];
	if (/fetch|network|Failed to fetch|load failed/i.test(raw))
		return 'Sin conexión. Revisá la señal y probá de nuevo.';
	if (/duplicate key|23505/.test(raw)) return 'Eso ya existe.';
	return 'Algo salió mal. Probá de nuevo.';
}
