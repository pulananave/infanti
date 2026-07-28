import { eventBus, Events } from './event-bus';

export enum GameState {
  FREE = 'FREE',
  RECORDING = 'RECORDING',
  PLAYING = 'PLAYING',
}

class GameStateManager {
  private _current: GameState = GameState.FREE;

  get current(): GameState {
    return this._current;
  }

  change(state: GameState): void {
    const old = this._current;
    this._current = state;
    eventBus.emit(Events.SCENE_CHANGED, state, old);
  }
}

export const gameState = new GameStateManager();
