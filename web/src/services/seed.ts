// Fictional sample memories for demo mode only.
import type { ArtStyle, Category, Claim } from '../types'

export interface SeedTelling {
  toldOn: string
  text: string
  claims: { text: string; quote: string }[]
}

export interface SeedEcho {
  title: string
  category: Category
  tags: string[]
  memoryDate: string
  cover: string
  style: ArtStyle
  favourite?: boolean
  summary: string
  tellings: SeedTelling[]
}

export const SEEDS: SeedEcho[] = [
  {
    title: 'My First Robot', category: 'Projects', tags: ['childhood', 'robot', 'inspiration', 'father'], memoryDate: '2024-01-12',
    cover: '/art/robot.jpg', style: 'Cinematic', favourite: true,
    summary: 'Building a first robot with your father at ten, the day that pointed you towards engineering.',
    tellings: [
      {
        toldOn: '2024-01-12',
        text: 'When I was ten, I built my first robot with my father. It was raining, so we worked in the garage. That day inspired me to become an engineer.',
        claims: [
          { text: 'You were ten', quote: 'When I was ten' },
          { text: 'You built your first robot', quote: 'I built my first robot' },
          { text: 'Your father helped you build it', quote: 'with my father' },
          { text: 'It was raining', quote: 'It was raining' },
          { text: 'You worked in the garage', quote: 'we worked in the garage' },
          { text: 'That day inspired you to become an engineer', quote: 'That day inspired me to become an engineer' },
        ],
      },
      {
        toldOn: '2026-03-02',
        text: "When I was ten, Dad and Uncle Raj helped me build a robot for the school competition. We won, and that's when I knew I wanted to be an engineer.",
        claims: [
          { text: 'You were ten', quote: 'When I was ten' },
          { text: 'You built a robot', quote: 'build a robot' },
          { text: 'Dad and Uncle Raj helped you build it', quote: 'Dad and Uncle Raj helped me' },
          { text: 'The robot was for a school competition', quote: 'for the school competition' },
          { text: 'You won the competition', quote: 'We won' },
          { text: 'That was when you knew you wanted to be an engineer', quote: "that's when I knew I wanted to be an engineer" },
        ],
      },
    ],
  },
  {
    title: 'Trip to the Mountains', category: 'Travel', tags: ['travel', 'nature', 'reflection'], memoryDate: '2024-03-03',
    cover: '/art/mountains.jpg', style: 'Cinematic',
    summary: 'The silence of the mountains made you feel small, in a good way.',
    tellings: [{ toldOn: '2024-03-04', text: 'The silence of the mountains reminded me how small yet connected we are. We hiked until sunset and nobody spoke for an hour.', claims: [] }],
  },
  {
    title: 'Learning to Code', category: 'Learning', tags: ['coding', 'growth', 'perseverance'], memoryDate: '2024-02-18',
    cover: '/art/library.jpg', style: 'Cinematic',
    summary: 'Hours of debugging until the program finally worked.',
    tellings: [{ toldOn: '2024-02-18', text: 'I spent hours debugging, but the moment it finally worked felt magical. I stayed in the library until it closed.', claims: [] }],
  },
  {
    title: 'College Friends', category: 'People', tags: ['friends', 'college', 'memories'], memoryDate: '2024-01-25',
    cover: '/art/friends.jpg', style: 'Cinematic',
    summary: 'Late-night study sessions with the people who made the journey special.',
    tellings: [{ toldOn: '2024-01-26', text: 'The people who made this journey special. Late night study sessions that turned into long talks about the future.', claims: [] }],
  },
  {
    title: 'First Solo Flight', category: 'Travel', tags: ['travel', 'independence', 'growth'], memoryDate: '2023-11-14',
    cover: '/art/flight.jpg', style: 'Cinematic',
    summary: 'Travelling alone for the first time: excitement and nerves.',
    tellings: [{ toldOn: '2023-11-15', text: 'My first time traveling alone. A mix of excitement and nervousness, and a sunrise above the clouds.', claims: [] }],
  },
  {
    title: 'Idea for Echoes', category: 'Ideas', tags: ['ideas', 'product', 'echoes'], memoryDate: '2023-10-28',
    cover: '/art/coffee.jpg', style: 'Cinematic',
    summary: 'A thought about preserving memories in a way AI cannot rewrite.',
    tellings: [{ toldOn: '2023-10-28', text: 'A thought about preserving memories in a meaningful way, where the AI can never rewrite what I actually said.', claims: [] }],
  },
  {
    title: 'Stargazing Night', category: 'Personal', tags: ['nature', 'peace', 'life'], memoryDate: '2023-09-12',
    cover: '/art/stars.jpg', style: 'Cinematic',
    summary: 'On the terrace under the stars, feeling a deep sense of peace.',
    tellings: [{ toldOn: '2023-09-12', text: 'Sat on the terrace, looking at the stars. Felt a deep sense of peace for the first time in weeks.', claims: [] }],
  },
  {
    title: 'Fitness Journey', category: 'Personal', tags: ['fitness', 'discipline', 'growth'], memoryDate: '2023-08-01',
    cover: '/art/fitness.jpg', style: 'Cinematic',
    summary: 'The first day of a new routine: discipline, consistency, progress.',
    tellings: [{ toldOn: '2023-08-01', text: 'Started my fitness journey today. Discipline, consistency, progress. The first session was harder than I expected.', claims: [] }],
  },
  {
    title: 'Science Fair', category: 'Projects', tags: ['robot', 'school', 'inspiration'], memoryDate: '2023-12-10',
    cover: '/art/science-fair.jpg', style: 'Cinematic',
    summary: 'Showing your robot arm at the school science fair.',
    tellings: [{ toldOn: '2023-12-10', text: 'At the science fair I showed the robot arm I had built. A judge asked how it worked and I explained every gear.', claims: [] }],
  },
  {
    title: 'School Project', category: 'Projects', tags: ['school', 'coding', 'teamwork'], memoryDate: '2023-11-05',
    cover: '/art/school-project.jpg', style: 'Cinematic',
    summary: 'A blueprint for a team project that taught you to plan before building.',
    tellings: [{ toldOn: '2023-11-05', text: 'Our team drew the whole blueprint before writing any code. It was the first time planning felt like part of building.', claims: [] }],
  },
]

/** Turn seed quotes into claims with real character spans. */
export function seedClaims(text: string, claims: SeedTelling['claims']): Claim[] {
  return claims.flatMap((c) => {
    const i = text.indexOf(c.quote)
    return i >= 0 ? [{ text: c.text, quote: c.quote, start: i, end: i + c.quote.length }] : []
  })
}
