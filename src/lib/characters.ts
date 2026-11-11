export type CharacterId = 'elfboy' | 'elfgirl' | 'santa' | 'reindeer' | 'gingerbread' | 'snowman' | 'yeti';

export interface Character {
  id: CharacterId;
  name: string;
  /** Glow colour behind the character on the reveal. */
  color: string;
  image: string;
  /** The client's finished match card (1080×1350), shown and downloaded on the phone result page. */
  card: string;
}

export const CHARACTERS: Record<CharacterId, Character> = {
  elfboy: {
    id: 'elfboy',
    name: 'Elf Boy',
    color: '#2BB24C',
    image: '/assets/characters/elfboy.png',
    card: '/assets/cards/elfboy.jpg',
  },
  elfgirl: {
    id: 'elfgirl',
    name: 'Elf Girl',
    color: '#FF4B4B',
    image: '/assets/characters/elfgirl.png',
    card: '/assets/cards/elfgirl.jpg',
  },
  santa: {
    id: 'santa',
    name: 'Santa',
    color: '#FFFFFF',
    image: '/assets/characters/santa.png',
    card: '/assets/cards/santa.jpg',
  },
  reindeer: {
    id: 'reindeer',
    name: 'Reindeer',
    color: '#FFB347',
    image: '/assets/characters/reindeer.png',
    card: '/assets/cards/reindeer.jpg',
  },
  gingerbread: {
    id: 'gingerbread',
    name: 'Gingerbread',
    color: '#FFD9A0',
    image: '/assets/characters/gingerbread.png',
    card: '/assets/cards/gingerbread.jpg',
  },
  snowman: {
    id: 'snowman',
    name: 'Snowman',
    color: '#BFE6FF',
    image: '/assets/characters/snowman.png',
    card: '/assets/cards/snowman.jpg',
  },
  yeti: {
    id: 'yeti',
    name: 'Yeti',
    color: '#9FD3FF',
    image: '/assets/characters/yeti.png',
    card: '/assets/cards/yeti.jpg',
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
