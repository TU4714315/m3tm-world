/** Classify only explicit publisher labels, never location/colour or assumed inventory. */
export function publishedAreaAffiliation(name: string): 'houthi' | 'government' | 'other' {
  if (/\b(?:ansar\s*allah|houthis?)\b|انصار\s*الله|أنصار\s*الله|الحوث/i.test(name)) return 'houthi';
  if (/\bhadi\b|yemen(?:i)?\s+government|presidential leadership council|الحكومة اليمنية|مجلس القيادة الرئاسي/i.test(name)) return 'government';
  return 'other';
}
export function publishedEquipmentSymbol(name: string): string | null {
  if (/\btanks?\b|دباب(?:ة|ات)/i.test(name)) return 'tank';
  if (/\bartillery\b|مدفعية/i.test(name)) return 'artillery';
  if (/\bradar\b|رادار/i.test(name)) return 'radar';
  if (/\bmissile\b|صاروخ/i.test(name)) return 'missile';
  if (/\b(?:airport|air\s*base|airfield|airstrip)\b|مطار|قاعدة جوية/i.test(name) && !/airport square/i.test(name)) return 'airfield';
  if (/\b(?:port|harbou?r|naval base)\b|ميناء|قاعدة بحرية/i.test(name)) return 'port';
  if (/\b(?:military base|army base|brigade|barracks)\b|معسكر|لواء|ثكنة/i.test(name)) return 'base';
  return null;
}
