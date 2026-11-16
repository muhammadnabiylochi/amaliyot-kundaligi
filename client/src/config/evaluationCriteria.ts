export interface EvaluationCriterionConfig {
  key: string;
  name: string;
  description: string;
  maxScore: number;
}

export const EVALUATION_CRITERIA: readonly EvaluationCriterionConfig[] = [
  {
    key: 'professionalSkills',
    name: 'Kasbiy bilim va ko‘nikmalar',
    description: 'Amaliyot davomida namoyish etilgan nazariy bilimlar, amaliy kasbiy ko‘nikmalar va yangi bilimlarni o‘zlashtirish',
    maxScore: 30,
  },
  {
    key: 'taskQuality',
    name: 'Topshiriqlarni bajarish sifati',
    description: 'Biriktirilgan amaliy vazifa va topshiriqlarning sifatli, to‘liq, aniq va mustaqil bajarilishi',
    maxScore: 25,
  },
  {
    key: 'workEthic',
    name: 'Mas’uliyat va intizom',
    description: 'Korxona ichki mehnat tartibi, mehnat muhofazasi va kasbiy etika qoidalariga rioya qilish, mas’uliyatlilik',
    maxScore: 15,
  },
  {
    key: 'attendance',
    name: 'Davomat',
    description: 'Amaliyot joyiga o‘z vaqtida kelish, ish soatlariga to‘liq rioya qilish va faol ishtirok etish darajasi',
    maxScore: 15,
  },
  {
    key: 'diaryQuality',
    name: 'Kundalik va yakuniy hisobot sifati',
    description: 'Kundalik daftarni muntazam va sifatli yuritish, topshiriqlar bayoni hamda yakuniy hisobotning puxtaligi',
    maxScore: 15,
  },
] as const;

export const TOTAL_MAX_SCORE = 100;

export const CRITERIA_MAP = new Map<string, EvaluationCriterionConfig>(
  EVALUATION_CRITERIA.map((c) => [c.key, c])
);
