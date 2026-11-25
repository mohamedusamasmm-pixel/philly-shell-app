/**
 * Tiny bilingual helper. Strings live inline as tr('عربي', 'English') so each
 * screen stays readable; the language is a persisted store setting.
 */
import { useStore } from '@/data/store';

export const lang = () => useStore.getState().lang;
export const isAr = () => lang() === 'ar';
export const tr = (ar: string, en: string) => (isAr() ? ar : en);

/** Subscribes the component to language changes and returns `tr`. */
export function useT() {
  useStore((s) => s.lang);
  return tr;
}

/** Display name for anything that may carry an English name. */
export const nm = (x: { name: string; nameEn?: string } | undefined | null) =>
  !x ? '' : !isAr() && x.nameEn ? x.nameEn : x.name;

/** Simple English plural: "1 round", "3 rounds". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
