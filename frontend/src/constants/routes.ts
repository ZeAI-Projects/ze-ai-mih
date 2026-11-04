import type { PageMetadata } from '../types/common';

export const ROUTES = {
  HOME: '/',
  ABOUT: '/about',
  GALLERY: '/gallery',
  REGISTER: '/register',
} as const;

export const PAGE_METADATA: Record<string, PageMetadata> = {
  [ROUTES.HOME]: {
    key: 'home',
    title: 'Made in India — Bring your ideas to life',
    description:
      'Bring a problem you care about and build something people can use. Explore Made in India, a hackathon by product company ZeAI Soft, and its upcoming edition.',
  },
  [ROUTES.ABOUT]: {
    key: 'about',
    title: 'About Us — Made in India by ZeAI Soft',
    description:
      'Meet ZeAI Soft, the product company behind Made in India. Discover its approach to building, meet founder Kirthika K., and explore the vision for LabX.',
  },
  [ROUTES.GALLERY]: {
    key: 'gallery',
    title: 'Gallery — Made in India by ZeAI Soft',
    description:
      'Step into the hackathon through photos and films: shared tables, working ideas, and the people behind them.',
  },
  [ROUTES.REGISTER]: {
    key: 'register',
    title: 'Upcoming Event — Made in India by ZeAI Soft',
    description:
      'Explore confirmed next-edition benefits, participation FAQs, and registration updates for the Made in India hackathon. Dates and eligibility rules are coming soon.',
  },
};

export const NOT_FOUND_METADATA: PageMetadata = {
  key: 'not-found',
  title: 'Page not found — Made in India',
  description: 'Return to Made in India by ZeAI Soft.',
};
