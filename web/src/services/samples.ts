// Sample archive: Rahul Mehta (born 1947), adapted from the team's "Rahul Mehta: The Life Archive"
// demo set. Rahul, his family and every event here are FICTIONAL, made up for demonstrating Echoes.
//
// - Telling 1 of every memory is the set's "Ready-to-Create Echo Record" text, copied exactly.
// - Telling 2 of "The Little Circuit That Changed Everything" is an invented retelling, added only so
//   the X-ray (Pentimento) and the assumption guard have a second telling to compare against.
// - Categories are mapped onto the app's six: Family -> Personal, Education -> Learning,
//   Career -> Projects, Relationships -> People, Travel -> Travel, Legacy -> Ideas.
// - Each record's evidence type is kept as a tag (family-reported, first-person, written-note).
//   They are example labels, not checked sources.
// - The facts below are hand-written for the sample; each quote is matched against the text in code,
//   and any quote that isn't found is dropped (see seedClaims).
import type { DataAdapter } from './adapter'
import type { ArtStyle, Category, Echo } from '../types'
import { canonicalize } from '../lib/seal'
import { seedClaims, type SeedTelling } from './seed'

export interface SampleEcho {
  title: string
  category: Category
  tags: string[]
  memoryDate: string
  cover: string | null
  style: ArtStyle
  tellings: SeedTelling[]
  /** Suggested questions for the Echo Room (from the set's Truth Boundary test questions where possible). */
  questions: string[]
}

export const SAMPLE_NAME = 'Rahul Mehta'

const RECORDED_2026 = '2026-01-20'

