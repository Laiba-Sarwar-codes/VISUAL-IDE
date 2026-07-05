// tests/component/PageHeader.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PageHeader from '~/components/app-shell/PageHeader.vue'

describe('PageHeader', () => {
  it('renders the title and description', () => {
    const wrapper = mount(PageHeader, {
      props: {
        icon: { template: '<svg />' },
        title: 'AI Workflow',
        description: 'Describe what you want to create.',
      },
    })
    expect(wrapper.find('.page-header-title').text()).toBe('AI Workflow')
    expect(wrapper.find('.page-header-desc').text()).toBe('Describe what you want to create.')
  })

  it('omits the description paragraph when none is given', () => {
    const wrapper = mount(PageHeader, {
      props: { icon: { template: '<svg />' }, title: 'Settings' },
    })
    expect(wrapper.find('.page-header-desc').exists()).toBe(false)
  })

  it('emits "back" when the back button is clicked', async () => {
    const wrapper = mount(PageHeader, {
      props: { icon: { template: '<svg />' }, title: 'Settings' },
    })
    await wrapper.find('.back-btn').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('renders the actions slot', () => {
    const wrapper = mount(PageHeader, {
      props: { icon: { template: '<svg />' }, title: 'Plugins' },
      slots: { actions: '<span class="my-action">3</span>' },
    })
    expect(wrapper.find('.my-action').text()).toBe('3')
  })
})
