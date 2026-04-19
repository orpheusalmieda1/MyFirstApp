export type FoodItem = {
  id: string;
  name: string;
  quantity: string;
  sugarGrams: number;
};

export type DayData = {
  hadSugar: boolean | null; // null = not yet explicitly chosen (grey)
  foods: FoodItem[];
};

export type AppData = Record<string, DayData>; // key: "YYYY-MM-DD"