export const SAMPLES: SampleEcho[] = [
  {
    title: 'The Day I Was Born', category: 'Personal', memoryDate: '1947-10-18', cover: null, style: 'Watercolor',
    tags: ['birth', 'family', 'Pune', 'childhood', 'family-reported'],
    questions: ['When was I born?', 'What was I thinking on the day I was born?', 'Was my father an engineer?'],
    tellings: [{
      toldOn: RECORDED_2026,
      text: 'My name is Rahul Arvind Mehta. I was born on 18 October 1947 in Pune, Maharashtra, shortly after India gained independence. My parents were Arvind Mehta and Leela Mehta. The story of my birth was told to me by my family; I do not personally remember that day.',
      claims: [
        { text: 'Your name is Rahul Arvind Mehta', quote: 'My name is Rahul Arvind Mehta' },
        { text: 'You were born on 18 October 1947', quote: 'I was born on 18 October 1947' },
        { text: 'You were born in Pune, Maharashtra', quote: 'in Pune, Maharashtra' },
        { text: 'It was shortly after India gained independence', quote: 'shortly after India gained independence' },
        { text: 'Your parents were Arvind Mehta and Leela Mehta', quote: 'My parents were Arvind Mehta and Leela Mehta' },
        { text: 'Your family told you the story of your birth', quote: 'The story of my birth was told to me by my family' },
        { text: 'You do not personally remember that day', quote: 'I do not personally remember that day' },
      ],
    }],
  },
  {
    title: 'The Little Circuit That Changed Everything', category: 'Learning', memoryDate: '1962-08-15', cover: null, style: 'Sketch',
    tags: ['school', 'science', 'circuit', 'engineering', 'first-person'],
    questions: ['What was my first engineering project?', 'What prize did my circuit win?', 'Who helped me build the circuit?'],
    tellings: [
      {
        toldOn: RECORDED_2026,
        text: 'When I was fourteen, I assembled a small battery-powered circuit for a school science exhibition. The bulb flickered several times before it finally stayed on. I remember feeling that I had made something real with my own hands. That experience strengthened my interest in electrical engineering.',
        claims: [
          { text: 'You were fourteen', quote: 'When I was fourteen' },
          { text: 'You assembled a small battery-powered circuit', quote: 'I assembled a small battery-powered circuit' },
          { text: 'It was for a school science exhibition', quote: 'for a school science exhibition' },
          { text: 'The bulb flickered several times before it stayed on', quote: 'The bulb flickered several times before it finally stayed on' },
          { text: 'You felt you had made something real with your own hands', quote: 'I had made something real with my own hands' },
          { text: 'The experience strengthened your interest in electrical engineering', quote: 'That experience strengthened my interest in electrical engineering' },
        ],
      },
      {
        // Invented retelling (told to the grandchildren), for the drift demo only.
        toldOn: '2026-10-11',
        text: 'I was thirteen or fourteen when my science teacher helped me wire up a circuit for the school exhibition. The bulb lit up on the very first try, and the judges gave me second prize. That was the day I decided to become an engineer.',
        claims: [
          { text: 'You were thirteen or fourteen', quote: 'I was thirteen or fourteen' },
          { text: 'Your science teacher helped you', quote: 'my science teacher helped me' },
          { text: 'You wired up a circuit', quote: 'wire up a circuit' },
          { text: 'It was for the school exhibition', quote: 'for the school exhibition' },
          { text: 'The bulb lit up on the first try', quote: 'The bulb lit up on the very first try' },
          { text: 'The judges gave you second prize', quote: 'the judges gave me second prize' },
          { text: 'That was the day you decided to become an engineer', quote: 'That was the day I decided to become an engineer' },
        ],
      },
    ],
  },
  {
    title: 'My First Salary', category: 'Projects', memoryDate: '1970-06-01', cover: null, style: 'Minimal',
    tags: ['first job', 'salary', 'parents', 'radio', 'engineering', 'first-person'],
    questions: ['What was the exact amount of my first salary?', 'What did I do with my first salary?'],
    tellings: [{
      toldOn: RECORDED_2026,
      text: 'I began my first engineering job in 1970. My salary was modest, but I wanted to do something meaningful with my first earnings. I bought my parents a new radio and kept the receipt inside an old notebook. I remember the gift more clearly than the exact amount I earned.',
      claims: [
        { text: 'You began your first engineering job in 1970', quote: 'I began my first engineering job in 1970' },
        { text: 'Your salary was modest', quote: 'My salary was modest' },
        { text: 'You wanted to do something meaningful with your first earnings', quote: 'I wanted to do something meaningful with my first earnings' },
        { text: 'You bought your parents a new radio', quote: 'I bought my parents a new radio' },
        { text: 'You kept the receipt inside an old notebook', quote: 'kept the receipt inside an old notebook' },
        { text: 'You remember the gift more clearly than the exact amount you earned', quote: 'I remember the gift more clearly than the exact amount I earned' },
      ],
    }],
  },
  {
    title: 'How I Met Anjali', category: 'People', memoryDate: '1973-02-10', cover: null, style: 'Watercolor',
    tags: ['Anjali', 'marriage', 'relationships', 'music', 'first-person'],
    questions: ['How did I meet Anjali?', 'Was it love at first sight?'],
    tellings: [{
      toldOn: RECORDED_2026,
      text: 'I met Anjali Deshpande through family friends in 1973. Our first conversations were a little awkward. We discovered that we both enjoyed old Hindi songs and taking long walks. We married later that year in a small ceremony with relatives and close friends.',
      claims: [
        { text: 'You met Anjali Deshpande through family friends in 1973', quote: 'I met Anjali Deshpande through family friends in 1973' },
        { text: 'Your first conversations were a little awkward', quote: 'Our first conversations were a little awkward' },
        { text: 'You both enjoyed old Hindi songs', quote: 'we both enjoyed old Hindi songs' },
        { text: 'You both enjoyed taking long walks', quote: 'taking long walks' },
        { text: 'You married later that year', quote: 'We married later that year' },
        { text: 'The wedding was a small ceremony with relatives and close friends', quote: 'in a small ceremony with relatives and close friends' },
      ],
    }],
  },
  {
    title: 'The Road Trip We Never Forgot', category: 'Travel', memoryDate: '1992-05-20', cover: '/art/mountains.jpg', style: 'Cinematic',
    tags: ['Mahabaleshwar', 'travel', 'family', 'humour', 'first-person'],
    questions: ['Did the road trip make our family closer?', 'Why did the car break down?'],
    tellings: [{
      toldOn: RECORDED_2026,
      text: 'Our family travelled towards Mahabaleshwar in 1992. The car broke down on the way, and our carefully planned schedule disappeared. We arrived much later than expected, but everyone was laughing by the end. Over time, the breakdown became one of our favourite family stories.',
      claims: [
        { text: 'Your family travelled towards Mahabaleshwar in 1992', quote: 'Our family travelled towards Mahabaleshwar in 1992' },
        { text: 'The car broke down on the way', quote: 'The car broke down on the way' },
        { text: 'Your carefully planned schedule disappeared', quote: 'our carefully planned schedule disappeared' },
        { text: 'You arrived much later than expected', quote: 'We arrived much later than expected' },
        { text: 'Everyone was laughing by the end', quote: 'everyone was laughing by the end' },
        { text: 'The breakdown became one of your favourite family stories', quote: 'the breakdown became one of our favourite family stories' },
      ],
    }],
  },
  {
    title: 'What I Want My Grandchildren to Know', category: 'Ideas', memoryDate: '2024-12-25', cover: null, style: 'Fantasy',
    tags: ['grandchildren', 'legacy', 'curiosity', 'kindness', 'written-note'],
    questions: ['What do I want my grandchildren to know?', 'Why did I become an engineer?'],
    tellings: [{
      toldOn: '2024-12-25',
      text: 'I want Riya, Neel and Tara to understand that a life is made of ordinary moments as much as major achievements. I remember learning by taking things apart, working through mistakes and asking other people for help. I hope they stay curious and treat people kindly.',
      claims: [
        { text: 'You want Riya, Neel and Tara to understand that a life is made of ordinary moments as much as major achievements', quote: 'I want Riya, Neel and Tara to understand that a life is made of ordinary moments as much as major achievements' },
        { text: 'You learned by taking things apart', quote: 'I remember learning by taking things apart' },
        { text: 'You learned by working through mistakes', quote: 'working through mistakes' },
        { text: 'You learned by asking other people for help', quote: 'asking other people for help' },
        { text: 'You hope they stay curious', quote: 'I hope they stay curious' },
        { text: 'You hope they treat people kindly', quote: 'treat people kindly' },
      ],
    }],
  },
]

