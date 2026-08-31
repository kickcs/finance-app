# i18n Extraction Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `.claude/workflows/i18n-extract-slice.js` — a reusable workflow that processes one FSD slice per run: scans hardcoded Russian strings, extracts them into `locales/{ru,en}.json` keyed by FSD namespace, drafts English with a shared glossary, and runs an Opus review-until-green loop. Plus a one-time bootstrap that builds the full slice registry, and the persistent progress/glossary trackers.

**Architecture:** Mirrors the existing `mobile-port-page.js` conventions: a pure-literal `meta` with phases+models, prompt constants, structured-output schemas, a `MAX_ROUNDS` "review until green" loop, and a rich verifiable return artifact. Model split per spec: **Sonnet** does scan / extract / draft-translate / tech-fixes (bulk mechanics); **Opus** runs tech-gate review and translation review and *edits `en.json` itself*. Tech-gate passes first (no point proofreading a broken extraction). State lives in `docs/features/i18n/progress.md` (slice-level rows + counters) and `docs/features/i18n/glossary.md` (ru→en terms, grows per run). No commit.

**Tech Stack:** Workflow JS (the Workflow tool's `agent`/`parallel`/`pipeline`/`log`/`phase` runtime), reads/writes repo files via subagents, `bun run build` + `bun run test` in `frontend/` as the tech-gate. Per project rule: **no Haiku** — tech-gate uses Sonnet.

**Spec:** `docs/superpowers/specs/2026-06-16-i18n-english-language-design.md` (Section 4). Depends on the frontend foundation (vue-i18n + glob assembly) being in place so extracted keys resolve.

---

## File Structure

**Create:**
- `.claude/workflows/i18n-extract-slice.js` — the per-slice workflow
- `.claude/workflows/i18n-bootstrap-registry.js` — one-time full-slice registry builder
- `docs/features/i18n/glossary.md` — seed fintech glossary (grows per run)
- `docs/features/i18n/progress.md` — created by the bootstrap run (registry table)
- `docs/features/i18n/README.md` — how to run the workflow + trackers (short)

**Modify:** none (workflow is additive; it edits app files only at *execution* time, not at authoring time).

---

## Task 1: Seed the glossary and trackers doc

**Files:**
- Create: `docs/features/i18n/glossary.md`
- Create: `docs/features/i18n/README.md`

- [ ] **Step 1: Create the seed glossary**

`docs/features/i18n/glossary.md` — a table the workflow reads every run for term consistency, and appends to:
```markdown
# i18n Glossary (ru → en)

Used by `i18n-extract-slice` for consistent fintech terminology across slices.
Append new terms here; do not change an existing term without re-checking dependent slices.

| RU | EN | Notes |
|---|---|---|
| Счёт | Account | financial account, not "invoice" |
| Перевод | Transfer | between accounts |
| Долг | Debt |  |
| Дал в долг | Lent |  |
| Взял в долг | Borrowed |  |
| Возврат долга | Repayment |  |
| Доход | Income |  |
| Расход | Expense |  |
| Коррекция баланса | Balance adjustment |  |
| Категория | Category |  |
| Бюджет | Budget |  |
| Цель | Goal | savings goal |
| Напоминание | Reminder |  |
| Подписка | Subscription |  |
| Комиссия | Fee |  |
| Сумма | Amount |  |
| Остаток / Баланс | Balance |  |
| Сохранить | Save |  |
| Удалить | Delete |  |
| Отмена | Cancel |  |
| Подтвердить | Confirm |  |
```

- [ ] **Step 2: Create the README**

`docs/features/i18n/README.md`:
```markdown
# i18n extraction trackers

- **Bootstrap once:** `Workflow({ scriptPath: ".claude/workflows/i18n-bootstrap-registry.js" })`
  → builds `progress.md` with every FSD slice as `pending`.
- **Per slice:** `Workflow({ scriptPath: ".claude/workflows/i18n-extract-slice.js", args: "features/add-transaction" })`
  → scans, extracts to `locales/{ru,en}.json`, drafts+reviews EN, updates `progress.md` + `glossary.md`. No commit.

`progress.md` is the source of truth for what's done / partial / pending.
`glossary.md` enforces consistent EN terms — every run reads it, appends new terms.
```

- [ ] **Step 3: Verify the files exist and render**

Run: `cat docs/features/i18n/glossary.md docs/features/i18n/README.md | head -40`
Expected: both files print.

- [ ] **Step 4: Commit**

```bash
git add docs/features/i18n/glossary.md docs/features/i18n/README.md
git commit -m "docs(i18n): seed extraction glossary and trackers readme"
```

---

## Task 2: Bootstrap registry workflow

**Files:**
- Create: `.claude/workflows/i18n-bootstrap-registry.js`

- [ ] **Step 1: Write the bootstrap workflow**

`.claude/workflows/i18n-bootstrap-registry.js` — one Sonnet agent enumerates all FSD slices and writes `progress.md`. Pure-literal `meta`:
```javascript
export const meta = {
  name: 'i18n-bootstrap-registry',
  description: 'Разово строит docs/features/i18n/progress.md — реестр всех FSD-слайсов фронта со статусом pending и грубой оценкой числа локализуемых строк. Без коммита.',
  whenToUse: 'Запустить ОДИН раз до первого i18n-extract-slice. Без args.',
  phases: [{ title: 'Bootstrap', detail: 'один агент: перечисляет слайсы frontend/src, оценивает строки, пишет progress.md', model: 'sonnet' }],
}

const REGISTRY_SCHEMA = {
  type: 'object',
  required: ['slices'],
  properties: {
    slices: {
      type: 'array',
      items: {
        type: 'object',
        required: ['slice', 'estStrings'],
        properties: {
          slice: { type: 'string', description: 'FSD-путь относительно frontend/src, напр. "features/add-transaction"' },
          estStrings: { type: 'integer', description: 'грубая оценка числа захардкоженных русских строк' },
        },
      },
    },
  },
}

phase('Bootstrap')
const result = await agent(
  `Перечисли ВСЕ FSD-слайсы фронта в frontend/src для последующей i18n-экстракции.

Слайс = директория второго уровня внутри слоя: features/<x>, widgets/<x>, pages/<x>, entities/<x>, плюс срез shared/ui и shared/lib (если содержат пользовательский текст). НЕ перечисляй shared/i18n (это каркас).

Для каждого слайса: путь относительно frontend/src и грубая оценка числа захардкоженных РУССКИХ пользовательских строк (label/placeholder/title/тосты/тексты в .vue и constants.ts). Оценка приблизительная (rg по кириллице — ориентир): \`rg -c "[А-Яа-яЁё]" frontend/src/<slice> | wc -l\` и здравый смысл.

Крупные централизованные источники тоже считай слайсами: entities/category (constants.ts), entities/subscription (constants.ts), features/changelog (changelogData.ts — отметь estStrings высоким).

Верни по схеме REGISTRY_SCHEMA.`,
  { label: 'enumerate', phase: 'Bootstrap', schema: REGISTRY_SCHEMA, model: 'sonnet' },
)

