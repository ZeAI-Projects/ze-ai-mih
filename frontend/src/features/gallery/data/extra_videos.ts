import type { HackathonVideo } from './media';

// Locally hosted, licensed stock clips. These are inspiration, not event footage.
// Provenance is documented in MEDIA_VIDEO_CREDITS.md.
export const HACKATHON_VIDEO_CLIPS: HackathonVideo[] = [
  {
    id: 'pair-programming',
    title: 'Two perspectives. One idea.',
    location: 'Build together',
    description: 'A pair of programmers share ideas and work through code together.',
    credit: 'olia danilevich / Pexels',
    poster: '/media/pair-programming.jpg',
    src: '/media/pair-programming.mp4',
    sourceUrl: 'https://www.pexels.com/video/programmers-working-and-sharing-ideas-4974769/',
  },
  {
    id: 'team-collaboration',
    title: 'Every perspective counts.',
    location: 'Share the spark',
    description: 'A collaborative team turns a conversation into a shared plan.',
    credit: 'Edmond Dantès / Pexels',
    poster: '/media/team-collaboration.jpg',
    src: '/media/team-collaboration.mp4',
    sourceUrl: 'https://www.pexels.com/video/coworkers-looking-at-a-laptop-screen-8643483/',
  },
  {
    id: 'creative-brainstorm',
    title: 'Start with a question.',
    location: 'Shape an idea',
    description: 'A quick look at the energy of a creative brainstorming session.',
    credit: 'Alena Darmel / Pexels',
    poster: '/media/creative-brainstorm.jpg',
    src: '/media/creative-brainstorm.mp4',
    sourceUrl: 'https://www.pexels.com/video/team-having-meeting-7659663/',
  },
  {
    id: 'robotics-team',
    title: 'Build beyond the screen.',
    location: 'Make it real',
    description: 'Young makers bring a robotics project to life through hands-on teamwork.',
    credit: 'Vanessa Loring / Pexels',
    poster: '/media/robotics-team.jpg',
    src: '/media/robotics-team.mp4',
    sourceUrl:
      'https://www.pexels.com/video/a-group-of-young-people-working-on-a-science-project-7868254/',
  },
  {
    id: 'focused-coding',
    title: 'One line at a time.',
    location: 'Find your flow',
    description: 'A focused coding session captures the quieter side of making something new.',
    credit: 'Mikhail Nilov / Pexels',
    poster: '/media/focused-coding.jpg',
    src: '/media/focused-coding.mp4',
    sourceUrl: 'https://www.pexels.com/video/a-man-typing-on-a-laptop-7989676/',
  },
];
