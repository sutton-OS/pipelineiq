import type { ConversationContext, StateMachineResult, TriggerEvent } from "./types";
export declare function evaluateStateMachine(context: ConversationContext, event: TriggerEvent, nowInput?: Date): StateMachineResult;
