import {
  APP_LANGUAGE_KEY,
  getConfig,
} from '../utils/config.js'
import enMessages from './locales/en.json' with { type: 'json' }
import zhMessages from './locales/zh.json' with { type: 'json' }

export const DEFAULT_LANGUAGE = 'en'
export const SUPPORTED_LANGUAGES = ['en', 'zh']

const PLACEHOLDER_REGEX = /\{(\w+)\}/g

const MESSAGES = {
  en: enMessages,
  zh: zhMessages,
}

function normalizeInputValue(value) {
  return value?.toString().trim().toLowerCase() || ''
}

export function normalizeLanguage(value, fallbackLanguage = DEFAULT_LANGUAGE) {
  const normalizedValue = normalizeInputValue(value)
  return SUPPORTED_LANGUAGES.includes(normalizedValue)
    ? normalizedValue
    : fallbackLanguage
}

export function isLanguageSupported(value) {
  return SUPPORTED_LANGUAGES.includes(normalizeInputValue(value))
}

export function getLanguage() {
  const config = getConfig()
  return normalizeLanguage(config.get(APP_LANGUAGE_KEY))
}

export function setLanguage(language) {
  const normalizedLanguage = normalizeLanguage(language)
  getConfig().set(APP_LANGUAGE_KEY, normalizedLanguage)
  return normalizedLanguage
}

function interpolate(template, params = {}) {
  return template.replace(PLACEHOLDER_REGEX, (_, key) => `${params[key] ?? ''}`)
}

export function t(key, params = {}, language = getLanguage()) {
  const normalizedLanguage = normalizeLanguage(language)
  const template = MESSAGES[normalizedLanguage]?.[key]
    || MESSAGES[DEFAULT_LANGUAGE]?.[key]
    || key
  return interpolate(template, params)
}

export function getLanguageDisplayName(language, displayLanguage = getLanguage()) {
  return t(`lang.name.${normalizeLanguage(language)}`, {}, displayLanguage)
}
