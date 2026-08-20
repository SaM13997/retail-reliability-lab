export type Product = {
  sku: string;
  name: string;
  category: string;
  priceCents: number;
  barcode: string;
  accent: string;
};

export const generatedCatalog: Product[] = [
  {
    sku: 'spark-water',
    name: 'Sparkling water',
    category: 'Cold drinks',
    priceCents: 175,
    barcode: '00010001',
    accent: '#A7D8FF',
  },
  {
    sku: 'oat-latte',
    name: 'Oat latte',
    category: 'Barista',
    priceCents: 475,
    barcode: '00010002',
    accent: '#F2C99D',
  },
  {
    sku: 'sea-salt',
    name: 'Sea salt crisps',
    category: 'Snacks',
    priceCents: 265,
    barcode: '00010003',
    accent: '#F6DF8A',
  },
  {
    sku: 'trail-mix',
    name: 'Almond trail mix',
    category: 'Snacks',
    priceCents: 395,
    barcode: '00010004',
    accent: '#BDD9A6',
  },
  {
    sku: 'matcha',
    name: 'Matcha energy',
    category: 'Cold drinks',
    priceCents: 350,
    barcode: '00010005',
    accent: '#9ED7B6',
  },
  {
    sku: 'choco-bar',
    name: 'Dark chocolate bar',
    category: 'Treats',
    priceCents: 225,
    barcode: '00010006',
    accent: '#CDA78A',
  },
];

export const fetchCatalog = async (): Promise<Product[]> => {
  await new Promise((resolve) => setTimeout(resolve, 180));
  return generatedCatalog;
};
