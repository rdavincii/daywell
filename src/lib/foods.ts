import type { FoodRef, Portion } from './types';

export const FOODS: FoodRef[] = [
  // --- Rice & Nasi Dishes ---
  { key: 'nasi-lemak', name: 'Nasi lemak', aliases: ['nasi lemak', 'lemak rice'], serving: '1 standard packet (egg, sambal, anchovies, peanuts)', kcal: 550, proteinG: 14, carbsG: 75, fatG: 22, kcalLow: 450, kcalHigh: 700, note: 'Varies with coconut milk and sambal.' },
  { key: 'nasi-lemak-ayam', name: 'Nasi lemak ayam goreng', aliases: ['nasi lemak ayam', 'nasi lemak with fried chicken'], serving: '1 plate with fried chicken', kcal: 780, proteinG: 34, carbsG: 80, fatG: 36, kcalLow: 650, kcalHigh: 950 },
  { key: 'chicken-rice', name: 'Chicken rice', aliases: ['chicken rice', 'nasi ayam', 'steamed chicken rice', 'roast chicken rice'], serving: '1 plate with rice and chicken', kcal: 600, proteinG: 28, carbsG: 75, fatG: 19, kcalLow: 500, kcalHigh: 720 },
  { key: 'nasi-goreng', name: 'Nasi goreng', aliases: ['nasi goreng', 'fried rice'], serving: '1 plate', kcal: 620, proteinG: 16, carbsG: 82, fatG: 24, kcalLow: 500, kcalHigh: 780 },
  { key: 'nasi-goreng-kampung', name: 'Nasi goreng kampung', aliases: ['nasi goreng kampung', 'kampung fried rice'], serving: '1 plate with kangkung and anchovies', kcal: 650, proteinG: 18, carbsG: 80, fatG: 26, kcalLow: 520, kcalHigh: 800 },
  { key: 'nasi-goreng-pattaya', name: 'Nasi goreng pattaya', aliases: ['nasi goreng pattaya', 'pattaya fried rice'], serving: '1 plate wrapped in egg', kcal: 720, proteinG: 22, carbsG: 85, fatG: 32, kcalLow: 600, kcalHigh: 880 },
  { key: 'nasi-goreng-cina', name: 'Nasi goreng cina', aliases: ['nasi goreng cina', 'chinese fried rice'], serving: '1 plate with mixed veg and egg', kcal: 580, proteinG: 15, carbsG: 78, fatG: 22, kcalLow: 480, kcalHigh: 700 },
  { key: 'nasi-goreng-usa', name: 'Nasi goreng USA', aliases: ['nasi goreng usa'], serving: '1 plate with beef and sunny-side egg', kcal: 740, proteinG: 28, carbsG: 85, fatG: 30, kcalLow: 620, kcalHigh: 900 },
  { key: 'nasi-kandar', name: 'Nasi kandar', aliases: ['nasi kandar', 'kandar rice'], serving: '1 plate (rice, mixed curries, chicken, cabbage)', kcal: 820, proteinG: 38, carbsG: 95, fatG: 32, kcalLow: 680, kcalHigh: 1050 },
  { key: 'nasi-briyani', name: 'Nasi briyani ayam', aliases: ['nasi briyani', 'briyani rice', 'chicken briyani', 'biryani'], serving: '1 plate with spiced chicken and dalca', kcal: 760, proteinG: 34, carbsG: 88, fatG: 28, kcalLow: 640, kcalHigh: 950 },
  { key: 'nasi-briyani-kambing', name: 'Nasi briyani kambing', aliases: ['briyani kambing', 'mutton briyani'], serving: '1 plate with mutton curry', kcal: 850, proteinG: 40, carbsG: 88, fatG: 38, kcalLow: 720, kcalHigh: 1050 },
  { key: 'nasi-tomato', name: 'Nasi tomato ayam masak merah', aliases: ['nasi tomato', 'tomato rice'], serving: '1 plate with ayam masak merah', kcal: 710, proteinG: 32, carbsG: 86, fatG: 25, kcalLow: 580, kcalHigh: 880 },
  { key: 'nasi-ayam-kunyit', name: 'Nasi ayam kunyit', aliases: ['nasi ayam kunyit', 'ayam kunyit'], serving: '1 set with fried turmeric chicken and sambal', kcal: 660, proteinG: 32, carbsG: 78, fatG: 24, kcalLow: 550, kcalHigh: 800 },
  { key: 'nasi-kerabu', name: 'Nasi kerabu', aliases: ['nasi kerabu'], serving: '1 plate with herbs, salted egg and grilled chicken', kcal: 560, proteinG: 28, carbsG: 70, fatG: 18, kcalLow: 450, kcalHigh: 680 },
  { key: 'nasi-dagang', name: 'Nasi dagang', aliases: ['nasi dagang'], serving: '1 plate with gulai ikan tongkol', kcal: 650, proteinG: 30, carbsG: 80, fatG: 22, kcalLow: 520, kcalHigh: 800 },
  { key: 'nasi-kukus', name: 'Nasi kukus ayam berempah', aliases: ['nasi kukus', 'nasi kukus ayam'], serving: '1 packet with spiced fried chicken and gulai', kcal: 720, proteinG: 38, carbsG: 65, fatG: 34, kcalLow: 600, kcalHigh: 900 },
  { key: 'ayam-gepuk', name: 'Ayam gepuk', aliases: ['ayam gepuk', 'ayam geprek', 'ayam penyet'], serving: '1 set with rice, sambal, tempeh and tofu', kcal: 680, proteinG: 35, carbsG: 60, fatG: 32, kcalLow: 550, kcalHigh: 800 },
  { key: 'bubur-ayam', name: 'Bubur ayam (Chicken porridge)', aliases: ['bubur ayam', 'porridge', 'chicken porridge', 'congee'], serving: '1 bowl with shredded chicken', kcal: 260, proteinG: 14, carbsG: 42, fatG: 4, kcalLow: 200, kcalHigh: 340 },
  { key: 'white-rice', name: 'White rice', aliases: ['white rice', 'plain rice', 'nasi putih', 'steamed rice'], serving: '1 cup cooked (approx. 150g)', kcal: 205, proteinG: 4, carbsG: 45, fatG: 0.5, kcalLow: 180, kcalHigh: 230 },
  { key: 'brown-rice', name: 'Brown rice', aliases: ['brown rice', 'nasi perang'], serving: '1 cup cooked (approx. 150g)', kcal: 215, proteinG: 5, carbsG: 45, fatG: 1.8, kcalLow: 190, kcalHigh: 240 },

  // --- Roti & Mamak Staples ---
  { key: 'roti-canai', name: 'Roti canai', aliases: ['roti canai', 'roti prata'], serving: '1 piece, plain', kcal: 300, proteinG: 6, carbsG: 40, fatG: 12, kcalLow: 250, kcalHigh: 360, note: 'Dhal or curry adds approx 50-80 kcal.' },
  { key: 'roti-telur', name: 'Roti telur', aliases: ['roti telur'], serving: '1 piece with egg', kcal: 410, proteinG: 12, carbsG: 44, fatG: 20, kcalLow: 350, kcalHigh: 480 },
  { key: 'roti-bom', name: 'Roti bom', aliases: ['roti bom'], serving: '1 piece thick sweet roti', kcal: 390, proteinG: 6, carbsG: 46, fatG: 20, kcalLow: 320, kcalHigh: 480 },
  { key: 'roti-bawang', name: 'Roti bawang', aliases: ['roti bawang'], serving: '1 piece with sliced onions', kcal: 320, proteinG: 6, carbsG: 43, fatG: 13, kcalLow: 260, kcalHigh: 380 },
  { key: 'roti-tissue', name: 'Roti tissue', aliases: ['roti tissue', 'roti tisu'], serving: '1 serving with condensed milk/sugar', kcal: 460, proteinG: 5, carbsG: 68, fatG: 18, kcalLow: 380, kcalHigh: 550 },
  { key: 'murtabak-ayam', name: 'Murtabak ayam', aliases: ['murtabak', 'murtabak ayam', 'chicken murtabak'], serving: '1 piece with curry and pickled onions', kcal: 540, proteinG: 26, carbsG: 52, fatG: 24, kcalLow: 440, kcalHigh: 680 },
  { key: 'murtabak-daging', name: 'Murtabak daging', aliases: ['murtabak daging', 'beef murtabak'], serving: '1 piece with minced beef and egg', kcal: 580, proteinG: 30, carbsG: 52, fatG: 28, kcalLow: 480, kcalHigh: 720 },
  { key: 'roti-jala', name: 'Roti jala dengan kari ayam', aliases: ['roti jala'], serving: '4 rolls with chicken curry', kcal: 420, proteinG: 18, carbsG: 46, fatG: 18, kcalLow: 340, kcalHigh: 520 },
  { key: 'naan-plain', name: 'Plain naan', aliases: ['naan', 'plain naan'], serving: '1 piece', kcal: 260, proteinG: 8, carbsG: 48, fatG: 4, kcalLow: 220, kcalHigh: 310 },
  { key: 'naan-garlic', name: 'Garlic butter naan', aliases: ['garlic naan', 'butter naan'], serving: '1 piece with garlic and butter', kcal: 340, proteinG: 9, carbsG: 49, fatG: 12, kcalLow: 280, kcalHigh: 420 },
  { key: 'naan-cheese', name: 'Cheese naan', aliases: ['cheese naan', 'naan cheese'], serving: '1 piece stuffed with cheese', kcal: 430, proteinG: 16, carbsG: 52, fatG: 17, kcalLow: 360, kcalHigh: 530 },
  { key: 'tandoori-chicken', name: 'Tandoori chicken', aliases: ['tandoori chicken', 'ayam tandoori'], serving: '1 quarter chicken', kcal: 260, proteinG: 34, carbsG: 4, fatG: 12, kcalLow: 220, kcalHigh: 320 },
  { key: 'tosai', name: 'Tosai', aliases: ['tosai', 'thosai', 'dosa'], serving: '1 piece plain with chutney and dhal', kcal: 210, proteinG: 5, carbsG: 38, fatG: 4, kcalLow: 170, kcalHigh: 260 },
  { key: 'tosai-telur', name: 'Tosai telur', aliases: ['tosai telur', 'egg tosai'], serving: '1 piece with egg', kcal: 310, proteinG: 11, carbsG: 39, fatG: 11, kcalLow: 250, kcalHigh: 380 },
  { key: 'chapati', name: 'Chapati', aliases: ['chapati', 'capati'], serving: '1 piece without oil', kcal: 120, proteinG: 4, carbsG: 24, fatG: 1, kcalLow: 100, kcalHigh: 150 },
  { key: 'roti-bakar', name: 'Roti bakar kaya butter', aliases: ['roti bakar', 'kaya toast', 'toast with kaya'], serving: '2 slices with butter and kaya', kcal: 290, proteinG: 6, carbsG: 38, fatG: 13, kcalLow: 230, kcalHigh: 360 },
  { key: 'half-boiled-eggs', name: 'Half-boiled eggs', aliases: ['half boiled eggs', 'half-boiled eggs', 'telur separuh masak'], serving: '2 eggs', kcal: 145, proteinG: 13, carbsG: 1, fatG: 10, kcalLow: 130, kcalHigh: 160 },

  // --- Noodles ---
  { key: 'char-kuey-teow', name: 'Char kuey teow', aliases: ['char kuey teow', 'char kway teow', 'ckt', 'kuey teow goreng'], serving: '1 plate with prawns, cockles, egg', kcal: 740, proteinG: 22, carbsG: 84, fatG: 35, kcalLow: 600, kcalHigh: 900 },
  { key: 'mee-goreng', name: 'Mee goreng mamak', aliases: ['mee goreng', 'mi goreng', 'fried noodles'], serving: '1 plate with tofu, potatoes and egg', kcal: 650, proteinG: 18, carbsG: 88, fatG: 25, kcalLow: 540, kcalHigh: 780 },
  { key: 'maggi-goreng', name: 'Maggi goreng', aliases: ['maggi goreng'], serving: '1 plate', kcal: 580, proteinG: 12, carbsG: 72, fatG: 26, kcalLow: 480, kcalHigh: 700 },
  { key: 'maggi-sup', name: 'Maggi sup telur', aliases: ['maggi sup', 'instant noodles soup'], serving: '1 bowl with 1 egg', kcal: 430, proteinG: 13, carbsG: 58, fatG: 16, kcalLow: 360, kcalHigh: 510 },
  { key: 'curry-laksa', name: 'Curry laksa', aliases: ['curry laksa', 'curry mee', 'laksa'], serving: '1 bowl with coconut gravy, tofu puff, chicken', kcal: 580, proteinG: 22, carbsG: 62, fatG: 28, kcalLow: 460, kcalHigh: 720 },
  { key: 'asam-laksa', name: 'Asam laksa', aliases: ['asam laksa', 'penang laksa'], serving: '1 bowl with tamarind fish broth and herbs', kcal: 430, proteinG: 20, carbsG: 68, fatG: 8, kcalLow: 350, kcalHigh: 520 },
  { key: 'laksa-sarawak', name: 'Laksa Sarawak', aliases: ['laksa sarawak', 'sarawak laksa'], serving: '1 bowl with spiced sambal belacan gravy, prawns', kcal: 530, proteinG: 24, carbsG: 58, fatG: 22, kcalLow: 440, kcalHigh: 660 },
  { key: 'wantan-mee', name: 'Wantan mee', aliases: ['wantan mee', 'wonton mee', 'wan tan mee'], serving: '1 plate dry/soup with char siew and wontons', kcal: 460, proteinG: 21, carbsG: 64, fatG: 14, kcalLow: 380, kcalHigh: 560 },
  { key: 'kolo-mee', name: 'Kolo mee', aliases: ['kolo mee', 'sarawak kolo mee'], serving: '1 bowl with minced meat and char siew', kcal: 480, proteinG: 20, carbsG: 65, fatG: 16, kcalLow: 400, kcalHigh: 580 },
  { key: 'pan-mee', name: 'Pan mee', aliases: ['pan mee', 'chilli pan mee', 'soup pan mee'], serving: '1 bowl with anchovies, minced meat, poached egg', kcal: 510, proteinG: 24, carbsG: 68, fatG: 16, kcalLow: 420, kcalHigh: 630 },
  { key: 'bihun-soup', name: 'Bihun sup', aliases: ['bihun soup', 'mee hoon soup', 'bee hoon soup'], serving: '1 bowl with chicken slices or fishballs', kcal: 350, proteinG: 16, carbsG: 55, fatG: 6, kcalLow: 280, kcalHigh: 420 },
  { key: 'kuey-teow-soup', name: 'Kuey teow sup', aliases: ['kuey teow soup', 'kuey teow thng'], serving: '1 bowl clear broth with fishcakes and chicken', kcal: 380, proteinG: 18, carbsG: 58, fatG: 7, kcalLow: 300, kcalHigh: 450 },
  { key: 'mee-rebus', name: 'Mee rebus', aliases: ['mee rebus'], serving: '1 plate with thick sweet-spicy sweet potato gravy', kcal: 560, proteinG: 18, carbsG: 82, fatG: 16, kcalLow: 460, kcalHigh: 680 },
  { key: 'hokkien-mee', name: 'Hokkien mee (KL style)', aliases: ['hokkien mee', 'kl hokkien mee'], serving: '1 plate braised in dark soy sauce', kcal: 690, proteinG: 24, carbsG: 78, fatG: 32, kcalLow: 560, kcalHigh: 850 },
  { key: 'prawn-mee', name: 'Prawn mee (Har mee)', aliases: ['prawn mee', 'har mee'], serving: '1 bowl with spicy prawn broth, eggs and prawns', kcal: 470, proteinG: 22, carbsG: 66, fatG: 12, kcalLow: 380, kcalHigh: 570 },
  { key: 'chee-cheong-fun', name: 'Chee cheong fun', aliases: ['chee cheong fun', 'ccf'], serving: '1 plate with sweet sauce and sesame', kcal: 310, proteinG: 5, carbsG: 62, fatG: 4, kcalLow: 240, kcalHigh: 400 },

  // --- Soups & Traditional Dishes ---
  { key: 'bak-kut-teh', name: 'Bak kut teh with rice', aliases: ['bak kut teh', 'bkt'], serving: '1 pot herbal pork broth + small rice bowl', kcal: 640, proteinG: 38, carbsG: 45, fatG: 32, kcalLow: 520, kcalHigh: 820 },
  { key: 'sup-ekor', name: 'Sup ekor dengan nasi', aliases: ['sup ekor', 'oxtail soup'], serving: '1 bowl oxtail soup + white rice', kcal: 680, proteinG: 36, carbsG: 48, fatG: 34, kcalLow: 540, kcalHigh: 840 },
  { key: 'sup-ayam', name: 'Sup ayam dengan nasi', aliases: ['sup ayam', 'chicken soup'], serving: '1 bowl spiced chicken soup + white rice', kcal: 460, proteinG: 30, carbsG: 48, fatG: 14, kcalLow: 380, kcalHigh: 580 },
  { key: 'tom-yum-soup', name: 'Tom yum soup seafood', aliases: ['tom yum', 'tomyam'], serving: '1 bowl spicy Thai broth with prawns and squid', kcal: 240, proteinG: 22, carbsG: 14, fatG: 10, kcalLow: 180, kcalHigh: 320 },
  { key: 'soto-ayam', name: 'Soto ayam', aliases: ['soto ayam', 'soto'], serving: '1 bowl with compressed rice cubes (nasi himpit) and broth', kcal: 430, proteinG: 24, carbsG: 54, fatG: 12, kcalLow: 350, kcalHigh: 520 },
  { key: 'rendang-daging', name: 'Rendang daging (1 serving)', aliases: ['rendang daging', 'beef rendang'], serving: '1 portion slow-cooked beef in coconut spice', kcal: 320, proteinG: 28, carbsG: 8, fatG: 20, kcalLow: 260, kcalHigh: 420 },
  { key: 'ikan-bakar', name: 'Ikan bakar sambal', aliases: ['ikan bakar', 'grilled fish'], serving: '1 whole medium fish with chili paste', kcal: 310, proteinG: 38, carbsG: 6, fatG: 14, kcalLow: 240, kcalHigh: 400 },

  // --- Western & Fast Food ---
  { key: 'chicken-chop', name: 'Chicken chop', aliases: ['chicken chop', 'grilled chicken chop'], serving: '1 serving with black pepper sauce and fries', kcal: 680, proteinG: 38, carbsG: 45, fatG: 36, kcalLow: 550, kcalHigh: 850 },
  { key: 'burger', name: 'Burger', aliases: ['burger', 'chicken burger', 'beef burger', 'ramly burger'], serving: '1 burger with sauce and egg', kcal: 490, proteinG: 22, carbsG: 42, fatG: 26, kcalLow: 380, kcalHigh: 650 },
  { key: 'big-mac', name: 'Big Mac', aliases: ['big mac', 'mcdonalds burger'], serving: '1 burger', kcal: 550, proteinG: 25, carbsG: 45, fatG: 30, kcalLow: 500, kcalHigh: 600 },
  { key: 'mcchicken', name: 'McChicken', aliases: ['mcchicken'], serving: '1 sandwich', kcal: 400, proteinG: 14, carbsG: 40, fatG: 21, kcalLow: 370, kcalHigh: 450 },
  { key: 'mcnuggets-6', name: 'Chicken McNuggets (6 pcs)', aliases: ['mcnuggets', 'nuggets', 'chicken nuggets'], serving: '6 pieces with sauce', kcal: 270, proteinG: 15, carbsG: 17, fatG: 16, kcalLow: 240, kcalHigh: 320 },
  { key: 'french-fries', name: 'French fries', aliases: ['french fries', 'fries', 'kentang goreng'], serving: '1 medium portion', kcal: 340, proteinG: 4, carbsG: 44, fatG: 16, kcalLow: 280, kcalHigh: 420 },
  { key: 'fried-chicken-piece', name: 'Ayam goreng (Fried chicken piece)', aliases: ['ayam goreng', 'fried chicken', 'kfc chicken'], serving: '1 piece drumstick or thigh', kcal: 270, proteinG: 21, carbsG: 11, fatG: 16, kcalLow: 210, kcalHigh: 340 },
  { key: 'pizza', name: 'Pizza slice', aliases: ['pizza', 'pizza slice'], serving: '1 regular slice', kcal: 260, proteinG: 11, carbsG: 30, fatG: 10, kcalLow: 210, kcalHigh: 330 },
  { key: 'pasta', name: 'Pasta', aliases: ['pasta', 'spaghetti', 'spaghetti bolognese', 'carbonara'], serving: '1 plate', kcal: 520, proteinG: 20, carbsG: 68, fatG: 18, kcalLow: 420, kcalHigh: 680 },
  { key: 'sub-sandwich', name: 'Subway sandwich', aliases: ['subway', 'sandwich', 'sub sandwich'], serving: '6-inch sub', kcal: 380, proteinG: 22, carbsG: 46, fatG: 10, kcalLow: 290, kcalHigh: 490 },
  { key: 'shawarma', name: 'Chicken shawarma wrap', aliases: ['shawarma', 'kebab'], serving: '1 wrap with garlic sauce and salad', kcal: 450, proteinG: 26, carbsG: 42, fatG: 20, kcalLow: 380, kcalHigh: 580 },
  { key: 'grilled-salmon', name: 'Grilled salmon fillet', aliases: ['salmon', 'grilled salmon'], serving: '1 fillet (approx. 150g)', kcal: 310, proteinG: 34, carbsG: 0, fatG: 18, kcalLow: 260, kcalHigh: 380 },
  { key: 'chicken-breast', name: 'Grilled chicken breast', aliases: ['chicken breast', 'dada ayam'], serving: '1 boneless breast (approx. 150g)', kcal: 245, proteinG: 46, carbsG: 0, fatG: 5, kcalLow: 220, kcalHigh: 280 },
  { key: 'protein-shake', name: 'Whey protein shake', aliases: ['protein shake', 'whey protein', 'protein'], serving: '1 scoop in water', kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5, kcalLow: 110, kcalHigh: 140 },

  // --- Snacks & Desserts ---
  { key: 'curry-puff', name: 'Curry puff', aliases: ['curry puff', 'karipap'], serving: '1 piece', kcal: 230, proteinG: 4, carbsG: 24, fatG: 13, kcalLow: 180, kcalHigh: 290 },
  { key: 'pisang-goreng', name: 'Pisang goreng', aliases: ['pisang goreng', 'banana fritters'], serving: '2 pieces', kcal: 280, proteinG: 2, carbsG: 42, fatG: 12, kcalLow: 220, kcalHigh: 350 },
  { key: 'keropok-lekor', name: 'Keropok lekor goreng', aliases: ['keropok lekor', 'lekor'], serving: '5 pieces with chili dipping sauce', kcal: 260, proteinG: 14, carbsG: 28, fatG: 10, kcalLow: 200, kcalHigh: 340 },
  { key: 'satay', name: 'Chicken satay', aliases: ['satay', 'sate', 'satay ayam'], serving: '5 sticks with peanut sauce', kcal: 250, proteinG: 18, carbsG: 14, fatG: 14, kcalLow: 200, kcalHigh: 320 },
  { key: 'popiah', name: 'Popiah basah', aliases: ['popiah', 'spring roll'], serving: '2 rolls with turnip and sweet sauce', kcal: 210, proteinG: 6, carbsG: 36, fatG: 5, kcalLow: 160, kcalHigh: 280 },
  { key: 'siew-mai', name: 'Dim sum siew mai', aliases: ['siew mai', 'siu mai', 'dim sum'], serving: '3 pieces steamed dumplings', kcal: 180, proteinG: 12, carbsG: 10, fatG: 10, kcalLow: 140, kcalHigh: 240 },
  { key: 'pau-ayam', name: 'Steamed pau ayam', aliases: ['pau', 'bao', 'steamed bun'], serving: '1 piece', kcal: 210, proteinG: 8, carbsG: 34, fatG: 4.5, kcalLow: 170, kcalHigh: 260 },
  { key: 'apam-balik', name: 'Apam balik', aliases: ['apam balik'], serving: '1 slice with peanut, sweetcorn and sugar', kcal: 270, proteinG: 5, carbsG: 44, fatG: 8, kcalLow: 210, kcalHigh: 340 },
  { key: 'cendol', name: 'Cendol', aliases: ['cendol', 'chendol'], serving: '1 bowl with coconut milk and gula melaka', kcal: 360, proteinG: 3, carbsG: 62, fatG: 12, kcalLow: 270, kcalHigh: 450 },
  { key: 'ice-kacang', name: 'Ais kacang (ABC)', aliases: ['ais kacang', 'abc', 'air batu campur'], serving: '1 bowl with toppings and syrup', kcal: 310, proteinG: 5, carbsG: 64, fatG: 4, kcalLow: 240, kcalHigh: 400 },
  { key: 'mixue', name: 'Mixue Ice Cream', aliases: ['mixue', 'aiskrim mixue', 'mixue ice cream'], serving: '1 cone/cup', kcal: 220, proteinG: 4, carbsG: 35, fatG: 8, kcalLow: 180, kcalHigh: 300 },
  { key: 'boiled-egg', name: 'Boiled egg', aliases: ['boiled eggs', 'boiled egg', 'telur rebus', 'egg'], serving: '1 whole egg', kcal: 78, proteinG: 6, carbsG: 0.6, fatG: 5, kcalLow: 70, kcalHigh: 85 },
  { key: 'fried-egg', name: 'Telur mata / Fried egg', aliases: ['fried egg', 'telur mata'], serving: '1 egg sunny side up', kcal: 110, proteinG: 6, carbsG: 0.5, fatG: 9, kcalLow: 90, kcalHigh: 130 },

  // --- Fruits ---
  { key: 'banana', name: 'Banana', aliases: ['banana', 'bananas', 'pisang'], serving: '1 medium fruit', kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.3, kcalLow: 90, kcalHigh: 120 },
  { key: 'apple', name: 'Apple', aliases: ['apple', 'apples', 'epal'], serving: '1 medium fruit', kcal: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, kcalLow: 80, kcalHigh: 110 },
  { key: 'orange', name: 'Orange', aliases: ['orange', 'oranges', 'oren', 'limau'], serving: '1 medium fruit', kcal: 62, proteinG: 1.2, carbsG: 15, fatG: 0.2, kcalLow: 50, kcalHigh: 80 },
  { key: 'watermelon', name: 'Watermelon slice', aliases: ['watermelon', 'tembikai'], serving: '1 large wedge (approx. 280g)', kcal: 85, proteinG: 1.7, carbsG: 21, fatG: 0.4, kcalLow: 70, kcalHigh: 110 },
  { key: 'papaya', name: 'Papaya slice', aliases: ['papaya', 'betik'], serving: '1 slice (approx. 140g)', kcal: 60, proteinG: 0.7, carbsG: 15, fatG: 0.2, kcalLow: 45, kcalHigh: 80 },

  // --- Drinks ---
  { key: 'teh-tarik', name: 'Teh tarik', aliases: ['teh tarik'], serving: '1 cup/glass (approx. 250ml)', kcal: 160, proteinG: 3.5, carbsG: 25, fatG: 5, kcalLow: 120, kcalHigh: 210, drink: true },
  { key: 'teh-o-ais', name: 'Teh O ais', aliases: ['teh o ais', 'iced tea with sugar', 'teh o'], serving: '1 glass', kcal: 80, proteinG: 0, carbsG: 20, fatG: 0, kcalLow: 50, kcalHigh: 110, drink: true },
  { key: 'teh-o-limau-ais', name: 'Teh O limau ais', aliases: ['teh o limau', 'teh o limau ais', 'iced lemon tea'], serving: '1 glass', kcal: 85, proteinG: 0, carbsG: 21, fatG: 0, kcalLow: 55, kcalHigh: 115, drink: true },
  { key: 'teh-c-ais', name: 'Teh C ais', aliases: ['teh c ais', 'teh c'], serving: '1 glass with evaporated milk and sugar', kcal: 130, proteinG: 2, carbsG: 22, fatG: 4, kcalLow: 90, kcalHigh: 170, drink: true },
  { key: 'milo-ais', name: 'Iced Milo (Milo ais)', aliases: ['iced milo', 'milo ais', 'milo ice', 'milo'], serving: '1 glass', kcal: 210, proteinG: 5.5, carbsG: 34, fatG: 6, kcalLow: 160, kcalHigh: 270, drink: true },
  { key: 'kopi', name: 'Kopi with condensed milk', aliases: ['kopi', 'coffee with milk', 'white coffee'], serving: '1 cup', kcal: 140, proteinG: 3, carbsG: 22, fatG: 4.5, kcalLow: 100, kcalHigh: 180, drink: true },
  { key: 'kopi-o', name: 'Kopi O', aliases: ['kopi o', 'black coffee with sugar'], serving: '1 cup', kcal: 65, proteinG: 0.5, carbsG: 15, fatG: 0, kcalLow: 40, kcalHigh: 90, drink: true },
  { key: 'kopi-o-kosong', name: 'Americano / Kopi O Kosong', aliases: ['kopi o kosong', 'black coffee', 'americano', 'espresso'], serving: '1 cup plain', kcal: 5, proteinG: 0.5, carbsG: 0.5, fatG: 0, kcalLow: 2, kcalHigh: 10, drink: true },
  { key: 'iced-latte', name: 'Iced Caffe Latte', aliases: ['iced latte', 'latte', 'cappuccino', 'flat white'], serving: '1 cup with fresh milk', kcal: 130, proteinG: 7, carbsG: 10, fatG: 6, kcalLow: 100, kcalHigh: 180, drink: true },
  { key: 'zus-coffee', name: 'Zus Spanish Latte', aliases: ['zus', 'zus coffee', 'spanish latte'], serving: '1 iced cup', kcal: 240, proteinG: 6, carbsG: 30, fatG: 10, kcalLow: 180, kcalHigh: 300, drink: true },
  { key: 'zus-buttercreme', name: 'Zus Buttercreme Latté', aliases: ['buttercreme', 'buttercreme latte'], serving: '1 iced cup', kcal: 290, proteinG: 5, carbsG: 35, fatG: 14, kcalLow: 220, kcalHigh: 350, drink: true },
  { key: 'bubble-tea', name: 'Bubble milk tea with pearls', aliases: ['bubble tea', 'boba', 'boba milk tea'], serving: '1 cup regular 500ml', kcal: 420, proteinG: 3, carbsG: 75, fatG: 13, kcalLow: 300, kcalHigh: 580, drink: true },
  { key: 'sirap-bandung', name: 'Sirap bandung', aliases: ['sirap bandung', 'bandung'], serving: '1 glass rose syrup with evaporated milk', kcal: 190, proteinG: 3, carbsG: 33, fatG: 5, kcalLow: 140, kcalHigh: 250, drink: true },
  { key: 'soya-bean', name: 'Soya bean milk', aliases: ['soya bean', 'air soya', 'soy milk'], serving: '1 glass', kcal: 140, proteinG: 7, carbsG: 18, fatG: 4, kcalLow: 100, kcalHigh: 180, drink: true },
  { key: 'fresh-milk', name: 'Fresh milk', aliases: ['fresh milk', 'milk', 'susu segar', 'susu'], serving: '1 glass (250ml)', kcal: 150, proteinG: 8, carbsG: 12, fatG: 8, kcalLow: 120, kcalHigh: 170, drink: true },
  { key: '100-plus', name: '100 Plus Isotonic Drink', aliases: ['100 plus', '100plus', 'isotonic'], serving: '1 can (325ml)', kcal: 88, proteinG: 0, carbsG: 22, fatG: 0, kcalLow: 75, kcalHigh: 100, drink: true },
  { key: 'coke-zero', name: 'Coca-Cola Zero Sugar', aliases: ['coke zero', 'diet coke', 'pepsi black'], serving: '1 can (320ml)', kcal: 1, proteinG: 0, carbsG: 0, fatG: 0, kcalLow: 0, kcalHigh: 2, drink: true },
  { key: 'water', name: 'Plain water', aliases: ['mineral water', 'air kosong', 'plain water', 'water', 'air suam'], serving: '1 glass or bottle', kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, kcalLow: 0, kcalHigh: 0, drink: true },
];

