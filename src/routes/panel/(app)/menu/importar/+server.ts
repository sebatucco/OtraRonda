import { error, json } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '$app/env/private';
import type { RequestHandler } from './$types';

export type ImportedMenu = {
	categories: {
		name: string;
		products: { name: string; description: string | null; price: number | null }[];
	}[];
};

const PROMPT = `Sos un asistente que digitaliza cartas de bares y restaurantes.
Extraé TODOS los productos de la carta adjunta, agrupados por categoría, tal como aparecen.

Reglas:
- Respondé SOLO con JSON válido, sin texto extra, con esta forma exacta:
  {"categories":[{"name":"...","products":[{"name":"...","description":"..." o null,"price": número o null}]}]}
- "price" es un número sin símbolo de moneda ni separador de miles (ej: "$ 4.500" -> 4500, "12,50" -> 12.5).
- Si un producto tiene varios precios (ej: pinta/jarra), creá un producto por cada variante con el tamaño en el nombre.
- No inventes productos ni precios. Si no se lee el precio, usá null.
- Mantené el idioma y la ortografía de la carta. Corregí solo mayúsculas evidentes.
- Si la imagen no es una carta, respondé {"categories":[]}.`;

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

/** Lee una foto o PDF de la carta con Claude y devuelve categorías y productos para revisar. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const user = await locals.getUser();
	if (!user) error(401, 'Sesión expirada');
	if (!ANTHROPIC_API_KEY) error(501, 'La importación con IA no está configurada todavía.');

	const body = (await request.json().catch(() => null)) as {
		bar_id?: string;
		media_type?: string;
		data?: string;
	} | null;
	if (!body?.bar_id || !body.data || !body.media_type || !TYPES.includes(body.media_type))
		error(400, 'Archivo inválido');
	if (body.data.length > 10_000_000) error(413, 'El archivo es muy grande (máx. ~7 MB)');

	// Solo miembros del bar (RLS: si no es miembro, no ve la fila).
	const { data: member } = await locals.supabase
		.from('bar_members')
		.select('bar_id')
		.eq('bar_id', body.bar_id)
		.eq('user_id', user.id)
		.maybeSingle();
	if (!member) error(403, 'Sin permiso');

	const source = { type: 'base64', media_type: body.media_type, data: body.data };
	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-api-key': ANTHROPIC_API_KEY,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: ANTHROPIC_MODEL,
			max_tokens: 8000,
			messages: [
				{
					role: 'user',
					content: [
						body.media_type === 'application/pdf'
							? { type: 'document', source }
							: { type: 'image', source },
						{ type: 'text', text: PROMPT }
					]
				}
			]
		})
	});

	if (!res.ok) {
		console.error('Anthropic', res.status, await res.text().catch(() => ''));
		error(502, 'No pudimos leer la carta. Probá con otra foto.');
	}

	const out = (await res.json()) as { content?: { type: string; text?: string }[] };
	const text = out.content?.find((c) => c.type === 'text')?.text ?? '';
	const match = text.match(/\{[\s\S]*\}/);
	let parsed: ImportedMenu;
	try {
		parsed = JSON.parse(match?.[0] ?? '') as ImportedMenu;
	} catch {
		error(502, 'No pudimos entender la carta. Probá con una foto más nítida.');
	}

	// Normalizamos por si el modelo devolvió algo raro.
	const categories = (parsed.categories ?? [])
		.map((c) => ({
			name:
				String(c.name ?? '')
					.trim()
					.slice(0, 60) || 'Sin categoría',
			products: (c.products ?? [])
				.map((p) => ({
					name: String(p.name ?? '')
						.trim()
						.slice(0, 80),
					description: p.description ? String(p.description).trim().slice(0, 400) : null,
					price: typeof p.price === 'number' && isFinite(p.price) && p.price >= 0 ? p.price : null
				}))
				.filter((p) => p.name)
		}))
		.filter((c) => c.products.length);

	return json({ categories } satisfies ImportedMenu);
};
