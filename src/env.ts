import { defineEnvVars } from '@sveltejs/kit/env';

const required = (name: string) => (value: string | undefined) => {
	if (!value) throw new Error(`Falta la variable de entorno ${name}. Mirá .env.example`);
	return value;
};

export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: {
		public: true,
		schema: required('PUBLIC_SUPABASE_URL'),
		description: 'URL del proyecto de Supabase (Settings → API)'
	},
	PUBLIC_SUPABASE_PUBLISHABLE_KEY: {
		public: true,
		schema: required('PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
		description:
			'Clave pública (publishable / anon) de Supabase. Es segura en el navegador: RLS protege los datos.'
	},
	ANTHROPIC_API_KEY: {
		schema: (value) => value || undefined,
		description: 'Opcional. Clave de la API de Claude para importar la carta desde una foto.'
	},
	ANTHROPIC_MODEL: {
		schema: (value) => value || 'claude-sonnet-5-5',
		description: 'Modelo de Claude para leer cartas (por defecto claude-sonnet-5-5).'
	}
});
