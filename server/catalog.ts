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
  drink('item_moroccan', 'Moroccan Avocado Smoothie', 250, 'Ripe avocado is blended with cold milk until the glass turns pale green and thick enough to hold a straw. A little citrus keeps it bright, so the avocado stays fresh instead of heavy. Poured into a 240 ml glass and served while the top is still frothy. This is a spoon-thick smoothie, not a juice.', '/items/cut/smoothie.png'),
  drink('item_mint_latte', 'Mint Latte', 185, 'Espresso folded through steamed milk, with mint so the cup smells green before it tastes sweet. The milk is stretched glossy, not scalded, and the mint stays fresh instead of sharp. A short foam lid sits on top. Ask if you want it lightly sweet.', '/items/cut/mint.png'),
  drink('item_espresso', 'Classic Espresso', 150, 'A short, concentrated shot pulled so the crema stays thick and the finish turns sweet before it goes sharp. Served in a warm cup with sparkling water on the side. Two sips, then it is gone. The crema should cover the surface.', '/items/cut/espresso.png'),
  drink('item_cappuccino', 'Cappuccino', 180, 'Espresso under steamed milk and a dry foam cap tall enough to hold a spoon. The milk is stretched until glossy, then poured so the cap stays high instead of sinking into a latte. The cup is warmed before the pour. Foam should reach the rim.', '/items/cut/cappuccino.png'),
  drink('item_mocha', 'Chocolate Mocha', 220, 'Cocoa melted into the espresso first, then milk poured through so the chocolate stays a little bitter rather than candy-sweet. The cocoa goes in before the milk, so it does not sit as powder at the bottom. Hot, and meant to be stirred once.', '/items/cut/mocha.png'),
  drink('item_cold_brew', 'Cold Brew', 210, 'Coffee steeped cold for hours, then poured over ice so it stays smooth and low on bitterness. No blender, and no milk in the base glass. It should taste like coffee that has been patient, not like a watered-down iced americano. Drink it before the ice thins it.', '/items/cut/cold-brew.png'),
  drink('item_iced_americano', 'Iced Americano', 210, 'Espresso poured over ice and cold water. The shot is hot when it hits the ice, so it chills without a blender watering it down. Darker and cleaner than an iced latte. No milk in the base glass. Finish it before the ice gives up.', '/items/cut/iced.png'),
  drink('item_saigon', 'Saigon Cold Brew', 230, 'Cold brew sweetened with Vietnamese condensed milk until the glass ribbons tan and white. The milk is stirred through, not left as a puddle, so every sip is sweet and strong together. Iced, dense, and more dessert than a black cold brew.', '/items/cut/saigon.png'),
  drink('item_sparkling', 'Sparkling Espresso', 210, 'Cold brew sweetened with condensed milk, then opened so the cup is sweet and cold. Ice first, coffee and milk through it. The published cup is that condensed-milk cold brew. Drink it while the glass is still cold.', '/items/cut/sparkling.png'),
  drink('item_red_john', 'Red John', 225, 'Cold brew lengthened with orange and tonic until the glass is bright, bitter, and cold. The coffee is still there under the citrus. Built over ice so it stays lively instead of going flat. A long drink, not a shot.', '/items/cut/red-john.png'),
  drink('item_tonic', 'Cold Brew Tonic / Ginger Ale', 220, 'Espresso or cold brew poured over ice and tonic, or ginger ale if you would rather the spice. The bubbles lift the coffee and keep it long and cold. Built in the glass, not shaken, so you can still see the ice.', '/items/cut/tonic.png'),
  plate('item_halloumi', 'Strawberry Waffle', 210, 'A round waffle, crisp at the edge and soft in the pockets, with strawberries and a little syrup in the squares. Served warm so the fruit stays bright and the waffle has not gone soggy. Sweet, and meant to be eaten while it is still hot.', 'cat_canapes', '/items/cut/waffle.png'),
  plate('item_avocado_toast', 'Butter Pancakes', 210, 'A short stack of pancakes with butter on top and syrup running down the side. The centres stay soft and the edges are just browned. Served warm, as a plate, not a side. Eat them before the syrup soaks the stack through.', 'cat_canapes', '/items/cut/pancakes.png'),
  plate('item_cheddar', 'Chocolate Chunk Cookies', 175, 'Two thick cookies with chocolate chunks through the dough, baked so the edge is set and the middle is still a little soft. Served warm enough that the chocolate gives. A small plate, meant with coffee.', 'cat_sliders', '/items/cut/cookies.png'),
  plate('item_veg_club', 'Veg Club Sandwich', 250, 'A short, multi-layer vegetarian club. Toast, cheese, and salad stacked so each quarter stands up instead of sliding apart. The toast is dry enough to hold the tomato. Cut so you can see the layers. A small sandwich, not a doorstop.', 'cat_sliders', '/items/cut/club.png'),
  plate('item_croissant_sandwich', 'Cold Croissant Sandwich', 185, 'A croissant split and filled, then left so the pastry stays a little crisp against the filling. It is a sandwich you can pick up. Gone in a few bites. Eat it before the layers soften.', 'cat_sliders', '/items/cut/croissant.png'),
  plate('item_harvest', 'Green Harvest Burger', 240, 'A vegetable patty on a toasted bun, with tomato and greens so the patty still tastes like vegetables. Pressed just enough that it holds when you pick it up. Served hot. The patty should stay together in the bun.', 'cat_sliders', '/items/cut/burger.png'),
  plate('item_penne', 'Penne Creme Pesto', 230, 'Penne tossed in a creamy pesto until the sauce clings to the tubes instead of pooling in the bowl. Basil, cheese, and enough cream that it is soft, not oily. Served hot, as a full plate. The pesto should still taste green under the cream.', 'cat_mains', '/items/cut/penne.png'),
  plate('item_spaghetti', 'Spaghetti Aglio e Olio', 230, 'Spaghetti with garlic, olive oil, and chilli. No cream. The pasta water emulsifies the oil so it coats every strand, and the garlic is cooked sweet, not burnt. Chilli sits on the finish. A hot plate, glossy, and lighter than the pesto.', 'cat_mains', '/items/cut/spaghetti.png'),
  plate('item_paneer', 'Marinated Grill Cottage Cheese', 265, 'Cubes of paneer sat in a marinade, then cooked on the grill until the edges colour and the centre stays soft. Not a curry and not a fried nugget. Served hot, with the spice on the surface of the cheese. A full plate, eaten with a fork.', 'cat_mains', '/items/cut/paneer.png'),
];
