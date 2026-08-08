import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ACTION_COMMANDS, fullCommandList, projectCommands, projectCommandName,
  commandIn, argsIn, expandCommand, invalidCommands,
} from './command-suite'

const PROJECTS = [
  { projectName: 'Scent Sell' },
  { projectName: 'Downscale Weight Loss' },
  { projectName: 'TeleCheck' },
  { projectName: 'TeleCheck Clinic' },
  { projectName: 'Do Today' },
  { projectName: 'EndorseMe' },
  { projectName: 'TeleScribe' },
]

test('every command Telegram is given is one it will accept', () => {
  // Telegram rejects the WHOLE list if one entry is malformed and says nothing
  // useful about which — the owner is simply left with no menu at all.
  assert.deepEqual(invalidCommands(fullCommandList(PROJECTS)), [])
})

test('each project becomes a command', () => {
  const names = projectCommands(PROJECTS).map((entry) => entry.command)
  assert.ok(names.includes('scent_sell'))
  assert.ok(names.includes('downscale_weight_loss'))
  assert.ok(names.includes('telecheck'))
  assert.ok(names.includes('telecheck_clinic'), 'two similar names must not collide')
})

test('two projects that slug the same would poison the list, so one is dropped', () => {
  // A duplicate makes Telegram reject everything. Losing one entry beats
  // losing the entire menu.
  const commands = projectCommands([{ projectName: 'Do Today' }, { projectName: 'do-today' }])
  assert.equal(commands.length, 1)
  assert.deepEqual(invalidCommands(commands), [])
})

test('a project name that cannot make a valid command is skipped, not mangled', () => {
  assert.equal(projectCommandName('🔥'), null)
  assert.equal(projectCommandName('123'), null, 'must start with a letter')
  assert.equal(projectCommandName(''), null)
})

test('the commands the owner asked for by name all exist', () => {
  const names = ACTION_COMMANDS.map((entry) => entry.command)
  for (const wanted of ['scanphoto', 'scanvideo', 'carousel', 'idea', 'description']) {
    assert.ok(names.includes(wanted), `missing /${wanted}`)
  }
})

test('a command expands into a real request, not a keyword', () => {
  const idea = expandCommand('idea', '')!
  assert.ok(idea.length > 80, 'the expansion is the value — a bare word gets a bare answer')
  assert.match(idea, /three post ideas/)
})

test('words typed after the command narrow the job and come last', () => {
  const expanded = expandCommand('idea', 'something for the weekend')!
  assert.match(expanded, /Specifically: something for the weekend$/,
    'the owner\'s own words must read as the operative instruction, not a footnote')
})

test('the media commands insist on checking product names', () => {
  // Every one of these looks at something the owner filmed, where the names
  // come from a transcript or an image and are exactly what gets published wrong.
  for (const name of ['scanphoto', 'scanvideo', 'caption']) {
    const expanded = expandCommand(name, '')!
    assert.match(expanded, /catalogue/, `/${name} must check names against the catalogue`)
  }
})

test('nothing a command expands to publishes anything', () => {
  for (const entry of ACTION_COMMANDS) {
    if (!entry.expandsTo) continue
    assert.ok(
      !/\bpublish\b(?!ing)/i.test(entry.expandsTo) || /do not draft|show me first/i.test(entry.expandsTo),
      `/${entry.command} must not ask for anything to go out`,
    )
  }
  assert.match(expandCommand('post', '')!, /Do not draft it to Mixpost yet/)
})

test('navigation commands expand to nothing — the webhook handles them', () => {
  for (const name of ['project', 'app', 'new', 'help']) {
    assert.equal(expandCommand(name, ''), null, `/${name} must not reach the Director`)
  }
})

test('the command is read with or without the @botname groups add', () => {
  assert.equal(commandIn('/idea'), 'idea')
  assert.equal(commandIn('/idea@nrs_native_bot'), 'idea')
  assert.equal(commandIn('/Idea something'), 'idea')
  assert.equal(commandIn('not a command'), null)
  assert.equal(commandIn(undefined), null)
})

test('the words after the command survive intact', () => {
  assert.equal(argsIn('/idea something for the weekend'), 'something for the weekend')
  assert.equal(argsIn('/idea@nrs_native_bot  spaced  out '), 'spaced  out')
  assert.equal(argsIn('/idea'), '')
})
