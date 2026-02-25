export const EXPENSE_CATEGORIES = [
  "Travel",
  "Office Supplies",
  "Gift",
  "Meals & Entertainment",
  "Dues",
  "Conference",
  "Uniform",
  "Parking",
  "Accounting Fees",
  "Capital Expenses / Equipment",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
