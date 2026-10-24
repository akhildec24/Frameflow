import { v4 as uuidv4 } from 'uuid';
import type { UUID } from './types';

export function createId(): UUID {
  return uuidv4();
}
