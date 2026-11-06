export type CharacterId = 'elfboy' | 'elfgirl' | 'santa' | 'reindeer' | 'gingerbread' | 'snowman' | 'yeti';

export interface Character {
  id: CharacterId;
  name: string;
  title: string;
  quote: string;
  /** Glow colour behind the character on the reveal. */
  color: string;
  /** Accent used for the title pill. */
  deep: string;
  image: string;
}

export const CHARACTERS: Record<CharacterId, Character> = {
  elfboy: {
    id: 'elfboy',
    name: 'Elf Boy',
    title: 'The Toy Tinkerer',
    quote: '“Quick hands, big ideas and always first to the workbench.”',
    color: '#2BB24C',
    deep: '#0B6B3A',
    image: '/assets/characters/elfboy.png',
  },
  elfgirl: {
    id: 'elfgirl',
    name: 'Elf Girl',
    title: 'The Merry Maker',
    quote: '“Cheerful, creative and always ready to make Christmas a little more magical.”',
    color: '#FF4B4B',
    deep: '#0B6B3A',
    image: '/assets/characters/elfgirl.png',
  },
  santa: {
    id: 'santa',
    name: 'Santa',
    title: 'The Chief of Cheer',
    quote: '“Generous, jolly and the heart of every celebration.”',
    color: '#FFFFFF',
    deep: '#E3000B',
    image: '/assets/characters/santa.png',
  },
  reindeer: {
    id: 'reindeer',
    name: 'Reindeer',
    title: 'The Sky Runner',
    quote: '“Brave, loyal and always ready to lead the way.”',
    color: '#FFB347',
    deep: '#6B3A1E',
    image: '/assets/characters/reindeer.png',
  },
  gingerbread: {
    id: 'gingerbread',
    name: 'Gingerbread',
    title: 'The Sweet Spark',
    quote: '“Warm, quick-witted and full of sweet surprises.”',
    color: '#FFD9A0',
    deep: '#7A3E17',
    image: '/assets/characters/gingerbread.png',
  },
  snowman: {
    id: 'snowman',
    name: 'Snowman',
    title: 'The Cool Companion',
    quote: '“Calm, kind and always cool under pressure.”',
    color: '#BFE6FF',
    deep: '#E3000B',
    image: '/assets/characters/snowman.png',
  },
  yeti: {
    id: 'yeti',
    name: 'Yeti',
    title: 'The Gentle Giant',
    quote: '“Big hugs, a bigger heart, and happiest when the snow starts falling.”',
    color: '#9FD3FF',
    deep: '#0B4FA8',
    image: '/assets/characters/yeti.png',
  },
};

export const CHARACTER_IDS = Object.keys(CHARACTERS) as CharacterId[];
