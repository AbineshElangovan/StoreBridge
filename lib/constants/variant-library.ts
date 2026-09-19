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
    description: "Kid to teen age progression in years (1Y to 18Y)",
    suggestedValues: [
      "1Y", "2Y", "3Y", "4Y", "5Y", "6Y", "7Y", "8Y", "9Y", "10Y", "11Y", "12Y",
      "13Y", "14Y", "15Y", "16Y", "17Y", "18Y"
    ]
  },
  {
    id: "age",
    name: "Age / Age Group",
    description: "Infant, Toddler, Child, Teen (0M to 18Y) & Adult",
    suggestedValues: [
      "0M", "1M", "2M", "3M", "6M", "9M", "12M",
      "1Y", "2Y", "3Y", "4Y", "5Y", "6Y", "7Y", "8Y", "9Y", "10Y", "11Y", "12Y",
      "13Y", "14Y", "15Y", "16Y", "17Y", "18Y",
      "Adult"
    ]
  },
  {
    id: "size",
    name: "Clothing Size",
    description: "Standard alpha clothing sizes",
    suggestedValues: ["2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "Free Size"]
  },
  {
    id: "shoe_size",
    name: "Shoe Size",
    description: "Footwear sizing standards",
    suggestedValues: [
      "US 5", "US 6", "US 7", "US 8", "US 9", "US 10", "US 11", "US 12",
      "UK 4", "UK 5", "UK 6", "UK 7", "UK 8", "UK 9", "UK 10",
      "EU 36", "EU 37", "EU 38", "EU 39", "EU 40", "EU 41", "EU 42", "EU 43", "EU 44"
    ]
  },
  {
    id: "waist",
    name: "Waist Size",
    description: "Numeric waist measurements (inches)",
    suggestedValues: ["26", "28", "30", "32", "34", "36", "38", "40"]
  },
  {
    id: "inseam",
    name: "Inseam Length",
    description: "Trouser/pant leg inseam measurements",
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
    suggestedValues: ["100% Cotton", "Linen", "Leather", "Polyester", "Wool", "Denim", "Silk", "Spandex Blend"]
  },
  {
    id: "fit",
    name: "Fit",
    description: "Garment silhouette and cut",
    suggestedValues: ["Slim Fit", "Regular Fit", "Relaxed Fit", "Oversized", "Tailored Fit", "Skinny Fit"]
  },
  {
    id: "sleeve",
    name: "Sleeve Length",
    description: "Sleeve style and cut",
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
    suggestedValues: ["Casual", "Formal", "Sports", "Party", "Workwear", "Streetwear", "Ethnic"]
  },
  {
    id: "season",
    name: "Season",
    description: "Collection seasonality",
    suggestedValues: ["Spring", "Summer", "Autumn", "Winter", "All-Season"]
  },
  {
    id: "pack_size",
    name: "Pack Size",
    description: "Quantity per retail unit",
    suggestedValues: ["Single Unit", "Pack of 2", "Pack of 3", "Pack of 5"]
  },
  {
    id: "capacity",
    name: "Capacity / Volume",
    description: "Volume measurements",
    suggestedValues: ["250ml", "500ml", "750ml", "1L", "2L"]
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
    id: "tops",
    name: "Shirts / T-Shirts / Tops",
    suggestedOptionNames: ["Age", "Size", "Gender", "Color", "Material", "Fit", "Sleeve Length", "Neck Type", "Pattern"]
  },
  {
    id: "bottoms",
    name: "Pants / Jeans / Shorts",
    suggestedOptionNames: ["Age", "Waist Size", "Length", "Inseam", "Fit", "Color", "Material", "Wash"]
  },
  {
    id: "dresses",
    name: "Dresses / Skirts",
    suggestedOptionNames: ["Age", "Size", "Gender", "Color", "Material", "Length", "Fit", "Neckline", "Pattern"]
  },
  {
    id: "innerwear",
    name: "Innerwear / Sleepwear",
    suggestedOptionNames: ["Age", "Size", "Gender", "Color", "Material", "Waist Size", "Style", "Pack Size"]
  },
  {
    id: "footwear",
    name: "Shoes / Sneakers / Sandals",
    suggestedOptionNames: ["Age", "Shoe Size", "Gender", "Color", "Upper Material", "Sole Material", "Width", "Closure"]
  },
  {
    id: "socks",
    name: "Socks",
    suggestedOptionNames: ["Age", "Size", "Shoe Size", "Gender", "Color", "Material", "Length", "Pack Size"]
  },
  {
    id: "outerwear",
    name: "Jackets / Coats / Hoodies",
    suggestedOptionNames: ["Age", "Size", "Gender", "Color", "Material", "Fit", "Hood", "Closure"]
  },
  {
    id: "activewear",
    name: "Swimwear / Activewear",
    suggestedOptionNames: ["Age", "Size", "Gender", "Color", "Material", "Fit", "Style", "Sports Type"]
  },
  {
    id: "accessories",
    name: "Caps / Hats / Belts / Bags",
    suggestedOptionNames: ["Age", "Size", "Gender", "Color", "Material", "Width", "Capacity", "Closure"]
  }
];
