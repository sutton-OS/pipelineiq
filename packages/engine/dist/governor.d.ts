import type { ConversationContext, GovernorResult, ProposedAction } from "./types";
export declare const POLICY_VERSION = "goldbot-governor-v1";
export declare function governActions(context: ConversationContext, actions: ProposedAction[], nowInput?: Date): GovernorResult;
