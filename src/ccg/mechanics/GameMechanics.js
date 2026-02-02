export const Phases = {
  COMMAND: 'Command Phase',
  DEPLOYMENT: 'Deployment Phase',
  BATTLE: 'Battle Phase',
  END_TURN: 'End Turn'
};

class GameMechanics {
  constructor() {
    this.currentPhase = Phases.COMMAND;
    this.isPlayerTurn = true;
  }

  getCurrentPhase() {
    return this.currentPhase;
  }

  endCurrentPhase() {
    switch (this.currentPhase) {
      case Phases.COMMAND:
        this.currentPhase = Phases.DEPLOYMENT;
        break;
      case Phases.DEPLOYMENT:
        this.currentPhase = Phases.BATTLE;
        break;
      case Phases.BATTLE:
        this.currentPhase = Phases.END_TURN;
        break;
      case Phases.END_TURN:
        this.currentPhase = Phases.COMMAND;
        this.isPlayerTurn = !this.isPlayerTurn;
        break;
      default:
        break;
    }
  }
}

export default GameMechanics;