const rows = (result?.slices ?? [])
  .map((s) => `| ${s.slice} | pending | ${s.estStrings} | 0 | 0 | 0 | — |`)
  .join('\n')
const total = (result?.slices ?? []).length
const md = `# i18n extraction progress

**Слайсов:** 0 done / 0 partial / ${total} pending из ${total}

| Слайс | Статус | Ключей найдено | Извлечено | Переведено (en) | needs_human | Прогон от |
|---|---|---|---|---|---|---|
${rows}
`

await agent(
  `Запиши следующий файл ПОЛНОСТЬЮ в docs/features/i18n/progress.md (перезаписать, если есть). Содержимое ровно:\n\n${md}\n\nПодтверди, что файл записан. Верни короткий текст.`,
  { label: 'write-progress', phase: 'Bootstrap', model: 'sonnet' },
)

log(`Реестр построен: ${total} слайсов (все pending).`)
return { totalSlices: total, slices: result?.slices ?? [] }
```

- [ ] **Step 2: Dry-run the bootstrap**

Run the workflow: `Workflow({ scriptPath: ".claude/workflows/i18n-bootstrap-registry.js" })` (or via the project's workflow runner). Watch `/workflows` progress.
Expected: `docs/features/i18n/progress.md` created with one row per slice, summary line `X pending из X`.

- [ ] **Step 3: Sanity-check the registry**

Run: `head -20 docs/features/i18n/progress.md && wc -l docs/features/i18n/progress.md`
Expected: table with realistic slices (features/add-transaction, pages/dashboard, entities/category, features/changelog with a high estStrings, etc.).

- [ ] **Step 4: Commit**

```bash
git add .claude/workflows/i18n-bootstrap-registry.js docs/features/i18n/progress.md
git commit -m "feat(i18n): bootstrap registry workflow + initial progress.md"
```

---

## Task 3: Extraction workflow — meta, input, prompt constants, schemas

**Files:**
- Create: `.claude/workflows/i18n-extract-slice.js` (part 1 of 3 — top of file)

- [ ] **Step 1: Write meta + input guard + constants + schemas**

Create `.claude/workflows/i18n-extract-slice.js` with:

```javascript
export const meta = {
  name: 'i18n-extract-slice',
  description: 'Извлекает захардкоженные русские строки одного FSD-слайса в locales/{ru,en}.json (namespace = FSD-путь), черновой перевод (sonnet) → ревью до зелёного (opus сам правит en). Обновляет progress.md + glossary.md. Без коммита.',
  whenToUse: 'Один FSD-слайс за прогон. args = путь слайса относительно frontend/src, напр. "features/add-transaction" или "pages/profile".',
  phases: [
    { title: 'Scan', detail: 'sonnet: находит локализуемые русские строки в слайсе', model: 'sonnet' },
    { title: 'Extract', detail: 'sonnet: заменяет на $t()/t(), пишет ru.json', model: 'sonnet' },
    { title: 'Translate', detail: 'sonnet: черновой ru→en с glossary', model: 'sonnet' },
    { title: 'Review', detail: 'opus: tech-gate (ключи/импорты/build) → translation-review (сам правит en)', model: 'opus' },
  ],
}

