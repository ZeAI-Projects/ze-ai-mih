export interface HackathonPhoto {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  title: string;
  caption: string;
  credit: string;
  sourceUrl: string;
}

export interface HackathonVideo {
  id: string;
  title: string;
  location: string;
  description: string;
  credit: string;
  poster: string;
  src: string;
  sourceUrl: string;
}

// Event collection supplied by the project owner. See MEDIA_CREDITS.md.
export const HACKATHON_PHOTOS: HackathonPhoto[] = [
  {
    id: 'event-01',
    src: '/media/made-in-india-2026/event-01.webp',
    width: 1600,
    height: 1066,
    alt: 'Participants discussing a wired circuit between open laptops around a table',
    title: 'Every idea needs a first try.',
    caption: 'Start small. Learn something. Make the next version better.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1UhMkA_RzWTt4dJGpBzafqjquAEIftHPu/view?usp=drivesdk',
  },
  {
    id: 'event-02',
    src: '/media/made-in-india-2026/event-02.webp',
    width: 1600,
    height: 1066,
    alt: 'A smiling participant discusses a wired electronics prototype with people seated around laptops',
    title: 'What if we tried this?',
    caption: 'A different perspective can change the whole approach.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1Urkf64XMvN4G6V-_HrBpe9EKWtPJZCoG/view?usp=drivesdk',
  },
  {
    id: 'event-03',
    src: '/media/made-in-india-2026/event-03.webp',
    width: 1600,
    height: 1066,
    alt: 'Participants typing and using a mouse at laptops arranged along shared tables',
    title: 'Small steps. Real progress.',
    caption: 'Try, learn, rethink. Give an idea the chance to become useful.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/19B8dqc2ReI4BxaEiaH2SLbL5Dr1cUY7O/view?usp=drivesdk',
  },
  {
    id: 'event-04',
    src: '/media/made-in-india-2026/event-04.webp',
    width: 1600,
    height: 1066,
    alt: 'Participants examining laptops inside a tall white frame fitted with wires and small motors',
    title: 'Curiosity, put to work.',
    caption: 'The best way to understand an idea is to see what it can do.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1ZWTQPfGSSZXekWvHliGblPNThmEVbc_S/view?usp=drivesdk',
  },
  {
    id: 'event-05',
    src: '/media/made-in-india-2026/event-05.webp',
    width: 1600,
    height: 1066,
    alt: 'A team at a lectern presents beside a projected slide to seated listeners',
    title: 'Give your idea a voice.',
    caption: 'Share the problem, the thinking, and why your work matters.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1lrCl1bZ_EeApmvZq7GQ-Fy2h4-0hdUwn/view?usp=drivesdk',
  },
  {
    id: 'event-06',
    src: '/media/made-in-india-2026/event-06.webp',
    width: 1600,
    height: 1066,
    alt: 'A wide view of participants working and talking at rows of laptop-filled tables',
    title: 'Ambition loves company.',
    caption: 'Different skills. Shared questions. More ways to move forward.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1tpsQBqzJJn2UqJPJ18JH82X-QNOOLtgn/view?usp=drivesdk',
  },
  {
    id: 'event-07',
    src: '/media/made-in-india-2026/event-07.webp',
    width: 1600,
    height: 1066,
    alt: 'A man writes notes while talking with participants seated around laptops',
    title: 'The next question matters.',
    caption: 'Progress often starts with a conversation you did not expect.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1IwKjG3dWOP880V871fa_orl2wdDXaGK5/view?usp=drivesdk',
  },
  {
    id: 'event-08',
    src: '/media/made-in-india-2026/event-08.webp',
    width: 1600,
    height: 1066,
    alt: 'Three medal-wearing team members hold a trophy in front of a Grand Winner prize board',
    title: 'A win worth sharing.',
    caption: 'Built together. Celebrated together. A reason to keep going.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/12Ck1MD-t-kQNJW70_i9tlYfW3Vt3Axbp/view?usp=drivesdk',
  },
  {
    id: 'event-09',
    src: '/media/made-in-india-2026/event-09.webp',
    width: 1600,
    height: 1066,
    alt: 'Three participants display certificates, medals and a plaque alongside others on the event stage',
    title: 'Take the learning with you.',
    caption: 'What you discover here can shape whatever you build next.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/18XoUg_XmPTSRlaZDcgZZSYlDDpVm4uUy/view?usp=drivesdk',
  },
];

