import { MatchTicket } from './match-ticket.entity.js';

describe('MatchTicket', () => {
  it('should detect when fully accepted', () => {
    const ticket = new MatchTicket(
      't1',
      'riichi',
      ['u1', 'u2', 'u3', 'u4'],
      ['u1', 'u2', 'u3', 'u4'],
      new Date(),
    );
    expect(ticket.isFullyAccepted()).toBe(true);
  });

  it('should return false if not fully accepted', () => {
    const ticket = new MatchTicket(
      't1',
      'riichi',
      ['u1', 'u2', 'u3', 'u4'],
      ['u1', 'u2'],
      new Date(),
    );
    expect(ticket.isFullyAccepted()).toBe(false);
  });
});