// ─── Вход ───────────────────────────────────────────────────────────────────
const slice = (typeof args === 'string' ? args : args?.slice || '').trim().replace(/^\/+|\/+$/g, '')
if (!slice) {
  log('❌ Не передан слайс. Вызови: Workflow({scriptPath, args: "features/add-transaction"})')
  return { error: 'no slice arg' }
}
const MAX_ROUNDS = 3
const SRC = `frontend/src/${slice}`
const LOCALES_DIR = `${SRC}/locales`
const PROGRESS = 'docs/features/i18n/progress.md'
const GLOSSARY = 'docs/features/i18n/glossary.md'

// namespace = camelCase сегментов FSD-пути: features/add-transaction → features.addTransaction
const NS = slice.split('/').map((s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())).join('.')

// ─── Правила (project conventions) ────────────────────────────────────────────
const I18N_RULES = `
ПРАВИЛА i18n (Approach A — namespace зеркалит FSD-путь):
- Namespace слайса: ${NS}. Ключи в locales/ru.json и en.json — ПЛОСКИЕ внутри файла (без префикса namespace; namespace добавляет glob-сборка).
- В шаблоне .vue: $t('${NS}.<key>'). В <script setup>: const { t } = useI18n() из 'vue-i18n', затем t('${NS}.<key>'). Импорт useI18n добавить, если его нет.
- Ключи — короткие смысловые camelCase: amountLabel, saveButton, deleteConfirmTitle. Группировать осмысленно, НЕ key1/key2.
- Файлы: ${LOCALES_DIR}/ru.json (оригиналы), ${LOCALES_DIR}/en.json (перевод). Если уже существуют — ДОПОЛНИТЬ, не перезатирать чужие ключи.`

