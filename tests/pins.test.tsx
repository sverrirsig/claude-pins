import { describe, expect, test } from 'claude-code/testing'
import type { Register } from 'claude-code'

const BAND = {
  plugin: 'pins',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { top: 0, bodyRows: 9 } },
} as const

const run = (command: string, args = '') =>
  ({ command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } }) as const

type On = Parameters<Register>[0]

const bandBeneath = (on: On, text?: string) =>
  on('ui.render', { component: 'AbovePrompt' }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    return text ? <Text key="other">{text}</Text> : <Box />
  })

const SLACK = 'https://acme.slack.com/archives/C0000000000/p1700000000000100'

describe('pins', () => {
  test('the model pins a link and the band shows it', async ($, on: On) => {
    bandBeneath(on)
    const { result } = await $.tool.call({ tool: 'mcp__pins__pin', url: SLACK, label: 'PROJ-123 thread' } as never)
    expect(String(result)).toContain('PROJ-123 thread')

    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...BAND, surface } as never)
      expect(await ui.find({ type: 'Link' } as never)).toBeDefined()
      await ui.unmount()
    }
  })

  test('/pin labels a Slack link and /unpin removes it', async $ => {
    const pinned = await $.command.run(run('pin', SLACK))
    expect(pinned.text).toBe('Pinned Slack thread.')

    const listed = await $.command.run(run('pin'))
    expect(listed.text).toContain(SLACK)

    const unpinned = await $.command.run(run('unpin', '1'))
    expect(unpinned.text).toBe('Unpinned Slack thread.')
    expect((await $.command.run(run('pin'))).text).toBe('No pins.')
  })

  test('the × button unpins', async ($, on: On) => {
    bandBeneath(on)
    await $.command.run(run('pin', `${SLACK} thread`))
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
    await ui.press({ key: `unpin-${SLACK}` } as never)
    expect((await $.command.run(run('pin'))).text).toBe('No pins.')
    await ui.unmount()
  })

  test('each pin shows its host icon', async ($, on: On) => {
    bandBeneath(on)
    await $.command.run(run('pin', SLACK))
    await $.command.run(run('pin', 'https://github.com/acme/web/pull/42'))
    await $.command.run(run('pin', 'https://acme.atlassian.net/browse/PROJ-123'))
    await $.command.run(run('pin', 'https://example.com/doc'))
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
    for (const icon of ['💬', '🐙', '🎫', '📌']) {
      expect(await ui.find({ type: 'Text', text: new RegExp(icon) } as never)).toBeDefined()
    }
    await ui.unmount()
  })

  test('pins sit above what other plugins draw in the band', async ($, on: On) => {
    bandBeneath(on, 'another plugin')
    await $.command.run(run('pin', SLACK))
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
    expect(await ui.find({ type: 'Link' } as never)).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /another plugin/ } as never)).toBeDefined()
    await ui.unmount()
  })

  test('a non-URL is refused', async $ => {
    const res = await $.command.run(run('pin', 'not-a-link'))
    expect(res.text).toContain('Not a URL')
  })
})
