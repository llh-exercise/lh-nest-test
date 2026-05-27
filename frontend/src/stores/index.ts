import { createPinia } from 'pinia';

export const pinia = createPinia();

export { useVersionStore } from './version';
export { useTypesStore } from './types';