const SCAN_RULES = `
ЧТО ЛОКАЛИЗОВАТЬ (только пользовательский русский текст):
- Видимый текст: содержимое тегов, label/placeholder/title/aria-label, кнопки, тосты (toast({ title, description })), заголовки модалок, EmptyState-тексты, тексты в constants.ts (LABELS, *_CATEGORIES name, PLAN_LABELS, PREMIUM_FEATURES label/description).
ЧТО НЕ ТРОГАТЬ:
- Имена иконок (UIcon name="..."), технические enum/id, query-ключи, console.*, пути/URL, имена событий, ключи объектов, data-testid, CSS-классы, числа/форматы (их обрабатывают форматтеры).
- Строки БЕЗ кириллицы (если строка уже на английском как технический литерал — пропустить).
ПЛЮРАЛИЗАЦИЯ/ИНТЕРПОЛЯЦИЯ:
- Строки с числовой плюрализацией («1 транзакция / 2 транзакции / 5 транзакций») или сложной интерполяцией, где не уверен в формах — НЕ извлекать механически: помечать needs_human с why. vue-i18n plural ('нет | {n} штука | {n} штуки') требует ручной выверки русских форм.`

// ─── Схемы structured-output ──────────────────────────────────────────────────
const SCAN_SCHEMA = {
  type: 'object',
  required: ['strings', 'files'],
  properties: {
    files: { type: 'array', items: { type: 'string' }, description: 'файлы слайса с локализуемым текстом' },
    strings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'text', 'suggestedKey', 'needsHuman'],
        properties: {
          file: { type: 'string' },
          line: { type: 'integer' },
          text: { type: 'string', description: 'оригинальная русская строка' },
          suggestedKey: { type: 'string', description: 'предлагаемый плоский ключ, напр. amountLabel' },
          context: { type: 'string', description: 'где/как используется (template/script/toast/const)' },
          needsHuman: { type: 'boolean', description: 'true для плюрализации/сложной интерполяции' },
          why: { type: 'string', description: 'причина needs_human, если true' },
        },
      },
    },
  },
}

const EXTRACT_SCHEMA = {
  type: 'object',
  required: ['extractedKeys', 'changedFiles'],
  properties: {
    extractedKeys: { type: 'integer' },
    changedFiles: { type: 'array', items: { type: 'string' } },
    ruJsonPath: { type: 'string' },
  },
}

const TRANSLATE_SCHEMA = {
  type: 'object',
  required: ['translatedKeys', 'newGlossaryTerms'],
  properties: {
    translatedKeys: { type: 'integer' },
    newGlossaryTerms: {
      type: 'array',
      items: { type: 'object', required: ['ru', 'en'], properties: { ru: { type: 'string' }, en: { type: 'string' }, notes: { type: 'string' } } },
    },
  },
}

const GATE_SCHEMA = {
  type: 'object',
  required: ['pass', 'verdict', 'items'],
  properties: {
    pass: { type: 'boolean' },
    verdict: { type: 'string', enum: ['APPROVED', 'CHANGES_REQUESTED'] },
    summary: { type: 'string' },
    items: { type: 'array', items: { type: 'object', required: ['why'], properties: { file: { type: 'string' }, severity: { type: 'string', enum: ['critical', 'major', 'minor'] }, why: { type: 'string' } } } },
  },
}
```

- [ ] **Step 2: Verify the file parses (syntax only)**

Run: `node --check .claude/workflows/i18n-extract-slice.js`
Expected: no output (valid syntax). The script body (Tasks 4–5) is appended after; partial file may `return` early — that's fine for `--check`.

- [ ] **Step 3: Commit (WIP)**

```bash
git add .claude/workflows/i18n-extract-slice.js
git commit -m "feat(i18n): extraction workflow — meta, input, schemas (wip)"
```

---

## Task 4: Extraction workflow — scan → extract → translate body

**Files:**
- Modify: `.claude/workflows/i18n-extract-slice.js` (append part 2 of 3)

- [ ] **Step 1: Append the read-state + scan + extract + translate phases**

After the schemas, append:

```javascript
// ─── Чтение состояния ──────────────────────────────────────────────────────────
const glossary = await agent(
  `Прочитай ${GLOSSARY} и верни его содержимое дословно (таблица ru→en). Если файла нет — верни пустую строку.`,
  { label: 'read-glossary', phase: 'Scan', model: 'sonnet' },
)

