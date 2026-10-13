import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Pin } from '../types'

const pins = atom({ plugin: 'pins', key: 'pins' } as const, [])

const PIN_TOOL = 'mcp__pins__pin'
const UNPIN_TOOL = 'mcp__pins__unpin'

function labelFor(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname.endsWith('slack.com')) return 'Slack thread'
    if (u.hostname === 'github.com') {
      const m = u.pathname.match(/^\/[^/]+\/([^/]+)\/(pull|issues)\/(\d+)/)
      if (m) return `${m[1]}#${m[3]}`
    }
    if (u.hostname.endsWith('atlassian.net')) {
      const m = u.pathname.match(/[A-Z][A-Z0-9]+-\d+/)
      if (m) return m[0]
    }
    return u.hostname + (u.pathname === '/' ? '' : u.pathname)
  } catch {
    return url
  }
}

function iconFor(url: string): string {
  try {
    const host = new URL(url).hostname
    if (host.endsWith('slack.com')) return '💬'
    if (host === 'github.com') return '🐙'
    if (host.endsWith('atlassian.net')) return '🎫'
  } catch {}
  return '📌'
}

function isUrl(text: string): boolean {
  try {
    const u = new URL(text)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

async function addPin($: EngineInterface, url: string, label?: string): Promise<Pin> {
  const pin: Pin = { url, label: label?.trim() || labelFor(url) }
  await update($, pins, list => [...list.filter(p => p.url !== url), pin])
  return pin
}

async function removePins($: EngineInterface, target: string): Promise<Pin[]> {
  const list = await read($, pins)
  const t = target.trim()
  const index = /^\d+$/.test(t) ? Number(t) - 1 : -1
  const removed = t === 'all'
    ? list
    : list.filter((p, i) => i === index || p.url === t || p.label.toLowerCase() === t.toLowerCase())
  if (removed.length) await update($, pins, current => current.filter(p => !removed.some(r => r.url === p.url)))
  return removed
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pin',
      description: 'Pin a link above the prompt: /pin <url> [label]',
      argumentHint: '<url> [label]',
    })
    await $.command.register({
      name: 'unpin',
      description: 'Remove a pin: /unpin <number|label|url|all>',
      argumentHint: '<number|label|url|all>',
    })
    await $.tool.register({
      name: 'pin',
      description:
        'Pin a link in a band above the user\'s prompt for the rest of this session. ' +
        'Use when the user asks to pin something ("pin the slack thread", "pin that PR"): ' +
        'find the URL they mean earlier in the conversation and pass it with a short label ' +
        '(e.g. "PROJ-123 Slack thread", "PR #42"). Pinning the same URL again updates its label.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full http(s) URL to pin' },
          label: { type: 'string', description: 'Short label shown instead of the URL' },
        },
        required: ['url'],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: 'unpin',
      description: 'Remove a pinned link from the band above the prompt, by its URL or label, or "all".',
      inputSchema: {
        type: 'object',
        properties: { target: { type: 'string', description: 'URL, label, or "all"' } },
        required: ['target'],
      },
      isDeferred: false,
    })
    return next(e)
  })

  on('command.run', { command: 'pin' }, async ($, e) => {
    const [url, ...rest] = e.args.trim().split(/\s+/)
    if (!url) {
      const list = await read($, pins)
      return { text: list.length ? list.map((p, i) => `${i + 1}. ${p.label} — ${p.url}`).join('\n') : 'No pins.' }
    }
    if (!isUrl(url)) return { text: `Not a URL: ${url}. Usage: /pin <url> [label]` }
    const pin = await addPin($, url, rest.join(' '))
    return { text: `Pinned ${pin.label}.` }
  })

  on('command.run', { command: 'unpin' }, async ($, e) => {
    const target = e.args.trim()
    if (!target) return { text: 'Usage: /unpin <number|label|url|all>' }
    const removed = await removePins($, target)
    return { text: removed.length ? `Unpinned ${removed.map(p => p.label).join(', ')}.` : `No pin matches "${target}".` }
  })

  on('tool.call', { tool: PIN_TOOL }, async ($, e) => {
    const { url, label } = e as unknown as { url?: string; label?: string }
    if (!url || !isUrl(url)) return { deny: `Not an http(s) URL: ${String(url)}` }
    try {
      const pin = await addPin($, url, label)
      return { result: `Pinned "${pin.label}" (${pin.url}) above the prompt.` }
    } catch (err) {
      return { deny: `Could not pin: ${String(err)}` }
    }
  })

  on('tool.call', { tool: UNPIN_TOOL }, async ($, e) => {
    const { target } = e as unknown as { target?: string }
    let removed: Pin[]
    try {
      removed = await removePins($, target ?? '')
    } catch (err) {
      return { deny: `Could not unpin: ${String(err)}` }
    }
    return { result: removed.length ? `Unpinned ${removed.map(p => p.label).join(', ')}.` : `No pin matches "${target}".` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, pins)
    if (e.props.hasSurvey || list.length === 0) return next(e)

    const { Box, Button, Link, Text } = $.ui.resolve(e)
    const beneath = await next(e)

    const row = (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        {list.map(pin => (
          <Box key={`pin-${pin.url}`} flexDirection="row">
            <Text>{iconFor(pin.url)} </Text>
            <Link href={pin.url} label={pin.label} />
            <Button
              key={`unpin-${pin.url}`}
              plain
              label=" ×"
              onPress={() => update($, pins, current => current.filter(p => p.url !== pin.url))}
            />
          </Box>
        ))}
      </Box>
    )

    return (
      <Box flexDirection="column">
        {row}
        {beneath}
      </Box>
    )
  })
}
