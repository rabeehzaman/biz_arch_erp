// Indian GST constants

export const GST_SLABS = [0, 5, 12, 18, 28] as const;
export type GSTSlab = (typeof GST_SLABS)[number];

export const INDIAN_STATES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman & Diu",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh (New)",
  "38": "Ladakh",
  "97": "Other Territory",
};

export interface HSNEntry {
  code: string;
  description: string;
  defaultRate: number;
}

export const COMMON_HSN_CODES: HSNEntry[] = [
  // Food & beverages
  { code: "0402", description: "Milk and cream", defaultRate: 5 },
  { code: "0901", description: "Coffee", defaultRate: 5 },
  { code: "0902", description: "Tea", defaultRate: 5 },
  { code: "1006", description: "Rice", defaultRate: 5 },
  { code: "1101", description: "Wheat flour", defaultRate: 5 },
  { code: "1507", description: "Soybean oil", defaultRate: 5 },
  { code: "1701", description: "Sugar", defaultRate: 5 },
  { code: "2201", description: "Water (packaged)", defaultRate: 18 },
  { code: "2202", description: "Aerated drinks", defaultRate: 28 },

  // Textiles
  { code: "5208", description: "Woven cotton fabrics", defaultRate: 5 },
  { code: "6109", description: "T-shirts, singlets", defaultRate: 5 },
  { code: "6203", description: "Men's suits, trousers", defaultRate: 12 },
  { code: "6204", description: "Women's suits, dresses", defaultRate: 12 },

  // Electronics & electrical
  { code: "8471", description: "Computers & peripherals", defaultRate: 18 },
  { code: "8517", description: "Telephones, smartphones", defaultRate: 18 },
  { code: "8528", description: "Monitors, TVs", defaultRate: 18 },
  { code: "8507", description: "Batteries", defaultRate: 28 },

  // Furniture
  { code: "9401", description: "Seats and chairs", defaultRate: 18 },
  { code: "9403", description: "Other furniture", defaultRate: 18 },

  // Stationery
  { code: "4820", description: "Registers, notebooks", defaultRate: 12 },
  { code: "4802", description: "Paper (uncoated)", defaultRate: 12 },
  { code: "9608", description: "Pens", defaultRate: 18 },

  // Automobile
  { code: "8703", description: "Motor cars", defaultRate: 28 },
  { code: "8711", description: "Motorcycles", defaultRate: 28 },
  { code: "4011", description: "Tyres", defaultRate: 28 },

  // Pharma & health
  { code: "3004", description: "Medicaments", defaultRate: 12 },
  { code: "3006", description: "Pharmaceutical goods", defaultRate: 12 },

  // Construction
  { code: "2523", description: "Cement", defaultRate: 28 },
  { code: "7214", description: "Iron/steel bars", defaultRate: 18 },
  { code: "6802", description: "Marble, stone", defaultRate: 28 },

  // Services (SAC codes)
  { code: "9954", description: "Construction services", defaultRate: 18 },
  { code: "9961", description: "Financial services", defaultRate: 18 },
  { code: "9971", description: "Professional services", defaultRate: 18 },
  { code: "9972", description: "Real estate services", defaultRate: 18 },
  { code: "9973", description: "Leasing/rental services", defaultRate: 18 },
  { code: "9981", description: "Telecommunications", defaultRate: 18 },
  { code: "9982", description: "IT services", defaultRate: 18 },
  { code: "9983", description: "Research & development", defaultRate: 18 },
  { code: "9985", description: "Support services", defaultRate: 18 },
  { code: "9986", description: "Editorial & publishing", defaultRate: 18 },
  { code: "9988", description: "Manufacturing services", defaultRate: 18 },
  { code: "9991", description: "Public admin services", defaultRate: 18 },
  { code: "9992", description: "Education services", defaultRate: 0 },
  { code: "9993", description: "Healthcare services", defaultRate: 0 },
  { code: "9995", description: "Recreation & sports", defaultRate: 18 },
  { code: "9996", description: "Personal services", defaultRate: 18 },
  { code: "9997", description: "Government services", defaultRate: 0 },

  // Cosmetics & personal care
  { code: "3301", description: "Essential oils", defaultRate: 18 },
  { code: "3304", description: "Beauty/makeup preparations", defaultRate: 28 },
  { code: "3305", description: "Hair preparations", defaultRate: 18 },
  { code: "3306", description: "Oral hygiene preparations", defaultRate: 18 },
  { code: "3401", description: "Soap", defaultRate: 18 },

  // Plastic goods
  { code: "3923", description: "Plastic containers", defaultRate: 18 },
  { code: "3924", description: "Plastic tableware", defaultRate: 18 },

  // General goods
  { code: "7013", description: "Glassware", defaultRate: 18 },
  { code: "7323", description: "Iron/steel household articles", defaultRate: 18 },
  { code: "8414", description: "Air conditioning machines", defaultRate: 28 },
  { code: "8418", description: "Refrigerators", defaultRate: 18 },
  { code: "8422", description: "Dish washing machines", defaultRate: 18 },
  { code: "8450", description: "Washing machines", defaultRate: 18 },
  { code: "8516", description: "Electric heaters, ovens", defaultRate: 18 },
];