// ─── Scan ───────────────────────────────────────────────────────────────────
phase('Scan')
const scan = await agent(
  `Ты — scanner i18n-строк слайса "${slice}" (директория ${SRC}).
Найди ВСЕ захардкоженные русские пользовательские строки в файлах слайса (.vue: template + script setup; *.ts: constants/labels).

${SCAN_RULES}
${I18N_RULES}

Для каждой строки верни file, line, оригинальный text, suggestedKey (плоский camelCase), context, needsHuman(+why для плюрализации/интерполяции).
Верни по схеме.`,
  { label: 'scan', phase: 'Scan', schema: SCAN_SCHEMA, model: 'sonnet' },
)
const extractable = (scan?.strings ?? []).filter((s) => !s.needsHuman)
const deferred = (scan?.strings ?? []).filter((s) => s.needsHuman)
log(`Scan: ${scan?.strings?.length ?? 0} строк (${extractable.length} к извлечению, ${deferred.length} needs_human).`)

if (extractable.length === 0) {
  log(`Слайс "${slice}" — нечего извлекать (0 локализуемых строк${deferred.length ? ', только needs_human' : ''}).`)
  // всё равно обновим progress: done если и deferred нет, иначе partial
}

// ─── Extract ──────────────────────────────────────────────────────────────────
phase('Extract')
const extract = extractable.length === 0
  ? { extractedKeys: 0, changedFiles: [] }
  : await agent(
      `Ты — extractor. В слайсе "${slice}" замени КАЖДУЮ извлекаемую строку на вызов i18n и создай/дополни ${LOCALES_DIR}/ru.json.

СТРОКИ К ИЗВЛЕЧЕНИЮ:
${JSON.stringify(extractable, null, 2)}

${I18N_RULES}

ДЕЙСТВИЯ:
1. В каждом файле замени строку на $t('${NS}.<key>') (template) или t('${NS}.<key>') (script setup; добавь const { t } = useI18n() и import { useI18n } from 'vue-i18n', если их нет).
2. Создай/дополни ${LOCALES_DIR}/ru.json — плоский объект { "<key>": "<оригинальный русский текст>" }. Если файл есть — слить, не затирать.
3. НЕ трогай строки вне списка. НЕ ломай существующий код.
Верни по схеме (extractedKeys, changedFiles, ruJsonPath).`,
      { label: 'extract', phase: 'Extract', schema: EXTRACT_SCHEMA, model: 'sonnet' },
    )
log(`Extract: ${extract.extractedKeys} ключей, файлов изменено ${extract.changedFiles?.length ?? 0}.`)

// ─── Translate (draft) ──────────────────────────────────────────────────────────
phase('Translate')
const translate = extract.extractedKeys === 0
  ? { translatedKeys: 0, newGlossaryTerms: [] }
  : await agent(
      `Ты — переводчик ru→en для финтех-приложения. Создай/дополни ${LOCALES_DIR}/en.json по ключам из ${LOCALES_DIR}/ru.json.

GLOSSARY (соблюдай эти термины ДОСЛОВНО для консистентности между слайсами):
${glossary}

ПРАВИЛА ПЕРЕВОДА:
- Тон: краткий, как в финтех-UI (Save/Delete/Cancel — повелительно, без артиклей в кнопках).
- Длина: не длиннее разумного для UI-элемента (кнопка/лейбл не должны раздуваться).
- Плейсхолдеры интерполяции ({amount}, {name}, {n}) сохраняй ДОСЛОВНО.
- Те же плоские ключи, что в ru.json. Если en.json есть — слить, не затирать.
- Новые финтех-термины, которых нет в glossary, верни в newGlossaryTerms (ru, en, notes) — их допишут в glossary.
Верни по схеме.`,
      { label: 'translate', phase: 'Translate', schema: TRANSLATE_SCHEMA, model: 'sonnet' },
    )
