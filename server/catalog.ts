export type Dish = {
  id: string;
  name: string;
  price: number;
  description: string;
  categoryId: string;
  image: string;
  coffee: boolean;
};

export const CATEGORIES: [string, string, number][] = [
  ['cat_drinks', 'Drinks', 1],
  ['cat_canapes', 'Canapés', 2],
  ['cat_appetizers', 'Appetizers', 3],
  ['cat_salads', 'Salads', 4],
  ['cat_sliders', 'Sliders', 5],
  ['cat_mains', 'Mains', 6],
];

const drink = (id: string, name: string, price: number, description: string, image: string, coffee = true): Dish => ({
  id, name, price, description, categoryId: 'cat_drinks', image, coffee,
});

const plate = (id: string, name: string, price: number, description: string, categoryId: string, image: string): Dish => ({
  id, name, price, description, categoryId, image, coffee: false,
});

export const MENU: Dish[] = [
  // POS register catalogue — Food (screenshot order first)
  plate('item_bacon_burger', 'Bacon Burger', 320, 'Beef patty, smoked bacon, cheddar, pickles, and house sauce on a toasted bun.', 'cat_sliders', '/items/cut/burger.png'),
  plate('item_cheese_burger', 'Cheese Burger', 290, 'Classic beef burger with melted cheese, lettuce, tomato, and ketchup.', 'cat_sliders', '/items/photos/cheese-burger.png'),
  plate('item_pizza_margherita', 'Pizza Margherita', 350, 'Tomato, mozzarella, and basil on a thin crust.', 'cat_mains', '/items/photos/pizza-margherita.png'),
  plate('item_pizza_veg', 'Pizza Vegetarian', 380, 'Vegetable pizza with peppers, mushrooms, and olives.', 'cat_mains', '/items/photos/pizza-vegetarian.png'),
  plate('item_pasta_4formaggi', 'Pasta 4 Formaggi', 340, 'Creamy four-cheese pasta, finished with cracked pepper.', 'cat_mains', '/items/photos/pasta-4-formaggi.png'),
  plate('item_funghi', 'Funghi', 320, 'Sautéed mushrooms with garlic and herbs.', 'cat_appetizers', '/items/cut/paneer.png'),
  plate('item_pasta_bolo', 'Pasta Bolognese', 330, 'Slow-cooked meat sauce over pasta.', 'cat_mains', '/items/photos/pasta-bolognese.png'),
  plate('item_chicken_curry_sandwich', 'Chicken Sandwich', 280, 'Crispy chicken sandwich on a soft roll.', 'cat_sliders', '/items/photos/chicken-sandwich.png'),
  plate('item_spicy_tuna_sandwich', 'Tuna Sandwich', 290, 'Tuna sandwich on a baguette.', 'cat_sliders', '/items/photos/tuna-sandwich.png'),
  plate('item_mozzarella_sandwich', 'Baguette', 260, 'Baguette with tomato, cheese, and greens.', 'cat_sliders', '/items/photos/baguette.png'),
  plate('item_club_sandwich', 'Club Sandwich', 300, 'Triple-decker club with chicken, egg, and salad.', 'cat_sliders', '/items/cut/club.png'),
  plate('item_lunch_maki', 'Maki', 420, 'Maki rolls with salmon and avocado.', 'cat_mains', '/items/photos/maki.png'),
  plate('item_lunch_salmon', 'Sashimi Boat', 480, 'Assorted sashimi served in a wooden boat.', 'cat_mains', '/items/photos/sashimi-boat.png'),
  plate('item_lunch_temaki', 'Temaki', 360, 'Salmon temaki hand roll.', 'cat_mains', '/items/photos/temaki.png'),
  plate('item_salmon_avocado', 'Salmon and Avocado', 390, 'Salmon and avocado on toast.', 'cat_mains', '/items/photos/salmon-avocado.png'),
  // Screenshot drink row interleaved with food
  drink('item_coca_cola', 'Coca-Cola', 80, 'Chilled Coca-Cola in a glass.', '/items/cut/sparkling.png', false),
  drink('item_water', 'Spa', 50, 'Spa still water.', '/items/photos/spa.png', false),
  drink('item_minute_maid', 'Minute Maid', 90, 'Chilled Minute Maid.', '/items/photos/minute-maid.png', false),
  drink('item_espresso', 'Espresso', 150, 'A short espresso in a white cup.', '/items/photos/espresso.png', false),
  drink('item_green_tea', 'Green Tea', 120, 'Green tea with fresh mint.', '/items/photos/green-tea.png', false),
  drink('item_milkshake_banana', 'Milkshake', 180, 'Milkshake with whipped cream and chocolate.', '/items/photos/milkshake.png', false),
  drink('item_ice_tea', 'Lipton Ice Tea', 110, 'Lipton sparkling ice tea.', '/items/photos/lipton-ice-tea.png', false),
  drink('item_schweppes', 'Schweppes Indian Tonic', 90, 'Schweppes Indian Tonic.', '/items/photos/schweppes-indian-tonic.png', false),
  drink('item_fanta', 'Fanta', 80, 'Chilled Fanta orange.', '/items/photos/fanta.png', false),
  plate('item_burger_combo', 'Burger Menu', 450, 'Cheese burger, fries, and a soft drink.', 'cat_mains', '/items/photos/burger-menu.png'),
  plate('item_sushi_combo', 'Salmon Nigiri', 520, 'Salmon nigiri on a platter.', 'cat_mains', '/items/photos/salmon-nigiri.png'),
];

