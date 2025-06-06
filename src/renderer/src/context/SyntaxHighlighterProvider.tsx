import { useTheme } from '@renderer/context/ThemeProvider'
import { useMermaid } from '@renderer/hooks/useMermaid'
import { useSettings } from '@renderer/hooks/useSettings'
import { CodeCacheService } from '@renderer/services/CodeCacheService'
import { type CodeStyleVarious, ThemeMode } from '@renderer/types'
import { getHighlighter, loadLanguageIfNeeded, loadThemeIfNeeded } from '@renderer/utils/highlighter'
import type React from 'react'
import { createContext, type PropsWithChildren, use, useCallback, useMemo } from 'react'
import { bundledThemes } from 'shiki'

interface SyntaxHighlighterContextType {
  codeToHtml: (code: string, language: string, enableCache: boolean) => Promise<string>
}

const SyntaxHighlighterContext = createContext<SyntaxHighlighterContextType | undefined>(undefined)

export const SyntaxHighlighterProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { theme } = useTheme()
  const { codeStyle } = useSettings()
  useMermaid()

  const highlighterTheme = useMemo(() => {
    if (!codeStyle || codeStyle === 'auto') {
      return theme === ThemeMode.light ? 'one-light' : 'material-theme-darker'
    }

    return codeStyle
  }, [theme, codeStyle])

  const codeToHtml = useCallback(
    async (_code: string, language: string, enableCache: boolean) => {
      {
        if (!_code) return ''

        const key = CodeCacheService.generateCacheKey(_code, language, highlighterTheme)
        const cached = enableCache ? CodeCacheService.getCachedResult(key) : null
        if (cached) return cached

        const languageMap: Record<string, string> = {
          vab: 'vb'
        }

        const mappedLanguage = languageMap[language] || language

        const code = _code?.trimEnd() ?? ''
        const escapedCode = code?.replace(/[<>]/g, (char) => ({ '<': '&lt;', '>': '&gt;' })[char]!)

        try {
          const highlighter = await getHighlighter()

          await loadThemeIfNeeded(highlighter, highlighterTheme)
          await loadLanguageIfNeeded(highlighter, mappedLanguage)

          // 生成高亮HTML
          const html = highlighter.codeToHtml(code, {
            lang: mappedLanguage,
            theme: highlighterTheme
          })

          // 设置缓存
          if (enableCache) {
            CodeCacheService.setCachedResult(key, html, _code.length)
          }

          return html
        } catch (error) {
          console.debug(`Error highlighting code for language '${mappedLanguage}':`, error)
          return `<pre style="padding: 10px"><code>${escapedCode}</code></pre>`
        }
      }
    },
    [highlighterTheme]
  )

  return <SyntaxHighlighterContext value={{ codeToHtml }}>{children}</SyntaxHighlighterContext>
}

export const useSyntaxHighlighter = () => {
  const context = use(SyntaxHighlighterContext)
  if (!context) {
    throw new Error('useSyntaxHighlighter must be used within a SyntaxHighlighterProvider')
  }
  return context
}

export const codeThemes = ['auto', ...Object.keys(bundledThemes)] as CodeStyleVarious[]
