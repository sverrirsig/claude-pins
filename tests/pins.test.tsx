import { describe, expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'pins',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { top: 0, bodyRows: 9 } },
} as const

const run = (command: string, args = '') =>
  ({ command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } }) as const

const SLACK = 'https://upwind.slack.com/archives/C123/p1700000000000100'

describe('pins', () => {
  test('the model pins a link and the band shows it', async $ => {
    const { result } = await $.tool.call({ tool: 'mcp__pins__pin', url: SLACK, label: 'UP-8519 thread' } as never)
    expect(String(result)).toContain('UP-8519 thread')

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

  test('the × button unpins', async $ => {
    await $.command.run(run('pin', `${SLACK} thread`))
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
    await ui.press({ key: `unpin-${SLACK}` } as never)
    expect((await $.command.run(run('pin'))).text).toBe('No pins.')
    await ui.unmount()
  })

  test('each pin shows its host icon', async $ => {
    await $.command.run(run('pin', SLACK))
    await $.command.run(run('pin', 'https://github.com/upwindsecurity/app/pull/3443'))
    await $.command.run(run('pin', 'https://upwind.atlassian.net/browse/UP-8519'))
    await $.command.run(run('pin', 'https://example.com/doc'))
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' } as never)
    for (const icon of ['💬', '🐙', '🎫', '📌']) {
      expect(await ui.find({ type: 'Text', text: new RegExp(icon) } as never)).toBeDefined()
    }
    await ui.unmount()
  })

  test('a non-URL is refused', async $ => {
    const res = await $.command.run(run('pin', 'not-a-link'))
    expect(res.text).toContain('Not a URL')
  })
})
