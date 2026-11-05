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
	}
});
