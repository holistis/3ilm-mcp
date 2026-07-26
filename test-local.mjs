/**
 * test-local.mjs — smoke test for the 3ilm MCP server.
 * Spawns the server via stdio, sends MCP JSON-RPC requests, checks responses.
 */
import { spawn } from 'child_process'
import { createInterface } from 'readline'

const PASS = '✅'
const FAIL = '❌'
let failed = 0

function send(proc, msg) {
  proc.stdin.write(JSON.stringify(msg) + '\n')
}

async function waitForResponse(rl, id, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for id=${id}`)), timeoutMs)
    const handler = (line) => {
      try {
        const msg = JSON.parse(line)
        if (msg.id === id) {
          clearTimeout(t)
          rl.removeListener('line', handler)
          resolve(msg)
        }
      } catch {}
    }
    rl.on('line', handler)
  })
}

async function run() {
  const proc = spawn('node', ['dist/index.js'], {
    cwd: 'C:/Code/3ilm-mcp',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  proc.stderr.on('data', (d) => {
    const msg = d.toString().trim()
    if (msg) console.error('[server stderr]', msg)
  })

  const rl = createInterface({ input: proc.stdout })

  // ── Test 1: initialize ──────────────────────────────────────────────────────
  send(proc, {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0' },
    },
  })
  const init = await waitForResponse(rl, 1)
  const t1 = init?.result?.serverInfo?.name === '3ilm'
  console.log(`${t1 ? PASS : FAIL} initialize — serverInfo.name = ${init?.result?.serverInfo?.name}`)
  if (!t1) failed++

  // Send initialized notification
  send(proc, { jsonrpc: '2.0', method: 'notifications/initialized', params: {} })

  // ── Test 2: tools/list ─────────────────────────────────────────────────────
  send(proc, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
  const toolsList = await waitForResponse(rl, 2)
  const tools = toolsList?.result?.tools ?? []
  const toolNames = tools.map(t => t.name)
  const t2 = toolNames.includes('search_vulnerabilities') &&
             toolNames.includes('get_pattern_details') &&
             toolNames.includes('list_patterns')
  console.log(`${t2 ? PASS : FAIL} tools/list — found: ${toolNames.join(', ')}`)
  if (!t2) failed++

  // ── Test 3: list_patterns ──────────────────────────────────────────────────
  send(proc, {
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'list_patterns', arguments: {} },
  })
  const patternsRes = await waitForResponse(rl, 3)
  const patternsText = patternsRes?.result?.content?.[0]?.text ?? ''
  const t3 = patternsText.includes('oracle-manipulation') && patternsText.includes('reentrancy')
  console.log(`${t3 ? PASS : FAIL} list_patterns — contains oracle-manipulation + reentrancy`)
  if (!t3) { console.log('  got:', patternsText.slice(0, 200)); failed++ }

  // ── Test 4: search_vulnerabilities ────────────────────────────────────────
  send(proc, {
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'search_vulnerabilities', arguments: { query: 'oracle price manipulation' } },
  })
  const searchRes = await waitForResponse(rl, 4)
  const searchText = searchRes?.result?.content?.[0]?.text ?? ''
  const t4 = searchText.includes('oracle-manipulation') && searchText.toLowerCase().includes('acceptance')
  console.log(`${t4 ? PASS : FAIL} search "oracle price manipulation" — hits oracle-manipulation pattern`)
  if (!t4) { console.log('  got:', searchText.slice(0, 300)); failed++ }

  // ── Test 5: get_pattern_details ────────────────────────────────────────────
  send(proc, {
    jsonrpc: '2.0', id: 5, method: 'tools/call',
    params: { name: 'get_pattern_details', arguments: { pattern: 'reentrancy' } },
  })
  const detailRes = await waitForResponse(rl, 5)
  const detailText = detailRes?.result?.content?.[0]?.text ?? ''
  const t5 = detailText.includes('Acceptance rate') && detailText.includes('%')
  console.log(`${t5 ? PASS : FAIL} get_pattern_details(reentrancy) — includes acceptance rate`)
  if (!t5) { console.log('  got:', detailText.slice(0, 200)); failed++ }

  // ── Test 6: unknown query returns helpful message ──────────────────────────
  send(proc, {
    jsonrpc: '2.0', id: 6, method: 'tools/call',
    params: { name: 'search_vulnerabilities', arguments: { query: 'xyznotapattern' } },
  })
  const unknownRes = await waitForResponse(rl, 6)
  const unknownText = unknownRes?.result?.content?.[0]?.text ?? ''
  const t6 = unknownText.includes('Available patterns') || unknownText.includes('No patterns')
  console.log(`${t6 ? PASS : FAIL} unknown query — returns helpful message with available patterns`)
  if (!t6) failed++

  proc.kill()

  console.log(`\n${ failed === 0 ? '✅ ALL TESTS PASSED' : `❌ ${failed} TESTS FAILED` }`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch((e) => { console.error('Test crash:', e.message); process.exit(1) })