export const PORTION_FACTOR: Record<Portion, number> = { small: 0.75, regular: 1, large: 1.35 };

export function findFood(text: string, customFoods: FoodRef[] = []): { food: FoodRef; alias: string } | null {
  const t = ` ${text.toLowerCase()} `;
  const allFoods = [...customFoods, ...FOODS];
  const aliasIndex = allFoods.flatMap((f) => [f.name, ...f.aliases].map((a) => ({ alias: a, food: f })))
    .sort((a, b) => b.alias.length - a.alias.length);

  for (const { alias, food } of aliasIndex) {
    const re = new RegExp(`(^|[^a-z])${alias.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z]|$)`);
    if (re.test(t)) return { food, alias };
  }
  return null;
}

// Foods found online this session, so quantity changes can rescale them. shortcut: lost on reload (saved entries keep their numbers), persist if re-editing old web entries matters.
const online = new Map<string, FoodRef>();
export const rememberFood = (f: FoodRef) => { online.set(f.key, f); };

export function foodByKey(key: string, customFoods: FoodRef[] = []): FoodRef | undefined {
  return customFoods.find(f => f.key === key) || FOODS.find((f) => f.key === key) || online.get(key);
}

export interface Nutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function scaleNutrition(food: FoodRef, quantity: number, portion: Portion): Nutrition {
  const k = quantity * PORTION_FACTOR[portion];
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    kcal: Math.round(food.kcal * k),
    proteinG: r1(food.proteinG * k),
    carbsG: r1(food.carbsG * k),
    fatG: r1(food.fatG * k),
  };
}

function lev(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}
const close = (a: string, b: string) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);

/** 0..1: how close the typed text is to a food name. Handles typos, prefixes and word order. */
export function similarity(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  if (!q || !t) return 0;
  if (t.startsWith(q)) return 0.9 + 0.1 * (q.length / t.length); // typing "nasi le" -> "nasi lemak"
  if (t.includes(q)) return 0.75 + 0.15 * (q.length / t.length);
  const qt = q.split(/\s+/);
  const tt = t.split(/\s+/);
  const perWord = qt.reduce((sum, w) => sum + Math.max(...tt.map((x) => close(w, x))), 0) / qt.length;
  return Math.max(close(q, t), perWord * 0.95);
}

/** Closest foods (name or alias) to what the user typed, best first. */
export function suggestFoods(query: string, foods: FoodRef[], limit = 5, min = 0.6): { food: FoodRef; score: number }[] {
  if (query.trim().length < 2) return [];
  return foods
    .map((food) => ({ food, score: Math.max(...[food.name, ...food.aliases].map((n) => similarity(query, n))) }))
    .filter((x) => x.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
