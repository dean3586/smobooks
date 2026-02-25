export const MEAL_TYPES = [
  "Career Planning",
  "Post-OR Debrief",
  "Research Meeting",
  "Mentorship Lunch",
  "Planning Meeting",
  "Wellness Meeting",
  "Career Counselling",
  "Nurse/Admin Treats",
  "Conference Meal",
  "Clinic Lunch",
  "Thank You Dinner",
  "Residency Planning",
] as const;

export const COMMON_PEOPLE = [
  "Admins",
  "LACE",
  "Fellows",
  "Residents",
  "Dr. Collins",
  "Dr. Byrne",
  "Dr. Sarangapani",
  "Dr. Walker",
  "Dr. Goldberg",
  "Dr. Kives",
  "Dr. Yudin",
  "Dr. Drost",
  "Dr. Pascoal",
  "Dr. Shivji",
  "Dr. Freeman",
  "Dr. Teja",
  "Dr. Harding",
  "Dr. Kafouri",
  "Dr. Nensi",
  "Dr. Bodley",
  "Dr. Reddeman",
  "Dr. Shore",
  "Dr. Gold",
  "Dr. Miazga",
  "Dr. Nauth",
] as const;

export const GIFT_RECIPIENTS = [
  "Admins",
  "Residents",
  "Nurses",
  "Colleagues",
  "LACE",
  "Secretary",
  "Dr. Collins",
  "Dr. Byrne",
  "Dr. Nauth",
] as const;

export const GIFT_OCCASIONS = [
  "Thank You",
  "Birthday",
  "Christmas/Holiday",
  "Appreciation",
] as const;

export type PurposeMode = "meal" | "gift" | "custom";

export function buildMealPurpose(
  mealType: string | null,
  people: string[]
): string {
  const parts: string[] = [];

  if (mealType) {
    parts.push(mealType);
  }

  if (people.length > 0) {
    const peopleStr = formatPeopleList(people);
    if (mealType) {
      parts.push(`w/ ${peopleStr}`);
    } else {
      parts.push(peopleStr);
    }
  }

  return parts.join(" ");
}

export function buildGiftPurpose(
  occasion: string | null,
  recipients: string[]
): string {
  const parts: string[] = [];

  if (occasion) {
    parts.push(occasion);
  }

  if (recipients.length > 0) {
    const recipientStr = formatPeopleList(recipients);
    parts.push(occasion ? `for ${recipientStr}` : `Gift for ${recipientStr}`);
  }

  return parts.join(" ");
}

function formatPeopleList(people: string[]): string {
  if (people.length === 1) return people[0];
  if (people.length === 2) return `${people[0]} & ${people[1]}`;
  return `${people.slice(0, -1).join(", ")} & ${people[people.length - 1]}`;
}
