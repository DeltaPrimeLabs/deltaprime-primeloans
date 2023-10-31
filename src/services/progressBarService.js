import {Subject} from 'rxjs';

export default class ProgressBarService {

  progressBarRequested$ = new Subject();
  progressBarState$ = new Subject();

  requestProgressBar(duration = 1000) {
    this.progressBarRequested$.next({duration: duration});
    this.progressBarState$.next({state: 'MINING'});
  }

  emitProgressBarErrorState(additionalInfo) {
    console.log('emitting error state');
    this.requestProgressBar();
    this.progressBarState$.next({state: 'ERROR', additionalInfo});
  }

  emitProgressBarCancelledState() {
    this.requestProgressBar();
    this.progressBarState$.next({state: 'CANCELLED'});
  }

  emitProgressBarSuccessState() {
    this.progressBarState$.next({state: 'SUCCESS'});
  }

  emitProgressBarInProgressState(statusInfo = {}) {
    this.progressBarState$.next({state: 'IN_PROGRESS', statusInfo});
  }

  emitProgressBarState(state) {
    this.progressBarState$.next(state);
  }

};