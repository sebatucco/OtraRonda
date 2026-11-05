export type Option = {
	id: string;
	name: string;
	price_delta: number;
	available: boolean;
	position?: number;
};

export type OptionGroup = {
	id: string;
	name: string;
	min_select: number;
	max_select: number;
	options: Option[];
	position?: number;
};

export type Product = {
	id: string;
	category_id: string;
	name: string;
	description: string | null;
	price: number;
	image_url: string | null;
	tags: string[];
	available: boolean;
	option_groups: OptionGroup[];
};

export type Category = { id: string; name: string; products: Product[] };

export type Bar = {
	id: string;
	slug: string;
	name: string;
	logo_url: string | null;
	accent_color: string;
	currency: string;
	ordering_enabled: boolean;
	order_mode: 'open' | 'approve_first';
};

export type OrderStatus =
	'pending' | 'accepted' | 'preparing' | 'served' | 'rejected' | 'cancelled';

/** Lo que devuelve table_status() para el cliente. */
export type TableOrder = {
	id: string;
	customer_name: string | null;
	status: 'pending' | 'accepted' | 'preparing' | 'served';
	total: number;
	created_at: string;
	items: { name: string; quantity: number; unit_price: number; options: { name: string }[] }[];
};

export type TableStatus = {
	session_status: 'open' | 'bill_requested' | null;
	orders: TableOrder[];
};

export type TableInfo = { id: string; label: string; token: string };

/** Ítem del carrito tal como lo espera la RPC place_order. */
export type CartLine = {
	product_id: string;
	quantity: number;
	option_ids: string[];
	note?: string;
};
