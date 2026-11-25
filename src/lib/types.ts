export type Attendee = {
  email: string;
  name?: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  self?: boolean;
};

export type CalEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  attendees: Attendee[];
  description?: string;
  location?: string;
  organizerSelf: boolean;
  htmlLink?: string;
};

export type ChangeType = 'create' | 'move' | 'delete';

export type Change = {
  id: string;
  type: ChangeType;
  eventId?: string;
  title?: string;
  start?: string;
  end?: string;
  attendees?: string[];
  description?: string;
  reason: string;
  before?: { title: string; start: string; end: string };
};

export type Proposal = { summary: string; changes: Change[]; warnings?: string[] };

export type ChatMsg = { role: 'user' | 'assistant'; content: string; events?: CalEvent[] };

export type TriageItem = {
  eventId: string;
  title: string;
  start: string;
  end: string;
  decision: 'accept' | 'decline' | 'maybe';
  reason: string;
  suggestion?: string;
};
