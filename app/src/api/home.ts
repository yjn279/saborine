import type { Identity } from "../auth/identity";
import type { SaborineGesture, SaborineLineage } from "../components/saborine/types";
import { apiRequest } from "./client";

// サーバーとやりとりする値の形。サーバー側(server/src/routes/home.ts, chores.ts)の出力に合わせる。

// きょう、ふたりに起きたこと1件。件数・時刻・順位は持たない(docs/mvp.mdの「持たないデータ」)。
export interface TodayEvent {
  id: string;
  choreType: string;
  mine: boolean;
  thanked: boolean;
}

export interface HomeState {
  isPaired: boolean;
  saborine: {
    name: string | null;
    isSloppy: boolean;
    evolutionStage: number;
    evolutionLineage: SaborineLineage | null;
    serif: string;
    // だらしな・ありがとう待ち・促し・ふだんの4種類のみ(server/src/domain/lines.ts の LineKind と同じ言葉)。
    serifKind: "sloppy" | "thanksWaiting" | "nudge" | "default";
    // いまの育ち具合(0〜1)。ポイント数そのものは含まない
    growthProgress: number;
  };
  // 0〜1の割合のみ。回数は含まれない(docs/mvp.md:142)。
  balanceGauge: number;
  myAffection: {
    value: number;
    gestures: SaborineGesture[];
  };
  // 新しい順、最大6件。自分の記録と相手の記録の両方を含む。
  todayEvents: TodayEvent[];
}

export function fetchHomeState(identity: Identity): Promise<HomeState> {
  return apiRequest<HomeState>("/api/home", { identity });
}

export interface ChorePresetsResponse {
  presets: string[];
}

export function fetchChorePresets(identity: Identity): Promise<ChorePresetsResponse> {
  return apiRequest<ChorePresetsResponse>("/api/chores/presets", { identity });
}

export interface RecordChoreResponse {
  id: string;
  choreType: string;
  createdAt: string;
}

export function recordChore(identity: Identity, choreType: string): Promise<RecordChoreResponse> {
  return apiRequest<RecordChoreResponse>("/api/chores", {
    method: "POST",
    identity,
    body: { choreType },
  });
}

export interface SendThanksResponse {
  id: string;
  choreLogId: string;
  createdAt: string;
}

export function sendThanks(identity: Identity, choreLogId: string): Promise<SendThanksResponse> {
  return apiRequest<SendThanksResponse>(`/api/chores/${choreLogId}/thanks`, {
    method: "POST",
    identity,
  });
}
