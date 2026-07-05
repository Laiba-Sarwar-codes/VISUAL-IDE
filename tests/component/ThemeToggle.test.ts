// tests/component/ThemeToggle.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import ThemeToggle from '~/components/app-shell/ThemeToggle.vue'
import { useUIPreferencesStore } from '~/stores/uiPreferences'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('ThemeToggle', () => {
  it('shows the current theme mode label', () => {
    const wrapper = mount(ThemeToggle)
    expect(wrapper.text()).toContain('Dark')
  })

  it('cycles light -> dark -> system -> light on repeated clicks', async () => {
    const prefs = useUIPreferencesStore()
    prefs.setThemeMode('light')
    const wrapper = mount(ThemeToggle)

    expect(wrapper.text()).toContain('Light')
    await wrapper.trigger('click')
    expect(prefs.themeMode).toBe('dark')
    await wrapper.trigger('click')
    expect(prefs.themeMode).toBe('system')
    await wrapper.trigger('click')
    expect(prefs.themeMode).toBe('light')
  })

  it('hides the text label when collapsed', () => {
    const wrapper = mount(ThemeToggle, { props: { collapsed: true } })
    expect(wrapper.find('.theme-label').exists()).toBe(false)
  })
})