export const AFTERPARTY_PHOTOS: HackathonPhoto[] = [
  {
    id: 'afterparty-01',
    src: '/media/made-in-india-2026/afterparty-01.webp',
    width: 1600,
    height: 1066,
    alt: 'Participants dancing in small groups under deep blue and violet lighting',
    title: 'And exhale.',
    caption: 'The hard work deserves a little room to let go.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/10ExbRDGj1AJJenNZjVWIW0QLqnJ9rUrd/view?usp=drivesdk',
  },
  {
    id: 'afterparty-02',
    src: '/media/made-in-india-2026/afterparty-02.webp',
    width: 1600,
    height: 1066,
    alt: 'A crowd cheers and poses toward raised phones beside the DJ laptop',
    title: 'People make it memorable.',
    caption: 'A shared challenge is just the beginning of getting to know each other.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1qKyBQgGe9MbCtFUqekJysHRVjysD2Mj9/view?usp=drivesdk',
  },
  {
    id: 'afterparty-03',
    src: '/media/made-in-india-2026/afterparty-03.webp',
    width: 1600,
    height: 1066,
    alt: 'Participants dancing face to face with their arms raised under blue lighting',
    title: 'Leave the pressure behind.',
    caption: 'No perfect answers needed. Just enjoy being here.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1W7ZOnln8hE2gJxYxMTJ8eIN99DFchjSZ/view?usp=drivesdk',
  },
  {
    id: 'afterparty-04',
    src: '/media/made-in-india-2026/afterparty-04.webp',
    width: 1600,
    height: 1066,
    alt: 'A wide view of small groups dancing and talking across the blue-lit hall',
    title: 'Beyond the team name.',
    caption: 'There is more to a community than the projects it builds.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1ynFUPhkVv7LFIgp6z8gA44TJ6Lv07by-/view?usp=drivesdk',
  },
  {
    id: 'afterparty-05',
    src: '/media/made-in-india-2026/afterparty-05.webp',
    width: 1600,
    height: 1066,
    alt: 'Rear view of the DJ at a controller with headphones and a laptop, facing the dance floor',
    title: 'Find your rhythm.',
    caption: 'A different kind of energy to end a day of building.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1t_mfFv7s0iAN--vA-UGB1z5fHx3A1vC2/view?usp=drivesdk',
  },
  {
    id: 'afterparty-06',
    src: '/media/made-in-india-2026/afterparty-06.webp',
    width: 1600,
    height: 1066,
    alt: 'A participant in a pink top dances with both hands raised among other dancers',
    title: 'Joy needs no pitch.',
    caption: 'The experience matters as much as what you build.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1SDLZzOmYNkIBwshTQyys0X5SWpOJzn1S/view?usp=drivesdk',
  },
  {
    id: 'afterparty-07',
    src: '/media/made-in-india-2026/afterparty-07.webp',
    width: 1600,
    height: 1066,
    alt: 'Participants dancing together under red lighting beside audio equipment',
    title: 'A well-earned reset.',
    caption: 'Good company has a way of making a long day feel lighter.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1tmPlJhXZ6gOkdb7rtNDOOazzO4odObYP/view?usp=drivesdk',
  },
  {
    id: 'afterparty-08',
    src: '/media/made-in-india-2026/afterparty-08.webp',
    width: 1600,
    height: 1066,
    alt: 'A DJ with hands above a mixing controller beside an open laptop, with people standing nearby',
    title: 'Leave room for surprise.',
    caption: 'The unplanned parts can become your favourite stories.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1vM_SfzNXv2GpmJeciQ4Tok7U2pE6fTbr/view?usp=drivesdk',
  },
  {
    id: 'afterparty-09',
    src: '/media/made-in-india-2026/afterparty-09.webp',
    width: 1600,
    height: 1066,
    alt: 'A participant in pink makes a peace sign toward the camera among a group of attendees',
    title: 'Keep the feeling.',
    caption: 'Some memories stay with you long after the details fade.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1vE7i5F7VCfm8g6asmT8Xf_1ru98SQEKp/view?usp=drivesdk',
  },
  {
    id: 'afterparty-10',
    src: '/media/made-in-india-2026/afterparty-10.webp',
    width: 1600,
    height: 1066,
    alt: 'A wide view from behind the DJ controller toward groups dancing across the hall',
    title: 'The connection carries on.',
    caption: 'An event ends. A community can keep growing.',
    credit: 'ZeAI Soft event collection',
    sourceUrl:
      'https://drive.google.com/file/d/1zvJSdBgY1xTSExW9LkmGk0f-GlBOAdlD/view?usp=drivesdk',
  },
];

