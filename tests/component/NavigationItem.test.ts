// tests/component/NavigationItem.test.ts
// First Vue component tests in this repo (per the UI redesign plan).
// Kept intentionally small: NavigationItem/PageHeader/ThemeToggle have no
// dependency on the canvas/CRDT/worker singletons, so they're safe and fast
// to mount directly — unlike AppShell/AppSidebar, which pull in the full
// editor (canvas, workers, WebRTC) and are exercised by manual browser
// verification instead.
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NavigationItem from '~/components/app-shell/NavigationItem.vue'

describe('NavigationItem', () => {
  it('renders the label and reflects the active state', () => {
    const wrapper = mount(NavigationItem, {
      props: { icon: { template: '<svg />' }, label: 'Canvas', active: true },
    })
    expect(wrapper.text()).toContain('Canvas')
    expect(wrapper.attributes('aria-current')).toBe('page')
    expect(wrapper.classes()).toContain('active')
  })

  it('is not aria-current when inactive', () => {
    const wrapper = mount(NavigationItem, {
      props: { icon: { template: '<svg />' }, label: 'Canvas', active: false },
    })
    expect(wrapper.attributes('aria-current')).toBeUndefined()
  })

  it('hides the text label and shows a title tooltip when collapsed', () => {
    const wrapper = mount(NavigationItem, {
      props: { icon: { template: '<svg />' }, label: 'Canvas', active: false, collapsed: true },
    })
    expect(wrapper.find('.nav-label').exists()).toBe(false)
    expect(wrapper.attributes('title')).toBe('Canvas')
  })

  it('emits "activate" on click', async () => {
    const wrapper = mount(NavigationItem, {
      props: { icon: { template: '<svg />' }, label: 'Canvas', active: false },
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('activate')).toHaveLength(1)
  })

  it('renders a badge when provided', () => {
    const wrapper = mount(NavigationItem, {
      props: { icon: { template: '<svg />' }, label: 'Collaboration', active: false, badge: '●' },
    })
    expect(wrapper.find('.nav-badge').text()).toBe('●')
  })
})
