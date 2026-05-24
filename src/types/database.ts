export type Unit = 'g' | 'kg' | 'ml' | 'dl' | 'l' | 'stk' | 'boks' | 'pose' | 'flaske' | 'pk'

export type RecipeCategory =
  | 'hverdagsmat'
  | 'fisk'
  | 'vegetar'
  | 'kylling'
  | 'helgemat'
  | 'søndagsmiddag'
  | 'selskapsmat'

export type Weekday = 'mandag' | 'tirsdag' | 'onsdag' | 'torsdag' | 'fredag' | 'lørdag' | 'søndag'

export type ShoppingListType = 'hoved' | 'ekstra'

export type MemberRole = 'voksen' | 'barn'

// ─── Households ────────────────────────────────────────────────────────────

export type Household = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type HouseholdMember = {
  id: string
  household_id: string
  name: string
  role: MemberRole
  birth_year: number | null
  gender: 'gutt' | 'jente' | 'mann' | 'kvinne' | null
  created_at: string
}

export type HouseholdSettings = {
  id: string
  household_id: string
  weekly_budget: number | null
  fish_days_per_week: number
  always_vegetables: boolean
  shopping_days: Weekday[]
  special_days: Weekday[]
  created_at: string
  updated_at: string
}

// ─── Ingredients ───────────────────────────────────────────────────────────

export type Ingredient = {
  id: string
  household_id: string
  name: string
  category: string | null
  default_unit: Unit
  created_at: string
}

export type IngredientPrice = {
  id: string
  ingredient_id: string
  price_per_unit: number
  unit: Unit
  source: 'manual' | 'oda' | null
  updated_at: string
}

// ─── Recipes ───────────────────────────────────────────────────────────────

export type Recipe = {
  id: string
  household_id: string
  name: string
  description: string | null
  source_url: string | null
  servings: number
  prep_time_minutes: number | null
  category: RecipeCategory
  image_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type RecipeIngredient = {
  id: string
  recipe_id: string
  ingredient_id: string
  amount: number
  unit: Unit
  note: string | null
}

export type RecipeRating = {
  id: string
  recipe_id: string
  member_id: string
  score: 1 | 2 | 3 | 4 | 5
  rated_at: string
}

// ─── Meal plans ────────────────────────────────────────────────────────────

export type MealPlan = {
  id: string
  household_id: string
  week_number: number
  year: number
  weekday: Weekday
  recipe_id: string | null
  is_special_day: boolean
  note: string | null
  created_at: string
  updated_at: string
}

// ─── Lunchbox plans ────────────────────────────────────────────────────────

export type LunchboxPlan = {
  id: string
  household_id: string
  member_id: string
  weekday: Weekday
  week_number: number
  year: number
  num_lunchboxes: number
  num_fruit: number
}

// ─── Pantry ────────────────────────────────────────────────────────────────

export type PantryItem = {
  id: string
  household_id: string
  ingredient_id: string
  amount: number
  unit: Unit
  expiry_date: string | null
  updated_at: string
}

// ─── Shopping lists ────────────────────────────────────────────────────────

export type ShoppingList = {
  id: string
  household_id: string
  list_date: string
  list_type: ShoppingListType
  week_number: number | null
  year: number | null
  status: 'aktiv' | 'kjøpt' | 'arkivert'
  created_at: string
  updated_at: string
}

export type ShoppingListItem = {
  id: string
  list_id: string
  ingredient_id: string
  amount: number
  unit: Unit
  estimated_price: number | null
  is_bought: boolean
  sort_order: number
}

// ─── Budgets ───────────────────────────────────────────────────────────────

export type Budget = {
  id: string
  household_id: string
  week_number: number
  year: number
  planned_amount: number | null
  actual_amount: number | null
  created_at: string
  updated_at: string
}

// ─── Extended (with joins) ─────────────────────────────────────────────────

export type RecipeWithIngredients = Recipe & {
  recipe_ingredients: (RecipeIngredient & { ingredient: Ingredient })[]
  avg_rating: number | null
  rating_count: number
}

export type ShoppingListWithItems = ShoppingList & {
  items: (ShoppingListItem & { ingredient: Ingredient & { price?: IngredientPrice } })[]
}

export type MealPlanWithRecipe = MealPlan & {
  recipe: RecipeWithIngredients | null
}

export type PantryItemWithIngredient = PantryItem & {
  ingredient: Ingredient & { price?: IngredientPrice }
}

// ─── Database type ─────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      households: {
        Row: Household
        Insert: Omit<Household, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Household, 'id' | 'created_at'>>
        Relationships: []
      }
      household_members: {
        Row: HouseholdMember
        Insert: Omit<HouseholdMember, 'id' | 'created_at'>
        Update: Partial<Omit<HouseholdMember, 'id' | 'created_at'>>
        Relationships: []
      }
      household_settings: {
        Row: HouseholdSettings
        Insert: Omit<HouseholdSettings, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<HouseholdSettings, 'id' | 'created_at'>>
        Relationships: []
      }
      ingredients: {
        Row: Ingredient
        Insert: Omit<Ingredient, 'id' | 'created_at'>
        Update: Partial<Omit<Ingredient, 'id' | 'created_at'>>
        Relationships: []
      }
      ingredient_prices: {
        Row: IngredientPrice
        Insert: Omit<IngredientPrice, 'id'>
        Update: Partial<Omit<IngredientPrice, 'id'>>
        Relationships: []
      }
      recipes: {
        Row: Recipe
        Insert: Omit<Recipe, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Recipe, 'id' | 'created_at'>>
        Relationships: []
      }
      recipe_ingredients: {
        Row: RecipeIngredient
        Insert: Omit<RecipeIngredient, 'id'>
        Update: Partial<Omit<RecipeIngredient, 'id'>>
        Relationships: []
      }
      recipe_ratings: {
        Row: RecipeRating
        Insert: Omit<RecipeRating, 'id'>
        Update: Partial<Omit<RecipeRating, 'id'>>
        Relationships: []
      }
      meal_plans: {
        Row: MealPlan
        Insert: Omit<MealPlan, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<MealPlan, 'id' | 'created_at'>>
        Relationships: []
      }
      lunchbox_plans: {
        Row: LunchboxPlan
        Insert: Omit<LunchboxPlan, 'id'>
        Update: Partial<Omit<LunchboxPlan, 'id'>>
        Relationships: []
      }
      pantry_items: {
        Row: PantryItem
        Insert: Omit<PantryItem, 'id' | 'updated_at'>
        Update: Partial<Omit<PantryItem, 'id'>>
        Relationships: []
      }
      shopping_lists: {
        Row: ShoppingList
        Insert: Omit<ShoppingList, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ShoppingList, 'id' | 'created_at'>>
        Relationships: []
      }
      shopping_list_items: {
        Row: ShoppingListItem
        Insert: Omit<ShoppingListItem, 'id'>
        Update: Partial<Omit<ShoppingListItem, 'id'>>
        Relationships: []
      }
      budgets: {
        Row: Budget
        Insert: Omit<Budget, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Budget, 'id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      my_household_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
