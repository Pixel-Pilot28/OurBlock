// Re-export types (but NOT constants to avoid naming conflicts)
export type {
  Profile,
  ProfileInput,
  ProfileOutput,
} from './profile';

export type {
  Vouch,
  VouchInput,
  VouchOutput,
} from './vouch';

export type {
  Post,
  PostInput,
  PostOutput,
  Reaction,
  ReactionInput,
  ReactionOutput,
  Comment,
  CommentInput,
  CommentOutput,
} from './feed';

export type {
  Item,
  ItemInput,
  ItemOutput,
  ItemStatus,
  Consumable,
  BorrowRequest,
  BorrowRequestInput,
  BorrowRequestOutput,
  TransactionOutput,
  TransactionStatus,
} from './toolshed';

export type {
  HelpRequest,
  HelpRequestInput,
  HelpRequestOutput,
  HelpOffer,
  HelpOfferInput,
  HelpOfferOutput,
} from './helpinghands';

export type {
  Message,
  MessageInput,
  MessageOutput,
  Channel,
  ChannelInput,
  ChannelOutput,
  ChatMessage,
  ChatSignal,
  SendMessageInput,
  SendMessageOutput,
  StoredMessage,
  ChatConversation,
} from './chat';

export type {
  Event,
  CreateEventInput,
  EventOutput,
} from './events';

export type {
  Space,
  CreateSpaceInput,
  SpaceOutput,
  Reservation,
  CreateReservationInput,
  ReservationOutput,
} from './spaces';

export type {
  FileMetadata,
  FileMetadataOutput,
  UploadFileInput,
  FileOutput,
} from './file-storage';

// Export chat helper functions and constants
export {
  MAX_MESSAGE_LENGTH,
  agentKeyToHex,
  shortenAgentKey,
} from './chat';

// Export namespaced constants for each module
export * as FeedConstants from './feed';
export * as ToolshedConstants from './toolshed';
export * as HelpingHandsConstants from './helpinghands';