log(`Translate (draft): ${translate.translatedKeys} ключей, новых терминов glossary ${translate.newGlossaryTerms?.length ?? 0}.`)
```

- [ ] **Step 2: Verify syntax**

Run: `node --check .claude/workflows/i18n-extract-slice.js`
Expected: valid (the file `return`s implicitly at end-of-body for now).

- [ ] **Step 3: Commit (WIP)**

```bash
git add .claude/workflows/i18n-extract-slice.js
git commit -m "feat(i18n): extraction workflow — scan/extract/translate body (wip)"
```

---

## Task 5: Extraction workflow — review-until-green loop + state update + artifact

**Files:**
- Modify: `.claude/workflows/i18n-extract-slice.js` (append part 3 of 3)

- [ ] **Step 1: Append the review loop, tech-gate, progress/glossary update, return**

```javascript
// ─── Review until green (opus) ──────────────────────────────────────────────────
let round = 0
let green = false
let lastTech = null
let lastTranslation = null
let residualItems = []

if (extract.extractedKeys > 0) {
  while (round < MAX_ROUNDS && !green) {
    round++
    phase('Review')

    // 1) Tech-gate FIRST — нет смысла вычитывать перевод для сломанной экстракции.
    const tech = await agent(
      `Ты — tech-gate i18n-экстракции слайса "${slice}". Проверь и САМ почини код при поломке (opus).
ПРОВЕРКИ:
1. Все ключи, на которые ссылаются $t('${NS}.x')/t('${NS}.x') в изменённых файлах, ПРИСУТСТВУЮТ в ${LOCALES_DIR}/ru.json и en.json. Нет осиротевших $t.
2. Где используется t() в script setup — есть import { useI18n } и const { t } = useI18n().
3. ru.json и en.json — валидный JSON, одинаковый набор ключей.
4. Сборка: \`cd frontend && bun run build\` — зелёная (vue-tsc + vite). Если падает — почини (импорт, синтаксис, забытый ключ) и перезапусти build.
Если что-то чинил — опиши в items. pass=true и verdict=APPROVED только если build зелёный и пункты 1-3 чисты.
Верни по схеме.`,
      { label: `tech#${round}`, phase: 'Review', schema: GATE_SCHEMA, model: 'opus' },
    )
    lastTech = tech
    log(`Раунд ${round} — tech-gate: ${tech?.pass ? 'APPROVED' : 'CHANGES(' + (tech?.items?.length ?? '?') + ')'} — ${tech?.summary ?? '?'}`)
    if (!tech?.pass) {
      residualItems = tech?.items ?? []
      continue // чинить экстракцию до зелёного tech-gate, перевод не трогаем
    }

    // 2) Translation-review — только после зелёного tech-gate. Opus САМ правит en.json.
    const tr = await agent(
      `Ты — translation-reviewer ru→en слайса "${slice}". Вычитай ${LOCALES_DIR}/en.json против ${LOCALES_DIR}/ru.json и САМ исправь en.json (только текст перевода, не код).
GLOSSARY (термины обязательны):
${glossary}
ПРОВЕРЬ И ПОЧИНИ:
- Точность смысла, естественный финтех-английский (не калька).
- Термины строго по glossary (Счёт→Account и т.д.).
- Длина адекватна UI-элементу (кнопки/лейблы коротко).
- Плейсхолдеры ({amount},{name},{n}) сохранены и совпадают с ru.json.
- Полнота: каждый ключ ru.json имеет качественный en.
Если правил en.json — перечисли правки в items (why). verdict=APPROVED только если после твоих правок перевод корректен. Верни по схеме.`,
      { label: `translation#${round}`, phase: 'Review', schema: GATE_SCHEMA, model: 'opus' },
    )
    lastTranslation = tr
    log(`Раунд ${round} — translation: ${tr?.verdict === 'APPROVED' ? 'APPROVED' : 'CHANGES(' + (tr?.items?.length ?? '?') + ')'} — ${tr?.summary ?? '?'}`)

    green = tech?.pass === true && tr?.verdict === 'APPROVED'
    if (!green) residualItems = [...(tech?.items ?? []), ...(tr?.items ?? [])]
    else {
      // финальный re-build после правок перевода (опечатка в en.json могла сломать JSON)
      const rebuild = await agent(
        `Запусти \`cd frontend && bun run build\` после правок перевода. pass=true если зелёно, иначе pass=false и в items причина. Верни по схеме.`,
        { label: `rebuild#${round}`, phase: 'Review', schema: GATE_SCHEMA, model: 'sonnet' },
      )
      if (!rebuild?.pass) { green = false; residualItems = rebuild?.items ?? []; }
    }
  }
} else {
  // нечего извлекать — слайс не требует кода
  green = true
}

