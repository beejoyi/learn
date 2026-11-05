// Length limits shared by the quiz coach UI and the server checks. Kept apart from the server
// code so client components can import them without pulling in Mongoose.

/** The learner's typed answer. */
export const AI_ANSWER_MAX = 4000;
/** One follow-up chat message. */
export const AI_MESSAGE_MAX = 2000;
/** Messages kept in a follow-up conversation (older ones are dropped by the UI). */
export const AI_HISTORY_MAX = 12;
