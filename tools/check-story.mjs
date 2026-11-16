// Проверка ветвления и доступности всех концовок.
import { NODES, STORY_START, ENDINGS, ENDING_ORDER, resolveEnding, checkState, formatText } from '../js/story.js';

const STATS = ['study', 'courage', 'family', 'bond'];
const errors = checkState();
if (errors.length) {
  console.error('Ошибки графа:', errors);
  process.exitCode = 1;
}

function apply(stats, effects = {}) {
  const next = { ...stats };
  for (const [key, value] of Object.entries(effects)) {
    if (STATS.includes(key)) next[key] = Math.max(0, next[key] + value);
  }
  return next;
}

function dedupeKey(nodeId, state) {
  const flags = ['tookFennec', 'leftFennec', 'confessed', 'cheated', 'finalChoice']
    .map((k) => `${k}:${state.flags[k] ?? ''}`).join(',');
  return `${nodeId}|${STATS.map((k) => state.stats[k]).join(',')}|${flags}`;
}

const found = new Map(ENDING_ORDER.map((id) => [id, null]));
const queue = [{
  node: STORY_START,
  stats: { study: 0, courage: 0, family: 0, bond: 0 },
  flags: {},
  path: [STORY_START],
  choices: [],
}];
const seen = new Set();
let iterations = 0;

while (queue.length) {
  const cur = queue.shift();
  if (++iterations > 200000) throw new Error('слишком большое дерево');
  const key = dedupeKey(cur.node, cur);
  if (seen.has(key)) continue;
  seen.add(key);
  const node = NODES[cur.node];
  if (!node) continue;

  if (node.type === 'ending') {
    const id = resolveEnding({ stats: cur.stats, flags: cur.flags, fennecName: cur.flags.tookFennec ? 'Шум' : null }, node.resolve);
    if (!found.get(id)) found.set(id, { ...cur, ending: id });
    continue;
  }

  if (node.type === 'montage') {
    const picks = node.picks;
    const opts = node.montage.options;
    const choose = (start, acc) => {
      if (acc.length === picks) {
        let stats = { ...cur.stats };
        for (const idx of acc) stats = apply(stats, opts[idx].effects);
        queue.push({
          node: node.next,
          stats,
          flags: { ...cur.flags },
          path: [...cur.path, node.next],
          choices: [...cur.choices, `вечера:${acc.map((i) => opts[i].id).join('+')}`],
        });
        return;
      }
      for (let i = start; i < opts.length; i++) choose(i + 1, [...acc, i]);
    };
    choose(0, []);
    continue;
  }

  if (node.choices) {
    node.choices.forEach((choice) => {
      queue.push({
        node: choice.next,
        stats: apply(cur.stats, choice.effects),
        flags: { ...cur.flags, ...(choice.flags || {}) },
        path: [...cur.path, choice.next],
        choices: [...cur.choices, choice.text],
      });
    });
    continue;
  }

  if (node.next) {
    queue.push({ ...cur, node: node.next, path: [...cur.path, node.next] });
  }
}

console.log(`Проверено состояний: ${seen.size}`);
let missing = 0;
for (const id of ENDING_ORDER) {
  const hit = found.get(id);
  if (!hit) {
    missing++;
    console.error(`✗ недостижима: ${id} — ${ENDINGS[id].title}`);
    continue;
  }
  const s = hit.stats;
  console.log(`✓ ${ENDINGS[id].title} [${id}]  учёба ${s.study}, смелость ${s.courage}, тепло ${s.family}, связь ${s.bond}`);
  const sample = { name: 'Алекс', gender: 'm', dreamKey: 'arch', fennecName: 'Шум', flags: hit.flags };
  console.log(`  ${hit.choices.map((c) => formatText(c, sample)).join(' → ')}`);
}
if (missing) process.exitCode = 1;