// ─── Итоговый статус слайса ──────────────────────────────────────────────────
const found = scan?.strings?.length ?? 0
const extractedKeys = extract.extractedKeys ?? 0
const translatedKeys = green ? (translate.translatedKeys ?? 0) : 0
const needsHuman = deferred.length
let status
if (!green) status = 'partial'           // ревью не сошлось — частично
else if (needsHuman > 0) status = 'partial' // есть отложенные строки
else status = 'done'

const finalVerdict = green
  ? (needsHuman > 0 ? `partial (${needsHuman} needs_human)` : 'done')
  : (round >= MAX_ROUNDS ? 'needs_human (исчерпаны раунды ревью)' : 'needs_human (ревью прервано)')

// ─── Обновление progress.md + glossary.md ────────────────────────────────────
const today = (typeof args === 'object' && args?.today) || 'см. git'  // Date.* недоступен в скрипте; дату проставит человек/коммит
await agent(
  `Обнови docs/features/i18n/progress.md: найди строку слайса "${slice}" (первый столбец) и замени её на:
| ${slice} | ${status} | ${found} | ${extractedKeys} | ${translatedKeys} | ${needsHuman} | ${today} |
Если строки нет — добавь её в таблицу. Затем пересчитай и обнови строку-сводку вверху ("Слайсов: A done / B partial / C pending из N") по фактическому содержимому таблицы. Сохрани файл. Верни короткое подтверждение.`,
  { label: 'update-progress', phase: 'Review', model: 'sonnet' },
)

if (green && (translate.newGlossaryTerms?.length ?? 0) > 0) {
  await agent(
    `Допиши в таблицу docs/features/i18n/glossary.md новые термины (если их там ещё нет, по колонке RU):
${JSON.stringify(translate.newGlossaryTerms, null, 2)}
Добавляй строки в конец таблицы в формате "| RU | EN | notes |". Не дублируй существующие RU. Верни короткое подтверждение.`,
    { label: 'update-glossary', phase: 'Review', model: 'sonnet' },
  )
}

log(`Слайс "${slice}": ${finalVerdict}. found=${found} extracted=${extractedKeys} translated=${translatedKeys} needs_human=${needsHuman}, раундов=${round}.`)

