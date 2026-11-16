/**
 * Shared date validation helpers for diary entries and internship timelines.
 */

export interface InternshipDateCheckTarget {
  id?: string;
  startDate: Date;
  endDate: Date;
  status: string;
}

export interface DateValidationResult {
  valid: boolean;
  message?: string;
  entryDateObj?: Date;
  entryDateStr?: string;
}

/**
 * Formats a Date object as a UTC YYYY-MM-DD string.
 */
export function toUtcDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Validates a diary entry date against business rules:
 * 1. Internship status must be ACTIVE (otherwise 400).
 * 2. entryDate must not be in the future (compare date-only, UTC).
 * 3. entryDate must be within the internship's [startDate, endDate] inclusive (compare date-only, UTC).
 */
export function validateDiaryEntryDate(
  entryDateInput: string | Date,
  internship: InternshipDateCheckTarget
): DateValidationResult {
  // 1. Internship status must be ACTIVE
  if (internship.status !== 'ACTIVE') {
    return {
      valid: false,
      message: `Faqat faol (ACTIVE) amaliyot uchun kundalik yozuvi yaratish yoki tahrirlash mumkin. Joriy amaliyot holati: ${internship.status}`,
    };
  }

  let entryDateStr: string;
  let entryDateObj: Date;

  if (typeof entryDateInput === 'string') {
    entryDateStr = entryDateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDateStr)) {
      return { valid: false, message: "Sana YYYY-MM-DD formatida bo'lishi kerak" };
    }
    const [y, m, d] = entryDateStr.split('-').map(Number);
    entryDateObj = new Date(Date.UTC(y, m - 1, d));
    if (
      isNaN(entryDateObj.getTime()) ||
      entryDateObj.getUTCFullYear() !== y ||
      entryDateObj.getUTCMonth() + 1 !== m ||
      entryDateObj.getUTCDate() !== d
    ) {
      return { valid: false, message: "Noto'g'ri sana kiritildi" };
    }
  } else if (entryDateInput instanceof Date) {
    if (isNaN(entryDateInput.getTime())) {
      return { valid: false, message: "Noto'g'ri sana kiritildi" };
    }
    entryDateStr = toUtcDateString(entryDateInput);
    const [y, m, d] = entryDateStr.split('-').map(Number);
    entryDateObj = new Date(Date.UTC(y, m - 1, d));
  } else {
    return { valid: false, message: "Sana kiritilishi shart" };
  }

  // 2. entryDate must not be in the future (compare date-only, UTC)
  const todayUtcStr = toUtcDateString(new Date());
  if (entryDateStr > todayUtcStr) {
    return {
      valid: false,
      message: "Kundalik sanasi kelajakdagi sana bo'lishi mumkin emas",
    };
  }

  // 3. entryDate must be within the internship's [startDate, endDate] inclusive
  const startDateStr = toUtcDateString(internship.startDate);
  const endDateStr = toUtcDateString(internship.endDate);

  if (entryDateStr < startDateStr || entryDateStr > endDateStr) {
    return {
      valid: false,
      message: `Kundalik sanasi amaliyot davriga (${startDateStr} dan ${endDateStr} gacha) to'g'ri kelishi shart`,
    };
  }

  return {
    valid: true,
    entryDateObj,
    entryDateStr,
  };
}