export const ITEM_POS: Record<string, { num: string; alpha: string; favorite: boolean }> = {
  item_bacon_burger: { num: '1', alpha: 'BB', favorite: true },
  item_cheese_burger: { num: '2', alpha: 'CHB', favorite: true },
  item_pizza_margherita: { num: '3', alpha: 'PM', favorite: true },
  item_pizza_veg: { num: '4', alpha: 'PV', favorite: true },
  item_pasta_4formaggi: { num: '5', alpha: 'P4F', favorite: true },
  item_funghi: { num: '6', alpha: 'FUN', favorite: true },
  item_pasta_bolo: { num: '7', alpha: 'PBO', favorite: true },
  item_chicken_curry_sandwich: { num: '8', alpha: 'CCS', favorite: true },
  item_spicy_tuna_sandwich: { num: '9', alpha: 'STS', favorite: true },
  item_mozzarella_sandwich: { num: '10', alpha: 'MS', favorite: true },
  item_club_sandwich: { num: '11', alpha: 'CS', favorite: true },
  item_lunch_maki: { num: '12', alpha: 'LM', favorite: true },
  item_lunch_salmon: { num: '13', alpha: 'LS', favorite: true },
  item_lunch_temaki: { num: '14', alpha: 'LT', favorite: true },
  item_salmon_avocado: { num: '15', alpha: 'SA', favorite: true },
  item_burger_combo: { num: '16', alpha: 'BMC', favorite: true },
  item_sushi_combo: { num: '17', alpha: 'SLC', favorite: true },
  item_fries: { num: '18', alpha: 'FF', favorite: false },
  item_garlic_bread: { num: '19', alpha: 'GB', favorite: false },
  item_caesar: { num: '20', alpha: 'CAE', favorite: false },
  item_chicken_wings: { num: '21', alpha: 'CW', favorite: false },
  item_onion_rings: { num: '22', alpha: 'OR', favorite: false },
  item_greek_salad: { num: '23', alpha: 'GS', favorite: false },
  item_fish_chips: { num: '24', alpha: 'FC', favorite: false },
  item_steak_frites: { num: '25', alpha: 'SF', favorite: false },
  item_veg_wrap: { num: '26', alpha: 'VW', favorite: false },
  item_chicken_salad: { num: '27', alpha: 'CSA', favorite: false },
  item_tiramisu: { num: '28', alpha: 'TIR', favorite: false },
  item_cheesecake: { num: '29', alpha: 'CHC', favorite: false },
  item_brownie: { num: '30', alpha: 'BRW', favorite: false },
  item_coca_cola: { num: '31', alpha: 'COK', favorite: true },
  item_water: { num: '32', alpha: 'WAT', favorite: true },
  item_minute_maid: { num: '33', alpha: 'MM', favorite: true },
  item_espresso: { num: '34', alpha: 'ESP', favorite: true },
  item_green_tea: { num: '35', alpha: 'GT', favorite: true },
  item_milkshake_banana: { num: '36', alpha: 'MSB', favorite: true },
  item_ice_tea: { num: '37', alpha: 'IT', favorite: true },
  item_schweppes: { num: '38', alpha: 'SCH', favorite: true },
  item_fanta: { num: '39', alpha: 'FAN', favorite: true },
};
