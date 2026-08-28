const REACTIONS = [
  ['controversial1', '\u{1F914}', 'Thinking'],
  ['controversial2', '\u{1F610}', 'Neutral'],
  ['controversial3', '\u{1F937}', 'Shrug'],
  ['shocked1', '\u{1F631}', 'Shocked'],
  ['shocked2', '\u{1F628}', 'Fearful'],
  ['shocked3', '\u{1F632}', 'Astonished'],
  ['like1', '\u{1F44D}', 'Thumbs Up'],
  ['like2', '\u{1F44F}', 'Clap'],
  ['like3', '\u{1F64C}', 'Raised Hands'],
  ['love1', '\u2764\uFE0F', 'Heart'],
  ['love2', '\u{1F970}', 'Smiling Heart'],
  ['love3', '\u{1F495}', 'Two Hearts'],
  ['dislike1', '\u{1F44E}', 'Thumbs Down'],
  ['dislike2', '\u{1F612}', 'Unamused'],
  ['dislike3', '\u{1F928}', 'Raised Eyebrow'],
  ['hate1', '\u{1F620}', 'Angry'],
  ['hate2', '\u{1F92C}', 'Cursing'],
  ['hate3', '\u{1F4A2}', 'Anger Symbol'],
  ['goodJob1', '\u{1F44C}', 'OK Hand'],
  ['goodJob2', '\u{1F389}', 'Party'],
  ['goodJob3', '\u{1F3C6}', 'Trophy']
].map(([id, icon, name]) => Object.freeze({ id, icon, name }));

const REACTION_BY_ID = new Map(REACTIONS.map((reaction) => [reaction.id, reaction]));

export const getReaction = (id) => REACTION_BY_ID.get(String(id || '')) || null;

export default REACTIONS;