export const HACKATHON_VIDEOS: HackathonVideo[] = [
  {
    id: 'event-film-1',
    title: 'The weekend, in motion',
    location: 'The weekend, in motion',
    description: 'Edited event film from the 2026 Bengaluru finals.',
    credit: 'ZeAI Soft event collection',
    poster: '/media/made-in-india-2026/film-1.webp',
    src: '/media/made-in-india-2026/film-1.mp4',
    sourceUrl:
      'https://drive.google.com/file/d/1C7LQkApBr6WW4F9fGplUHTAz9D9DbHR5/view?usp=drivesdk',
  },
  {
    id: 'event-film-3',
    title: 'Ideas on the floor',
    location: 'Ideas on the floor',
    description: 'A moment from the 2026 Made in India hackathon.',
    credit: 'ZeAI Soft event collection',
    poster: '/media/made-in-india-2026/film-3.webp',
    src: '/media/made-in-india-2026/film-3.mp4',
    sourceUrl:
      'https://drive.google.com/file/d/1iSiBiBT-REslovaGWl4q_ALsBRxWmnfU/view?usp=drivesdk',
  },
  {
    id: 'event-film-5',
    title: 'After the final demo',
    location: 'After the final demo',
    description: 'A moment from the 2026 Made in India hackathon.',
    credit: 'ZeAI Soft event collection',
    poster: '/media/made-in-india-2026/film-5.webp',
    src: '/media/made-in-india-2026/film-5.mp4',
    sourceUrl:
      'https://drive.google.com/file/d/14rgzJO3XCvoG1Q8WIyIzXv6m6puacDWS/view?usp=drivesdk',
  },
  {
    id: 'event-film-4',
    title: 'A moment of recognition',
    location: 'A moment of recognition',
    description: 'A moment from the 2026 Made in India hackathon.',
    credit: 'ZeAI Soft event collection',
    poster: '/media/made-in-india-2026/film-4.webp',
    src: '/media/made-in-india-2026/film-4.mp4',
    sourceUrl:
      'https://drive.google.com/file/d/1Gh9_z6MKuENieTqFatNpzgspHbV1ZYNb/view?usp=drivesdk',
  },
  {
    id: 'event-film-2',
    title: 'Made in India: the official edit',
    location: 'Made in India: the official edit',
    description: 'Edited event film from the 2026 Bengaluru finals.',
    credit: 'ZeAI Soft event collection',
    poster: '/media/made-in-india-2026/film-2.webp',
    src: '/media/made-in-india-2026/film-2.mp4',
    sourceUrl:
      'https://drive.google.com/file/d/1EzrFbL6pHY_kFmvlS9f9MOw1YldOHb2d/view?usp=drivesdk',
  },
];
