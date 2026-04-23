import { createLightTheme, createDarkTheme, type BrandVariants } from '@fluentui/react-components';

const cobaltBrand: BrandVariants = {
  10: '#020B1A',
  20: '#041630',
  30: '#062246',
  40: '#083060',
  50: '#0A3E7A',
  60: '#0C4C94',
  70: '#0F52BA',
  80: '#2A6CD4',
  90: '#4C86E0',
  100: '#70A0E8',
  110: '#94BAEF',
  120: '#B4CEF5',
  130: '#CEE0F9',
  140: '#E4EEFB',
  150: '#F0F6FD',
  160: '#F8FAFF',
};

export const originmainLightTheme = createLightTheme(cobaltBrand);
export const originmainDarkTheme = createDarkTheme(cobaltBrand);
