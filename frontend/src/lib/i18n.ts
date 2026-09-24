/**
 * Internationalization utilities for the Pumpd application.
 *
 * English source strings are the keys; locale files in src/locales/ map them to
 * translations and are lazy-loaded (Vite code-splits each import.meta.glob entry),
 * so the initial bundle stays English-only.
 * Exercise instructions come from separately generated packs in src/instr/ (one per
 * language, from the upstream dataset) — also lazy-loaded on language switch.
 */

import { useSyncExternalStore } from 'react'

// UI languages. de/pt have no instruction pack upstream — instructions fall back to English.
export const LANGS = {
  en: 'English', de: 'Deutsch', es: 'Español', fr: 'Français', it: 'Italiano',
  pt: 'Português', pl: 'Polski', tr: 'Türkçe', ru: 'Русский', zh: '中文',
  ko: '한국어', hi: 'हिन्दी'
}
export const INSTR_LANGS = ['en', 'es', 'fr', 'it', 'tr', 'ru', 'zh', 'hi', 'pl', 'ko']
const DATE_LOCALES = {
  en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', pt: 'pt-PT',
  pl: 'pl-PL', tr: 'tr-TR', ru: 'ru-RU', zh: 'zh-CN', ko: 'ko-KR', hi: 'hi-IN'
}

const localePacks = import.meta.glob('../locales/*.ts')
const instrPacks = import.meta.glob('../instr/*.ts')

let lang = 'en'
let dict: Record<string, string> = {}
let instr: Record<string, string[]> | null = null            // { exId: [steps] } for the current language, null = English
let version = 0
const subs = new Set<() => void>()
const notify = () => { version++; subs.forEach(f => f()) }

export const getLang = () => lang
export const dateLocale = () => DATE_LOCALES[lang] || 'en-GB'

// Translate a source string; {0},{1}… are replaced with args (also on the English fallback).
export function t(s: string, ...args: string[]): string {
  let v = dict[s] || s
  for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
  return v
}
// Instructions for an exercise in the current language (English steps as fallback).
export const instrFor = (ex: { id: string; st?: string[] }) => (instr && instr[ex.id]) || ex.st || []

export async function setLang(l: string) {
  if (!LANGS[l as keyof typeof LANGS]) l = 'en'
  if (l === lang && version > 0) return
  lang = l
  try {
    dict = l === 'en' ? {} : (await localePacks['../locales/' + l + '.ts']()).default
    instr = l === 'en' || !INSTR_LANGS.includes(l) ? null : (await instrPacks['../instr/' + l + '.ts']()).default
  } catch (e) { dict = {}; instr = null }
  notify()
}

// Re-renders the subscribing component (and its children) whenever the language changes.
export function useLang() {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn) }, () => version)
}