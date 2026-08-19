// people slice — frames 13 Players tab, 14 Late arrival, 15 Extend,
// 16 Correct or void a result (plus its confirm step, carried from v1 26a).

export { PlayersTab } from "./PlayersTab";
export type { PlayersTabProps, PlayersTabPlayer, PlayerStatus } from "./PlayersTab";

export { LateArrival } from "./LateArrival";
export type { LateArrivalProps, LateArrivalCourt } from "./LateArrival";

export { Extend, targetWord } from "./Extend";
export type { ExtendProps } from "./Extend";

export { CorrectOrVoid, pairName, padScore } from "./CorrectOrVoid";
export type { CorrectOrVoidProps, CorrectOrVoidMatch } from "./CorrectOrVoid";

export { VoidConfirm } from "./VoidConfirm";
export type { VoidConfirmProps } from "./VoidConfirm";