// ─── Артефакт ────────────────────────────────────────────────────────────────
return {
  slice,
  namespace: NS,
  finalVerdict,
  status,
  counts: { found, extractedKeys, translatedKeys, needsHuman },
  rounds: round,
  deferred: deferred.map((d) => ({ file: d.file, text: d.text, why: d.why })),
  changedFiles: extract.changedFiles ?? [],
  techVerdict: lastTech ? { pass: lastTech.pass, summary: lastTech.summary } : null,
  translationVerdict: lastTranslation ? { verdict: lastTranslation.verdict, summary: lastTranslation.summary } : null,
  residualItems: green ? [] : residualItems,
  localesDir: LOCALES_DIR,
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check .claude/workflows/i18n-extract-slice.js`
Expected: valid.

- [ ] **Step 3: Commit**

```bash
git add .claude/workflows/i18n-extract-slice.js
git commit -m "feat(i18n): extraction workflow — review loop, state update, artifact"
```

---

## Task 6: Pilot run on a small slice + verify

**Files:** none created; this validates the workflow end-to-end on one real slice.

- [ ] **Step 1: Pick a small, low-risk slice**

Choose a small slice with a handful of plain strings and no pluralization — e.g. `features/toggle-theme` or `features/install-pwa`. Confirm via: `rg -c "[А-Яа-яЁё]" frontend/src/features/install-pwa`.

- [ ] **Step 2: Run the workflow on the pilot slice**

Run: `Workflow({ scriptPath: ".claude/workflows/i18n-extract-slice.js", args: "features/install-pwa" })`
Watch `/workflows`. Expected phases: Scan → Extract → Translate → Review, ending `done` (or `partial` if it has deferrals).

- [ ] **Step 3: Verify the outputs**

Run: `cat frontend/src/features/install-pwa/locales/ru.json frontend/src/features/install-pwa/locales/en.json`
Expected: aligned key sets, RU originals, sensible EN. Then: `cd frontend && bun run build` → green. Then `rg "\\\$t\\('features.installPwa" frontend/src/features/install-pwa` → shows the replaced calls.

- [ ] **Step 4: Verify trackers updated**

Run: `grep "install-pwa" docs/features/i18n/progress.md && head -3 docs/features/i18n/progress.md`
Expected: the slice row shows `done`/`partial` with counts; the summary line reflects 1 processed.

- [ ] **Step 5: Switch the app to English and eyeball (optional manual)**

`cd frontend && bun run dev`, switch language to English (the switcher from the frontend plan), open the PWA install modal — confirm English renders and reactivity works.

- [ ] **Step 6: Commit the pilot extraction**

```bash
git add frontend/src/features/install-pwa/locales docs/features/i18n/progress.md docs/features/i18n/glossary.md
# plus the modified component files the workflow touched:
git add -A
git commit -m "feat(i18n): extract features/install-pwa strings (pilot run)"
```

> The workflow itself does NOT commit (per spec). This step is the human committing the verified pilot output.

---

## Task 7: Document the rollout order

**Files:**
- Modify: `docs/features/i18n/README.md`

- [ ] **Step 1: Append a suggested rollout order**

Add to the README:
```markdown
## Suggested rollout order

Process highest-visibility slices first, then sweep the rest:
1. pages/dashboard, widgets/* (balance, recent, sections)
2. features/add-transaction, features/edit-transaction
3. pages/profile + features/manage-subscription
4. entities/category, entities/subscription (centralized constants)
5. Remaining features/, pages/, entities/
6. features/changelog last — discuss whether to localize historical entries at all (spec deferral).

Run one slice per workflow invocation. After each: review the diff, commit. Check `progress.md` for what's left.
```

- [ ] **Step 2: Commit**

```bash
git add docs/features/i18n/README.md
git commit -m "docs(i18n): document slice rollout order"
```

---

## Self-Review Notes (addressed)

- **Spec Section 4 (one slice per run, args = slice path):** input guard, Task 3. ✓
- **Spec Section 4 (model split: Sonnet scan/extract/draft-translate; Opus review + edits en):** Tasks 4 (sonnet) + 5 (opus tech & translation). ✓
- **Spec Section 4 (tech-gate first, then translation-review):** Task 5 loop ordering with `continue` on tech fail. ✓
- **Spec Section 4 (Scan rules, exclusions, needs_human for plural/interpolation):** `SCAN_RULES` + `deferred` split, Task 4. ✓
- **Spec Section 4 (glossary read every run, appended):** `read-glossary` + `update-glossary`, Tasks 4–5. ✓
- **Spec Section 4 (progress.md slice-level counters; bootstrap full registry):** Task 2 (bootstrap) + Task 5 (update). ✓
- **Spec Section 4 (no commit by workflow):** workflow never commits; humans commit in Tasks 6. ✓
- **Spec Section 4 (resumable, partial visible):** status `partial` for unfinished/needs_human; `progress.md` is source of truth. ✓
- **Project rule (no Haiku):** tech-gate/rebuild use Sonnet/Opus only. ✓
- **Date.now() unavailable in workflow scripts:** the `today` field is left to git/human (noted inline) — avoids the runtime throw. ✓
- **Type/name consistency:** `NS` derivation matches the frontend glob assembly's camelCase rule (`features/add-transaction → features.addTransaction`) exactly. `GATE_SCHEMA` reused for tech + translation + rebuild. ✓
- **Dependency:** requires frontend foundation (vue-i18n + glob) so `$t` resolves and `bun run build` validates keys — noted in header.
```
