export interface AttributeFamily {
  id: string;
  name: string;
  description: string;
  icon?: string;
  suggestedValues: string[];
}

export interface CategoryPreset {
  id: string;
  name: string;
  icon?: string;
  suggestedOptionNames: string[];
}

export const MASTER_ATTRIBUTE_FAMILIES: AttributeFamily[] = [
  {
    id: "year_group",
    name: "Year / Year Group",
    description: "Age progression in years (1Y to 18Y)",
    suggestedValues: [
      "1Y", "2Y", "3Y", "4Y", "5Y", "6Y", "7Y", "8Y", "9Y", "10Y", "11Y", "12Y",
      "13Y", "14Y", "15Y", "16Y", "17Y", "18Y"
    ]
  },
  {
    id: "age",
    name: "Age / Age Group",
    description: "Standard age groups (0M to 18Y & Adult)",
    suggestedValues: [
      "0M", "1M", "2M", "3M", "6M", "9M", "12M",
      "1Y", "2Y", "3Y", "4Y", "5Y", "6Y", "7Y", "8Y", "9Y", "10Y", "11Y", "12Y",
      "13Y", "14Y", "15Y", "16Y", "17Y", "18Y",
      "Adult"
    ]
  },
  {
    id: "size",
    name: "Size",
    description: "Standard alpha and numeric product sizes",
    suggestedValues: ["2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "Free Size"]
  },
  {
    id: "shoe_size",
    name: "Shoe Size",
    description: "Footwear sizing standards (US, UK, EU)",
    suggestedValues: [
      "US 5", "US 6", "US 7", "US 8", "US 9", "US 10", "US 11", "US 12",
      "UK 4", "UK 5", "UK 6", "UK 7", "UK 8", "UK 9", "UK 10",
      "EU 36", "EU 37", "EU 38", "EU 39", "EU 40", "EU 41", "EU 42", "EU 43", "EU 44"
    ]
  },
  {
    id: "waist",
    name: "Waist Size",
    description: "Numeric waist measurements (inches/cm)",
    suggestedValues: ["26", "28", "30", "32", "34", "36", "38", "40"]
  },
  {
    id: "inseam",
    name: "Inseam Length",
    description: "Inseam leg length measurements (inches/cm)",
    suggestedValues: ["28", "30", "32", "34", "36"]
  },
  {
    id: "color",
    name: "Color",
    description: "Product colorways, tones, and patterns",
    suggestedValues: [
      "Black", "Clear", "Green", "Blue", "Navy", "White", "Gray", "Brown", "Gold", "Red", "Beige",
      "Bronze", "Orange", "Pink", "Purple", "Rose gold", "Silver", "Yellow",
      "Animal", "Camouflage", "Checkered", "Dots", "Floral", "Multicolor", "Plaid", "Rainbow", "Striped", "Geometric"
    ]
  },
  {
    id: "material",
    name: "Material",
    description: "Raw material composition",
    suggestedValues: ["100% Cotton", "Linen", "Leather", "Polyester", "Wool", "Denim", "Silk", "Spandex Blend", "Metal", "Wood", "Plastic", "Glass"]
  },
  {
    id: "fit",
    name: "Fit",
    description: "Product silhouette, cut, or fit style",
    suggestedValues: ["Slim Fit", "Regular Fit", "Relaxed Fit", "Oversized", "Tailored Fit", "Skinny Fit", "Standard"]
  },
  {
    id: "sleeve",
    name: "Sleeve Length",
    description: "Sleeve length and style",
    suggestedValues: ["Sleeveless", "Short Sleeve", "3/4 Sleeve", "Long Sleeve", "Full Sleeve"]
  },
  {
    id: "neck",
    name: "Neck / Collar Type",
    description: "Neckline and collar design",
    suggestedValues: ["Round Neck", "V-Neck", "Polo Collar", "Turtle Neck", "Hooded", "Mandarin Collar"]
  },
  {
    id: "pattern",
    name: "Pattern / Print",
    description: "Visual design pattern",
    suggestedValues: ["Solid", "Striped", "Checked", "Floral", "Graphic Print", "Camouflage", "Polka Dot"]
  },
  {
    id: "gender",
    name: "Gender",
    description: "Target demographic",
    suggestedValues: ["Men", "Women", "Unisex", "Boys", "Girls"]
  },
  {
    id: "style",
    name: "Style / Occasion",
    description: "Usage context and styling",
    suggestedValues: ["Casual", "Formal", "Sports", "Party", "Workwear", "Streetwear", "Ethnic", "Modern", "Classic"]
  },
  {
    id: "season",
    name: "Season",
    description: "Seasonality and release collection",
    suggestedValues: ["Spring", "Summer", "Autumn", "Winter", "All-Season"]
  },
  {
    id: "pack_size",
    name: "Pack Size",
    description: "Quantity per retail unit",
    suggestedValues: ["Single Unit", "Pack of 2", "Pack of 3", "Pack of 5", "Pack of 10"]
  },
  {
    id: "capacity",
    name: "Capacity / Volume",
    description: "Volume and capacity measurements",
    suggestedValues: ["250ml", "500ml", "750ml", "1L", "2L", "5L", "10L"]
  },
  {
    id: "finish",
    name: "Finish / Surface",
    description: "Surface texture or treatment",
    suggestedValues: ["Matte", "Glossy", "Textured", "Brushed", "Satin"]
  }
];

export const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    id: "apparel_general",
    name: "Apparel & Clothing",
    suggestedOptionNames: ["Size", "Color", "Material", "Fit", "Gender", "Pattern"]
  },
  {
    id: "footwear",
    name: "Footwear & Shoes",
    suggestedOptionNames: ["Shoe Size", "Color", "Material", "Gender"]
  },
  {
    id: "accessories",
    name: "Accessories & Bags",
    suggestedOptionNames: ["Size", "Color", "Material", "Capacity", "Style"]
  },
  {
    id: "packaged_goods",
    name: "Multipacks & Bundles",
    suggestedOptionNames: ["Pack Size", "Size", "Color"]
  },
  {
    id: "general_merchandise",
    name: "General Merchandise",
    suggestedOptionNames: ["Size", "Color", "Material", "Finish"]
  }
];
