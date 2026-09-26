import { describe, expect, it } from 'vitest';
import { classifyAcledEvent } from './acled';

describe('classifyAcledEvent', () => {
  it('maps public ACLED sub-event types into stable map categories', () => {
    expect(classifyAcledEvent('Explosions/Remote violence', 'Air/drone strike')).toEqual({
      category: 'aerial_attack',
      labelAr: 'ضربة جوية/مسيّرة مُبلّغ عنها',
    });
    expect(classifyAcledEvent('Explosions/Remote violence', 'Shelling/artillery/missile attack').category).toBe('heavy_weapons');
    expect(classifyAcledEvent('Explosions/Remote violence', 'Remote explosive/land mine/IED').category).toBe('bombing');
    expect(classifyAcledEvent('Battles', 'Armed clash').category).toBe('armed_clash');
    expect(classifyAcledEvent('Violence against civilians', 'Attack').category).toBe('assault');
  });

  it('does not upgrade uncategorized records into a specific strike type', () => {
    expect(classifyAcledEvent('Strategic developments', 'Other').category).toBe('other');
  });
});
