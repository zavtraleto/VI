import { describe, expect, it } from 'vitest';
import { messagesOf, partVoices } from './voices';

describe('a message of the window a level opens with', () => {
  it('is shown without the marks of the words that are not the laboratory’s', () => {
    expect(partVoices('The die is [already half here]. Roll over it.').text).toBe('The die is already half here. Roll over it.');
  });

  it('knows which of its signs are the other side’s: those between the marks, and no others', () => {
    const { text, other } = partVoices('It leaves [to us].');
    expect(other).toHaveLength(text.length);
    expect([...text].filter((_, i) => other[i]).join('')).toBe('to us');
  });

  it('has none of them where nothing is marked', () => {
    const { text, other } = partVoices('A step is not a move.');
    expect(text).toBe('A step is not a move.');
    expect(other.some(Boolean)).toBe(false);
  });

  it('may have several', () => {
    const { text, other } = partVoices('[We] wait. It comes [here].');
    expect(text).toBe('We wait. It comes here.');
    expect([...text].filter((_, i) => other[i]).join('')).toBe('Wehere');
  });
});

describe('the messages of a level', () => {
  it('are parted by a blank line, each one trimmed', () => {
    expect(messagesOf('Hello!\n\nYou stand on a die.\nLead it.\n \nThat is all.').map((said) => said.text)).toEqual(['Hello!', 'You stand on a die.\nLead it.', 'That is all.']);
  });

  it('keep their marks apart: a mark does not run on into the next message', () => {
    const [first, second] = messagesOf('It is [here].\n\nRoll over it.');
    expect(first.other.some(Boolean)).toBe(true);
    expect(second.other.some(Boolean)).toBe(false);
  });

  it('are one message for a text with no blank line, and none for no text', () => {
    expect(messagesOf('One thought.')).toHaveLength(1);
    expect(messagesOf('')).toEqual([]);
  });
});
