// Length limits shared by the quiz coach UI and the server checks. Kept apart from the server
// code so client components can import them without pulling in Mongoose.

/** The learner's typed answer. */
export const AI_ANSWER_MAX = 4000;
/** One follow-up message from the learner. */
export const AI_MESSAGE_MAX = 2000;
/** A coach reply is cut to this many characters before it is stored and shown. */
export const AI_REPLY_MAX = 6000;
/** Earlier messages sent to the model with each follow-up. */
export const AI_HISTORY_MAX = 12;
/** Messages a stored conversation keeps. */
export const AI_STORED_MAX = 40;
/** OpenRouter model ids look like `vendor/model` or `vendor/model:variant`. */
export const MODEL_ID_PATTERN = /^[a-z0-9][\w.-]*\/[\w.:@+-]+$/i;
export const MODEL_ID_MAX = 200;