/** Suggested Echo Room questions for a sample memory, matched by title. */
export function sampleQuestions(title: string): string[] | null {
  return SAMPLES.find((s) => s.title.toLowerCase() === title.trim().toLowerCase())?.questions ?? null
}

/**
 * Adds the sample memories to the signed-in archive through the normal adapter, so each one is
 * encrypted with its own key and sealed like any other memory. Titles already in the archive are skipped.
 */
export async function loadSamples(data: DataAdapter, existing: Echo[]): Promise<{ added: number; skipped: number }> {
  const have = new Set(existing.filter((e) => !e.forgottenAt).map((e) => e.title.trim().toLowerCase()))
  const todo = SAMPLES.filter((s) => !have.has(s.title.toLowerCase()))
  // Lists show the newest-created first, so create in reverse to read in life order.
  for (const s of [...todo].reverse()) {
    const [first, ...later] = s.tellings
    if (!first) continue
    const id = await data.createEcho({
      title: s.title, text: first.text, memoryDate: s.memoryDate, toldOn: first.toldOn, tags: s.tags,
      category: s.category, style: s.style, cover: s.cover, summary: null, summaryGenerated: false,
      claims: seedClaims(canonicalize(first.text), first.claims),
    })
    for (const t of later) await data.retell(id, { text: t.text, toldOn: t.toldOn, claims: seedClaims(canonicalize(t.text), t.claims) })
  }
  return { added: todo.length, skipped: SAMPLES.length - todo.length }
}
